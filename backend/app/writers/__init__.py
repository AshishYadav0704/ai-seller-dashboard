"""Listing writers turn a photo into a draft listing and a draft into marketing copy.

There are two implementations with the same interface: ``GeminiWriter`` calls
the Gemini API, ``DemoWriter`` works offline so the app can be run and tested
without an API key.
"""

from __future__ import annotations

from typing import Any, Protocol

from PIL import Image

from ..categories import normalize_category
from ..config import Settings
from ..schemas import Attribute, ListingDraft, MarketingKit, MarketingRequest, clean_tags


class WriterError(Exception):
    """A failure that should reach the user with a specific status and message."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class ListingWriter(Protocol):
    source: str
    model: str | None

    async def draft_listing(self, image: Image.Image, filename: str | None) -> ListingDraft: ...

    async def marketing_kit(self, request: MarketingRequest) -> MarketingKit: ...


def build_writer(settings: Settings) -> ListingWriter:
    if settings.ai_mode == "gemini":
        from .gemini import GeminiWriter

        assert settings.gemini_api_key
        return GeminiWriter(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            timeout_seconds=settings.ai_timeout_seconds,
        )

    from .demo import DemoWriter

    return DemoWriter()


def _shorten(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(",;:-")
    return cut + "…"


def clean_draft(raw: dict[str, Any]) -> ListingDraft:
    """Normalise model output so the rest of the app can trust its shape."""
    attributes: list[Attribute] = []
    for item in raw.get("attributes") or []:
        if not isinstance(item, dict):
            continue
        name, value = str(item.get("name", "")).strip(), str(item.get("value", "")).strip()
        if name and value:
            attributes.append(Attribute(name=_shorten(name, 30).capitalize(), value=_shorten(value, 80)))

    title = _shorten(raw.get("title") or "", 90) or "Untitled product"
    return ListingDraft(
        title=title,
        category=normalize_category(raw.get("category")),
        description=_shorten(raw.get("description") or "", 1200),
        tags=clean_tags([str(tag) for tag in raw.get("tags") or []])[:10],
        attributes=attributes[:6],
    )


def clean_kit(raw: dict[str, Any]) -> MarketingKit:
    hashtags = [tag.replace(" ", "") for tag in clean_tags([str(t) for t in raw.get("hashtags") or []])]
    return MarketingKit(
        instagram_caption=str(raw.get("instagram_caption") or "").strip()[:2200],
        hashtags=hashtags[:12],
        seo_title=_shorten(raw.get("seo_title") or "", 60),
        seo_description=_shorten(raw.get("seo_description") or "", 155),
        whatsapp_message=str(raw.get("whatsapp_message") or "").strip()[:700],
    )
