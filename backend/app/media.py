"""Product photo handling: validation, normalisation and storage on disk.

Every upload is stored twice as WebP: a large copy for the detail view and a
small thumbnail for the catalog grid. Files are named by a random hex id, so
the id is the only thing the database needs to keep.
"""

from __future__ import annotations

import io
import logging
import re
import time
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .schemas import ImageRef

log = logging.getLogger(__name__)

ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP", "MPO"}
FULL_SIZE = 1600
THUMB_SIZE = 480
AI_SIZE = 1024

# A 40 MP cap still allows any phone camera but refuses decompression bombs.
Image.MAX_IMAGE_PIXELS = 40_000_000

_IMAGE_ID = re.compile(r"^[0-9a-f]{32}$")


class ImageRejected(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def load_image(data: bytes) -> Image.Image:
    """Decode an upload into an upright RGB image, or raise ImageRejected."""
    if not data:
        raise ImageRejected(400, "The file is empty.")
    try:
        image = Image.open(io.BytesIO(data))
        image_format = image.format
        image.load()
    except Image.DecompressionBombError as exc:
        raise ImageRejected(413, "That image is too large. Keep it under 40 megapixels.") from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageRejected(415, "That file isn't an image we can read. Use JPG, PNG or WebP.") from exc

    if image_format not in ACCEPTED_FORMATS:
        raise ImageRejected(415, f"{image_format} images aren't supported. Use JPG, PNG or WebP.")

    # Phone photos usually carry their rotation in EXIF rather than in the pixels.
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def _resized(image: Image.Image, max_side: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    return copy


def is_valid_image_id(image_id: str) -> bool:
    return bool(_IMAGE_ID.match(image_id))


def image_paths(media_dir: Path, image_id: str) -> tuple[Path, Path]:
    return media_dir / f"{image_id}.webp", media_dir / f"{image_id}_thumb.webp"


def image_exists(media_dir: Path, image_id: str) -> bool:
    return is_valid_image_id(image_id) and image_paths(media_dir, image_id)[0].exists()


def image_ref(image_id: str) -> ImageRef:
    return ImageRef(
        id=image_id,
        url=f"/media/{image_id}.webp",
        thumb_url=f"/media/{image_id}_thumb.webp",
    )


def store_image(image: Image.Image, media_dir: Path) -> str:
    media_dir.mkdir(parents=True, exist_ok=True)
    image_id = uuid.uuid4().hex
    full_path, thumb_path = image_paths(media_dir, image_id)
    _resized(image, FULL_SIZE).save(full_path, "WEBP", quality=84, method=4)
    _resized(image, THUMB_SIZE).save(thumb_path, "WEBP", quality=78, method=4)
    return image_id


def delete_image(media_dir: Path, image_id: str | None) -> None:
    if not image_id or not is_valid_image_id(image_id):
        return
    for path in image_paths(media_dir, image_id):
        path.unlink(missing_ok=True)


def jpeg_for_model(image: Image.Image) -> bytes:
    """A smaller JPEG for the vision model. Detail beyond ~1024px doesn't help it."""
    buffer = io.BytesIO()
    _resized(image, AI_SIZE).save(buffer, "JPEG", quality=85)
    return buffer.getvalue()


def prune_orphans(media_dir: Path, keep: set[str], older_than_seconds: int = 24 * 3600) -> int:
    """Delete uploads that were analysed but never saved to a product."""
    if not media_dir.exists():
        return 0
    cutoff = time.time() - older_than_seconds
    removed = 0
    for path in media_dir.glob("*_thumb.webp"):
        image_id = path.name.removesuffix("_thumb.webp")
        if image_id in keep or path.stat().st_mtime > cutoff:
            continue
        delete_image(media_dir, image_id)
        removed += 1
    if removed:
        log.info("Removed %d unused uploads", removed)
    return removed


# Named colours used to describe a photo in demo mode. Deliberately coarse:
# sellers say "navy" or "olive", not "#3b4a5c".
_COLOUR_NAMES: list[tuple[str, tuple[int, int, int]]] = [
    ("black", (25, 25, 25)),
    ("charcoal", (64, 64, 64)),
    ("grey", (128, 128, 128)),
    ("silver", (192, 192, 192)),
    ("white", (245, 245, 245)),
    ("cream", (238, 228, 200)),
    ("beige", (205, 185, 150)),
    ("tan", (180, 140, 95)),
    ("brown", (110, 70, 40)),
    ("maroon", (110, 25, 35)),
    ("red", (200, 40, 40)),
    ("coral", (240, 120, 100)),
    ("peach", (245, 190, 160)),
    ("pink", (235, 150, 180)),
    ("orange", (235, 130, 40)),
    ("mustard", (210, 170, 40)),
    ("yellow", (240, 215, 60)),
    ("olive", (115, 120, 50)),
    ("green", (60, 140, 70)),
    ("forest green", (30, 80, 50)),
    ("sage", (150, 170, 140)),
    ("mint", (160, 215, 190)),
    ("teal", (30, 128, 128)),
    ("sky blue", (120, 180, 230)),
    ("powder blue", (176, 208, 230)),
    ("blue", (40, 90, 190)),
    ("navy", (25, 35, 80)),
    ("purple", (110, 60, 150)),
    ("lavender", (180, 160, 220)),
]


def _distance(a: tuple[int, ...], b: tuple[int, ...]) -> int:
    return sum((x - y) ** 2 for x, y in zip(a, b, strict=True))


def _backdrop(image: Image.Image) -> tuple[int, int, int]:
    """Median colour of the outer frame, which is almost always backdrop in a product shot."""
    small = image.resize((32, 32))
    edge = [small.getpixel((x, y)) for x in range(32) for y in (0, 31)]
    edge += [small.getpixel((x, y)) for y in range(1, 31) for x in (0, 31)]
    channels = list(zip(*edge, strict=True))
    return tuple(sorted(channel)[len(channel) // 2] for channel in channels)  # type: ignore[return-value]


def dominant_colour(image: Image.Image) -> str:
    """Name the most common colour of the product itself, ignoring the backdrop."""
    width, height = image.size
    centre = image.crop((width // 6, height // 6, width - width // 6, height - height // 6)).resize((64, 64))
    quantised = centre.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = quantised.getpalette() or []
    counts = sorted(quantised.getcolors() or [], reverse=True)
    backdrop = _backdrop(image)

    def nearest(rgb: tuple[int, ...]) -> str:
        return min(_COLOUR_NAMES, key=lambda named: _distance(rgb, named[1]))[0]

    for _, index in counts:
        rgb = tuple(palette[index * 3 : index * 3 + 3])
        if _distance(rgb, backdrop) > 40**2:
            return nearest(rgb)
    # Nothing stands out from the backdrop, so the backdrop is probably the product.
    return nearest(backdrop)
