"""SQLite access and schema migrations.

Migrations are plain functions tracked with ``PRAGMA user_version``. Version 1 is
the single table the first release of the app shipped with, so a database
created by that release upgrades in place instead of being thrown away.
"""

from __future__ import annotations

import logging
import sqlite3
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from .categories import normalize_category

log = logging.getLogger(__name__)


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def connect(path: Path) -> sqlite3.Connection:
    # FastAPI may run a request's dependency and handler on different worker
    # threads. Each connection still belongs to exactly one request.
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _v1_initial(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            description TEXT,
            status TEXT
        )
        """
    )


def _title_from_description(description: str, fallback: str) -> str:
    text = " ".join((description or "").split())
    if not text:
        return fallback
    first_sentence = text.split(". ")[0].rstrip(".")
    if len(first_sentence) <= 70:
        return first_sentence
    return first_sentence[:70].rsplit(" ", 1)[0].rstrip(",;:-") + "…"


def _v2_catalog(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE products_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            attributes TEXT NOT NULL DEFAULT '[]',
            price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
            stock INTEGER CHECK (stock IS NULL OR stock >= 0),
            status TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
            image_id TEXT,
            marketing TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    now = utc_now()
    legacy_rows = conn.execute("SELECT id, category, description, status FROM products").fetchall()
    for row in legacy_rows:
        category = normalize_category(row["category"])
        description = row["description"] or ""
        status = "published" if (row["status"] or "").lower() == "published" else "draft"
        conn.execute(
            """
            INSERT INTO products_v2 (id, title, category, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                _title_from_description(description, fallback=f"Product {row['id']}"),
                category,
                description,
                status,
                now,
                now,
            ),
        )

    conn.execute("DROP TABLE products")
    conn.execute("ALTER TABLE products_v2 RENAME TO products")
    conn.execute("CREATE UNIQUE INDEX idx_products_sku ON products (sku) WHERE sku IS NOT NULL")
    conn.execute("CREATE INDEX idx_products_status ON products (status)")
    conn.execute("CREATE INDEX idx_products_category ON products (category)")
    if legacy_rows:
        log.info("Migrated %d products from the v1 schema", len(legacy_rows))


MIGRATIONS: list[Callable[[sqlite3.Connection], None]] = [_v1_initial, _v2_catalog]


def migrate(path: Path) -> int:
    """Bring the database at ``path`` up to the latest schema. Returns the version."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    # Manage transactions by hand so each migration, DDL included, is all-or-nothing.
    conn.isolation_level = None
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        current = conn.execute("PRAGMA user_version").fetchone()[0]
        for version, step in enumerate(MIGRATIONS, start=1):
            if version <= current:
                continue
            conn.execute("BEGIN")
            try:
                step(conn)
                conn.execute(f"PRAGMA user_version = {version}")
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            log.info("Database migrated to version %d", version)
        return conn.execute("PRAGMA user_version").fetchone()[0]
    finally:
        conn.close()
