"""Photo uploads and the two AI-assisted steps: drafting a listing and writing launch copy."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from PIL import Image
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ..config import Settings
from ..deps import SettingsDep, WriterDep
from ..media import ImageRejected, image_exists, image_paths, image_ref, load_image, store_image
from ..schemas import DraftResponse, ImageRef, MarketingRequest, MarketingResponse

router = APIRouter(tags=["ai"])


@router.post("/uploads", response_model=ImageRef, status_code=status.HTTP_201_CREATED)
async def upload_photo(settings: SettingsDep, file: UploadFile = File(...)) -> ImageRef:
    # Read one byte past the limit so oversized files are refused without
    # buffering the whole thing.
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise ImageRejected(413, f"Photos can be up to {settings.max_upload_mb} MB.")
    image = await run_in_threadpool(load_image, data)
    image_id = await run_in_threadpool(store_image, image, settings.media_dir)
    return image_ref(image_id)


class DraftRequest(BaseModel):
    image_id: str
    filename: str | None = Field(default=None, max_length=255)


def _open_stored(settings: Settings, image_id: str) -> Image.Image:
    full_path, _ = image_paths(settings.media_dir, image_id)
    with Image.open(full_path) as stored:
        return stored.convert("RGB")


@router.post("/ai/listing", response_model=DraftResponse)
async def draft_listing(body: DraftRequest, settings: SettingsDep, writer: WriterDep) -> DraftResponse:
    if not image_exists(settings.media_dir, body.image_id):
        raise HTTPException(404, "That photo is no longer on the server. Upload it again.")
    image = await run_in_threadpool(_open_stored, settings, body.image_id)
    draft = await writer.draft_listing(image, body.filename)
    return DraftResponse(image=image_ref(body.image_id), draft=draft, source=writer.source)  # type: ignore[arg-type]


@router.post("/ai/marketing", response_model=MarketingResponse)
async def marketing_kit(body: MarketingRequest, writer: WriterDep) -> MarketingResponse:
    kit = await writer.marketing_kit(body)
    return MarketingResponse(kit=kit, source=writer.source)  # type: ignore[arg-type]
