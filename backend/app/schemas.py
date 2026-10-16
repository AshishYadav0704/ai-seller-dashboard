"""Request and response models."""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from .categories import CATEGORIES

Status = Literal["draft", "published", "archived"]
Tone = Literal["warm", "premium", "playful", "minimal"]

MAX_TAGS = 15
_SKU_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$")


def _known_category(value: str) -> str:
    if value not in CATEGORIES:
        raise ValueError(f"unknown category '{value}'")
    return value


def _collapse_whitespace(value: str) -> str:
    return " ".join(value.split())


def clean_tags(values: list[str]) -> list[str]:
    """Lowercase, strip '#', collapse spaces and drop duplicates while keeping order."""
    seen: set[str] = set()
    tags: list[str] = []
    for raw in values:
        tag = _collapse_whitespace(str(raw).lstrip("#").lower())[:32].strip()
        if tag and tag not in seen:
            seen.add(tag)
            tags.append(tag)
    return tags[:MAX_TAGS]


Category = Annotated[str, AfterValidator(_known_category)]
Title = Annotated[str, AfterValidator(_collapse_whitespace), Field(min_length=1, max_length=120)]


class Attribute(BaseModel):
    name: Annotated[str, AfterValidator(_collapse_whitespace), Field(min_length=1, max_length=30)]
    value: Annotated[str, AfterValidator(_collapse_whitespace), Field(min_length=1, max_length=80)]


class MarketingKit(BaseModel):
    instagram_caption: str = Field(max_length=2200)
    hashtags: list[str] = Field(default_factory=list, max_length=30)
    seo_title: str = Field(max_length=70)
    seo_description: str = Field(max_length=170)
    whatsapp_message: str = Field(max_length=700)


class ImageRef(BaseModel):
    id: str
    url: str
    thumb_url: str


class _ProductFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("tags", check_fields=False)
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else clean_tags(value)

    @field_validator("sku", check_fields=False)
    @classmethod
    def _sku(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not _SKU_PATTERN.match(value):
            raise ValueError("SKU can use letters, numbers, '-' and '_' (max 32 characters)")
        return value.upper()


class ProductCreate(_ProductFields):
    title: Title
    category: Category
    description: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=40)
    attributes: list[Attribute] = Field(default_factory=list, max_length=10)
    price: float | None = Field(default=None, ge=0, le=10_000_000)
    stock: int | None = Field(default=None, ge=0, le=1_000_000)
    sku: str | None = None
    status: Status = "draft"
    image_id: str | None = None
    marketing: MarketingKit | None = None


class ProductUpdate(_ProductFields):
    """Partial update. Only the fields present in the request body are changed."""

    title: Title | None = None
    category: Category | None = None
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = Field(default=None, max_length=40)
    attributes: list[Attribute] | None = Field(default=None, max_length=10)
    price: float | None = Field(default=None, ge=0, le=10_000_000)
    stock: int | None = Field(default=None, ge=0, le=1_000_000)
    sku: str | None = None
    status: Status | None = None
    image_id: str | None = None
    marketing: MarketingKit | None = None


class Product(BaseModel):
    id: int
    sku: str | None
    title: str
    category: str
    description: str
    tags: list[str]
    attributes: list[Attribute]
    price: float | None
    stock: int | None
    status: Status
    image: ImageRef | None
    marketing: MarketingKit | None
    created_at: str
    updated_at: str


class ProductPage(BaseModel):
    items: list[Product]
    total: int


class BulkAction(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)
    action: Literal["publish", "draft", "archive", "delete"]


class BulkResult(BaseModel):
    action: str
    affected: int


class ListingDraft(BaseModel):
    title: str
    category: str
    description: str
    tags: list[str]
    attributes: list[Attribute]


class DraftResponse(BaseModel):
    image: ImageRef
    draft: ListingDraft
    source: Literal["gemini", "demo"]


class MarketingRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Title
    category: Category
    description: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=40)
    tone: Tone = "warm"


class MarketingResponse(BaseModel):
    kit: MarketingKit
    source: Literal["gemini", "demo"]


class CategoryOption(BaseModel):
    slug: str
    label: str


class Meta(BaseModel):
    version: str
    ai_mode: Literal["gemini", "demo"]
    model: str | None
    max_upload_mb: int
    categories: list[CategoryOption]
