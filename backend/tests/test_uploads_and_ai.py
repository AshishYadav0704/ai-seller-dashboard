import io
import os

from PIL import Image

from app.media import image_paths, prune_orphans

from .conftest import make_image


def test_health_and_meta(client):
    assert client.get("/api/health").json() == {"status": "ok"}

    meta = client.get("/api/meta").json()
    assert meta["ai_mode"] == "demo"
    assert meta["max_upload_mb"] == 1
    slugs = [c["slug"] for c in meta["categories"]]
    assert "kitchen" in slugs and slugs[-1] == "other"


def test_upload_stores_full_image_and_thumbnail(client, settings, upload):
    ref = upload(make_image(size=(2400, 1800)))

    full, thumb = image_paths(settings.media_dir, ref["id"])
    with Image.open(full) as stored_full, Image.open(thumb) as stored_thumb:
        assert stored_full.format == "WEBP"
        assert max(stored_full.size) == 1600
        assert max(stored_thumb.size) == 480

    response = client.get(ref["thumb_url"])
    assert response.status_code == 200
    assert "immutable" in response.headers["cache-control"]


def test_upload_rejects_files_that_are_not_images(client):
    response = client.post("/api/uploads", files={"file": ("notes.txt", b"hello there", "text/plain")})
    assert response.status_code == 415
    assert "JPG, PNG or WebP" in response.json()["detail"]


def test_upload_rejects_files_over_the_limit(client):
    too_big = os.urandom(1024 * 1024 + 10)
    response = client.post("/api/uploads", files={"file": ("big.jpg", too_big, "image/jpeg")})
    assert response.status_code == 413


def test_transparent_png_is_flattened_onto_white(settings, upload):
    ref = upload(make_image(mode="RGBA", fmt="PNG", colour=(200, 40, 40)), filename="logo.png")
    with Image.open(image_paths(settings.media_dir, ref["id"])[0]) as stored:
        assert stored.mode == "RGB"
        r, g, b = stored.getpixel((2, 2))
        assert min(r, g, b) > 240


def test_exif_rotation_is_applied(settings, upload):
    image = Image.new("RGB", (400, 200), (90, 90, 90))
    exif = image.getexif()
    exif[0x0112] = 6  # "rotate 90° clockwise", what most phones write in portrait mode
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=exif)

    ref = upload(buffer.getvalue())
    with Image.open(image_paths(settings.media_dir, ref["id"])[0]) as stored:
        assert stored.size == (200, 400)


def test_demo_listing_uses_file_name_and_colour(client, upload):
    ref = upload(make_image(colour=(115, 120, 50)))
    response = client.post("/api/ai/listing", json={"image_id": ref["id"], "filename": "canvas-tote_v2.JPG"})

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "demo"
    assert body["image"]["id"] == ref["id"]
    assert body["draft"]["category"] == "accessories"
    assert body["draft"]["title"] == "Olive tote bag"
    assert {"name": "Colour", "value": "olive"} in body["draft"]["attributes"]


def test_listing_for_unknown_photo_is_404(client):
    response = client.post("/api/ai/listing", json={"image_id": "0" * 32})
    assert response.status_code == 404


def test_demo_marketing_kit_respects_seo_limits(client):
    response = client.post(
        "/api/ai/marketing",
        json={
            "title": "Hand-thrown stoneware mug",
            "category": "kitchen",
            "description": "A heavy, speckled mug that keeps chai hot. " * 8,
            "tags": ["stoneware mug", "#Handmade"],
            "tone": "premium",
        },
    )
    assert response.status_code == 200
    kit = response.json()["kit"]
    assert len(kit["seo_title"]) <= 60
    assert len(kit["seo_description"]) <= 155
    assert all("#" not in tag and " " not in tag for tag in kit["hashtags"])
    assert "handmade" in kit["hashtags"]


def test_marketing_rejects_unknown_category(client):
    response = client.post("/api/ai/marketing", json={"title": "Mug", "category": "spaceships"})
    assert response.status_code == 422


def test_prune_orphans_keeps_recent_and_referenced_uploads(settings, upload):
    kept = upload()["id"]
    orphan = upload()["id"]
    fresh = upload()["id"]
    old = 1_000_000_000
    for image_id in (kept, orphan):
        for path in image_paths(settings.media_dir, image_id):
            os.utime(path, (old, old))

    removed = prune_orphans(settings.media_dir, keep={kept})

    assert removed == 1
    assert image_paths(settings.media_dir, kept)[0].exists()
    assert not image_paths(settings.media_dir, orphan)[0].exists()
    assert image_paths(settings.media_dir, fresh)[0].exists()
