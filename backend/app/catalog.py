"""Product queries. Everything that touches the products table lives here."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from .categories import sku_prefix
from .database import utc_now
from .media import image_ref
from .schemas import Attribute, MarketingKit, Product

SortKey = Literal["newest", "oldest", "title", "price_asc", "price_desc", "stock_asc"]

_ORDER_BY: dict[str, str] = {
    "newest": "id DESC",
    "oldest": "id ASC",
    "title": "title COLLATE NOCASE ASC, id DESC",
    "price_asc": "price_cents IS NULL, price_cents ASC, id DESC",
    "price_desc": "price_cents IS NULL, price_cents DESC, id DESC",
    "stock_asc": "stock IS NULL, stock ASC, id DESC",
}

_JSON_FIELDS = ("tags", "attributes", "marketing")


class DuplicateSku(Exception):
    pass


def to_product(row: sqlite3.Row) -> Product:
    marketing = json.loads(row["marketing"]) if row["marketing"] else None
    return Product(
        id=row["id"],
        sku=row["sku"],
        title=row["title"],
        category=row["category"],
        description=row["description"],
        tags=json.loads(row["tags"] or "[]"),
        attributes=[Attribute(**item) for item in json.loads(row["attributes"] or "[]")],
        price=None if row["price_cents"] is None else row["price_cents"] / 100,
        stock=row["stock"],
        status=row["status"],
        image=image_ref(row["image_id"]) if row["image_id"] else None,
        marketing=MarketingKit(**marketing) if marketing else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_columns(fields: dict[str, Any]) -> dict[str, Any]:
    """Map API field names and types onto table columns."""
    columns: dict[str, Any] = {}
    for key, value in fields.items():
        if key == "price":
            columns["price_cents"] = None if value is None else round(value * 100)
        elif key == "marketing":
            columns[key] = None if value is None else json.dumps(value)
        elif key in _JSON_FIELDS:
            columns[key] = json.dumps(value or [])
        else:
            columns[key] = value
    return columns


def _where(q: str | None, category: str | None, status: str | None) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        like = f"%{q.strip().lower()}%"
        clauses.append("(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(sku) LIKE ?)")
        params += [like, like, like, like]
    if category:
        clauses.append("category = ?")
        params.append(category)
    if status:
        clauses.append("status = ?")
        params.append(status)
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def list_products(
    conn: sqlite3.Connection,
    *,
    q: str | None = None,
    category: str | None = None,
    status: str | None = None,
    sort: SortKey = "newest",
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Product], int]:
    where, params = _where(q, category, status)
    total = conn.execute(f"SELECT COUNT(*) FROM products{where}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM products{where} ORDER BY {_ORDER_BY[sort]} LIMIT ? OFFSET ?",
        [*params, limit, offset],
    ).fetchall()
    return [to_product(row) for row in rows], total


def get_product(conn: sqlite3.Connection, product_id: int) -> Product | None:
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return to_product(row) if row else None


def get_image_id(conn: sqlite3.Connection, product_id: int) -> str | None:
    row = conn.execute("SELECT image_id FROM products WHERE id = ?", (product_id,)).fetchone()
    return row["image_id"] if row else None


def _default_sku(conn: sqlite3.Connection, category: str, product_id: int) -> str:
    """Readable default SKU such as KIT-0042. Sellers can overwrite it."""
    base = f"{sku_prefix(category)}-{product_id:04d}"
    candidate, suffix = base, 2
    while conn.execute("SELECT 1 FROM products WHERE sku = ?", (candidate,)).fetchone():
        candidate, suffix = f"{base}-{suffix}", suffix + 1
    return candidate


def create_product(conn: sqlite3.Connection, fields: dict[str, Any]) -> Product:
    now = utc_now()
    columns = _to_columns(fields) | {"created_at": now, "updated_at": now}
    names = ", ".join(columns)
    placeholders = ", ".join("?" for _ in columns)
    try:
        with conn:
            cursor = conn.execute(f"INSERT INTO products ({names}) VALUES ({placeholders})", list(columns.values()))
            product_id = cursor.lastrowid
            if not columns.get("sku"):
                conn.execute(
                    "UPDATE products SET sku = ? WHERE id = ?",
                    (_default_sku(conn, columns["category"], product_id), product_id),
                )
    except sqlite3.IntegrityError as exc:
        if "sku" in str(exc).lower():
            raise DuplicateSku(fields.get("sku")) from exc
        raise
    product = get_product(conn, product_id)  # type: ignore[arg-type]
    assert product is not None
    return product


def update_product(conn: sqlite3.Connection, product_id: int, changes: dict[str, Any]) -> Product | None:
    if get_product(conn, product_id) is None:
        return None
    columns = _to_columns(changes)
    if columns:
        columns["updated_at"] = utc_now()
        assignments = ", ".join(f"{name} = ?" for name in columns)
        try:
            with conn:
                conn.execute(
                    f"UPDATE products SET {assignments} WHERE id = ?",
                    [*columns.values(), product_id],
                )
        except sqlite3.IntegrityError as exc:
            if "sku" in str(exc).lower():
                raise DuplicateSku(changes.get("sku")) from exc
            raise
    return get_product(conn, product_id)


def set_status(conn: sqlite3.Connection, ids: list[int], status: str) -> int:
    placeholders = ", ".join("?" for _ in ids)
    with conn:
        cursor = conn.execute(
            f"UPDATE products SET status = ?, updated_at = ? WHERE id IN ({placeholders}) AND status != ?",
            [status, utc_now(), *ids, status],
        )
    return cursor.rowcount


def delete_products(conn: sqlite3.Connection, ids: list[int]) -> list[str | None]:
    """Delete rows and return their image ids so the caller can remove the files."""
    placeholders = ", ".join("?" for _ in ids)
    with conn:
        rows = conn.execute(f"SELECT image_id FROM products WHERE id IN ({placeholders})", ids).fetchall()
        conn.execute(f"DELETE FROM products WHERE id IN ({placeholders})", ids)
    return [row["image_id"] for row in rows]


def image_ids_in_use(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT image_id FROM products WHERE image_id IS NOT NULL").fetchall()
    return {row["image_id"] for row in rows}
