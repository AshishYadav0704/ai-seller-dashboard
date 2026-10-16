import csv
import io

from app.media import image_paths


def test_create_assigns_a_readable_sku_and_defaults_to_draft(create_product):
    product = create_product()
    assert product["sku"] == f"KIT-{product['id']:04d}"
    assert product["status"] == "draft"
    assert product["tags"] == []
    assert product["image"] is None


def test_create_round_trips_every_field(client, upload):
    ref = upload()
    body = {
        "title": "  Olive   canvas tote  ",
        "category": "accessories",
        "description": "Roomy tote with an inner pocket.",
        "tags": ["Tote Bag", "#canvas", "tote bag", ""],
        "attributes": [{"name": "Colour", "value": "olive"}],
        "price": 1299.5,
        "stock": 12,
        "sku": "tote-olive-01",
        "status": "published",
        "image_id": ref["id"],
    }
    product = client.post("/api/products", json=body).json()

    assert product["title"] == "Olive canvas tote"
    assert product["tags"] == ["tote bag", "canvas"]
    assert product["price"] == 1299.5
    assert product["stock"] == 12
    assert product["sku"] == "TOTE-OLIVE-01"
    assert product["image"]["url"] == ref["url"]
    assert client.get(f"/api/products/{product['id']}").json() == product


def test_create_validates_input(client):
    cases = [
        {"title": "Mug", "category": "spaceships"},
        {"title": "", "category": "kitchen"},
        {"title": "Mug", "category": "kitchen", "price": -1},
        {"title": "Mug", "category": "kitchen", "sku": "has spaces"},
        {"title": "Mug", "category": "kitchen", "status": "sold"},
    ]
    for body in cases:
        assert client.post("/api/products", json=body).status_code == 422, body


def test_create_with_missing_photo_is_rejected(client):
    response = client.post("/api/products", json={"title": "Mug", "category": "kitchen", "image_id": "a" * 32})
    assert response.status_code == 422


def test_duplicate_sku_is_a_conflict(client, create_product):
    create_product(sku="MUG-1")
    response = client.post("/api/products", json={"title": "Other", "category": "kitchen", "sku": "mug-1"})
    assert response.status_code == 409
    assert "MUG-1" in response.json()["detail"]


def test_list_filters_and_sorts(client, create_product):
    create_product(title="Brass table lamp", category="home-decor", price=2400, status="published")
    create_product(title="Linen cushion cover", category="home-decor", price=650, tags=["linen"])
    create_product(title="Steel water bottle", category="kitchen", price=899, status="published")

    def titles(**params):
        return [p["title"] for p in client.get("/api/products", params=params).json()["items"]]

    assert titles(category="home-decor", sort="price_asc") == ["Linen cushion cover", "Brass table lamp"]
    assert titles(status="published", sort="title") == ["Brass table lamp", "Steel water bottle"]
    assert titles(q="LINEN") == ["Linen cushion cover"]
    assert titles(q="dec-") == ["Linen cushion cover", "Brass table lamp"]  # matches SKU prefix

    page = client.get("/api/products", params={"limit": 2, "sort": "oldest"}).json()
    assert page["total"] == 3
    assert [p["title"] for p in page["items"]] == ["Brass table lamp", "Linen cushion cover"]


def test_patch_only_changes_sent_fields(client, create_product):
    product = create_product(price=500, stock=3, description="Original")
    response = client.patch(f"/api/products/{product['id']}", json={"price": None, "status": "published"})

    updated = response.json()
    assert updated["price"] is None
    assert updated["status"] == "published"
    assert updated["stock"] == 3
    assert updated["description"] == "Original"
    assert updated["updated_at"] >= product["updated_at"]


def test_patch_cannot_blank_required_fields(client, create_product):
    product = create_product()
    assert client.patch(f"/api/products/{product['id']}", json={"title": None}).status_code == 422


def test_patch_saves_marketing_copy(client, create_product):
    product = create_product()
    kit = {
        "instagram_caption": "New mug, who dis",
        "hashtags": ["mugs"],
        "seo_title": "Stoneware mug",
        "seo_description": "A stoneware mug.",
        "whatsapp_message": "*New:* stoneware mug",
    }
    updated = client.patch(f"/api/products/{product['id']}", json={"marketing": kit}).json()
    assert updated["marketing"] == kit


def test_replacing_a_photo_deletes_the_old_files(client, settings, upload, create_product):
    first, second = upload(), upload()
    product = create_product(image_id=first["id"])

    client.patch(f"/api/products/{product['id']}", json={"image_id": second["id"]})

    assert not image_paths(settings.media_dir, first["id"])[0].exists()
    assert image_paths(settings.media_dir, second["id"])[0].exists()


def test_delete_removes_row_and_photo(client, settings, upload, create_product):
    ref = upload()
    product = create_product(image_id=ref["id"])

    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get(f"/api/products/{product['id']}").status_code == 404
    assert not any(path.exists() for path in image_paths(settings.media_dir, ref["id"]))
    assert client.delete(f"/api/products/{product['id']}").status_code == 404


def test_bulk_publish_and_delete(client, create_product):
    ids = [create_product(title=f"Item {n}")["id"] for n in range(3)]

    published = client.post("/api/products/bulk", json={"ids": ids[:2], "action": "publish"}).json()
    assert published == {"action": "publish", "affected": 2}

    again = client.post("/api/products/bulk", json={"ids": ids, "action": "publish"}).json()
    assert again["affected"] == 1  # the first two were already published

    deleted = client.post("/api/products/bulk", json={"ids": [*ids, 9999], "action": "delete"}).json()
    assert deleted == {"action": "delete", "affected": 3}
    assert client.get("/api/products").json()["total"] == 0


def test_csv_export(client, upload, create_product):
    create_product(title='=HYPERLINK("http://evil")', price=10, image_id=upload()["id"])
    create_product(title="Plain mug", tags=["mug", "stoneware"], stock=4)

    response = client.get("/api/products/export.csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    text = response.content.decode("utf-8")
    assert text.startswith("﻿")

    rows = list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))
    assert [row["Title"] for row in rows] == ['\'=HYPERLINK("http://evil")', "Plain mug"]
    assert rows[0]["Price"] == "10.00"
    assert rows[0]["Image URL"].startswith("http://testserver/media/")
    assert rows[1]["Tags"] == "mug, stoneware"
    assert rows[1]["Category"] == "Kitchen & dining"
