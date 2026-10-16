from fastapi import APIRouter

from .. import __version__
from ..categories import CATEGORIES
from ..deps import SettingsDep, WriterDep
from ..schemas import CategoryOption, Meta

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta", response_model=Meta)
def meta(settings: SettingsDep, writer: WriterDep) -> Meta:
    return Meta(
        version=__version__,
        ai_mode=writer.source,  # type: ignore[arg-type]
        model=writer.model,
        max_upload_mb=settings.max_upload_mb,
        categories=[CategoryOption(slug=slug, label=label) for slug, (label, _) in CATEGORIES.items()],
    )
