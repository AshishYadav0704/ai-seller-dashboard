from __future__ import annotations

import csv
import io
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from .. import catalog
from ..categories import category_label
from ..config import Settings
from ..deps import DbDep, SettingsDep
from ..media import delete_image, image_exists
from ..schemas import BulkAction, BulkResult, Product, ProductCreate, ProductPage, ProductUpdate, Status

router = APIRouter(prefix="/products", tags=["products"])

SearchQuery = Annotated[str | None, Query(max_length=100, description="Matches title, description, tags or SKU")]


def _check_image(settings: Settings, image_id: str | None) -> None:
    if image_id and not image_exists(settings.media_dir, image_id):
        raise HTTPException(422, "That photo is no longer on the server. Upload it again.")


def _sku_taken(sku: str | None) -> HTTPException:
    return HTTPException(409, f"SKU {sku} is already used by another product.")


@router.get("", response_model=ProductPage)
def list_products(
    db: DbDep,
    q: SearchQuery = None,
    category: str | None = None,
    status_: Annotated[Status | None, Query(alias="status")] = None,
    sort: catalog.SortKey = "newest",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProductPage:
    items, total = catalog.list_products(
        db, q=q, category=category, status=status_, sort=sort, limit=limit, offset=offset
    )
    return ProductPage(items=items, total=total)


@router.post("", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, db: DbDep, settings: SettingsDep) -> Product:
    _check_image(settings, body.image_id)
    try:
        return catalog.create_product(db, body.model_dump())
    except catalog.DuplicateSku:
        raise _sku_taken(body.sku) from None


# Declared before /{product_id} so "export.csv" isn't parsed as an id.
@router.get("/export.csv", response_class=Response)
def export_csv(
    request: Request,
    db: DbDep,
    q: SearchQuery = None,
    category: str | None = None,
    status_: Annotated[Status | None, Query(alias="status")] = None,
) -> Response:
    items, _ = catalog.list_products(db, q=q, category=category, status=status_, sort="title", limit=100_000)
    base_url = str(request.base_url).rstrip("/")

    buffer = io.StringIO()
    # A BOM makes Excel open the file as UTF-8, so ₹ and non-English text survive.
    buffer.write("﻿")
    writer = csv.writer(buffer)
    writer.writerow(
        ["SKU", "Title", "Category", "Status", "Price", "Stock", "Tags", "Description", "Image URL", "Updated"]
    )
    for item in items:
        writer.writerow(
            [
                _cell(item.sku or ""),
                _cell(item.title),
                category_label(item.category),
                item.status,
                "" if item.price is None else f"{item.price:.2f}",
                "" if item.stock is None else item.stock,
                _cell(", ".join(item.tags)),
                _cell(item.description),
                f"{base_url}{item.image.url}" if item.image else "",
                item.updated_at,
            ]
        )

    filename = f"shelfwise-catalog-{date.today().isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _cell(value: str) -> str:
    """Stop spreadsheet apps from treating user text as a formula (CSV injection)."""
    if value and value[0] in "=+-@\t\r":
        return "'" + value
    return value


@router.post("/bulk", response_model=BulkResult)
def bulk_action(body: BulkAction, db: DbDep, settings: SettingsDep) -> BulkResult:
    ids = list(dict.fromkeys(body.ids))
    if body.action == "delete":
        image_ids = catalog.delete_products(db, ids)
        for image_id in image_ids:
            delete_image(settings.media_dir, image_id)
        return BulkResult(action="delete", affected=len(image_ids))

    target = {"publish": "published", "draft": "draft", "archive": "archived"}[body.action]
    return BulkResult(action=body.action, affected=catalog.set_status(db, ids, target))


@router.get("/{product_id}", response_model=Product)
def get_product(product_id: int, db: DbDep) -> Product:
    product = catalog.get_product(db, product_id)
    if product is None:
        raise HTTPException(404, "Product not found.")
    return product


@router.patch("/{product_id}", response_model=Product)
def update_product(product_id: int, body: ProductUpdate, db: DbDep, settings: SettingsDep) -> Product:
    changes = body.model_dump(exclude_unset=True)
    for required in ("title", "category", "status"):
        if required in changes and changes[required] is None:
            raise HTTPException(422, f"{required} can't be empty.")
    _check_image(settings, changes.get("image_id"))

    previous_image = catalog.get_image_id(db, product_id)
    try:
        product = catalog.update_product(db, product_id, changes)
    except catalog.DuplicateSku:
        raise _sku_taken(changes.get("sku")) from None
    if product is None:
        raise HTTPException(404, "Product not found.")

    if "image_id" in changes and previous_image and previous_image != changes["image_id"]:
        delete_image(settings.media_dir, previous_image)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: DbDep, settings: SettingsDep) -> Response:
    image_ids = catalog.delete_products(db, [product_id])
    if not image_ids:
        raise HTTPException(404, "Product not found.")
    delete_image(settings.media_dir, image_ids[0])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
