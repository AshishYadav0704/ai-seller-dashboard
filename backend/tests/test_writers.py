import asyncio
import json
from types import SimpleNamespace

import pytest
from google.genai import errors
from PIL import Image

from app.writers import WriterError, clean_draft, clean_kit
from app.writers.gemini import GeminiWriter


def test_clean_draft_normalises_model_output():
    draft = clean_draft(
        {
            "title": "  Men's   running shoes with a breathable knit upper and cushioned sole for daily runs  ",
            "category": "Mens Footwear",
            "description": "Light.\n\nComfortable.",
            "tags": ["Running Shoes", "#running shoes", "sneakers", 42],
            "attributes": [{"name": "colour", "value": "navy"}, {"name": "", "value": "x"}, "junk"],
        }
    )
    assert draft.category == "mens-footwear"
    assert draft.title.startswith("Men's running shoes")
    assert len(draft.title) <= 90
    assert draft.description == "Light. Comfortable."
    assert draft.tags == ["running shoes", "sneakers", "42"]
    assert [(a.name, a.value) for a in draft.attributes] == [("Colour", "navy")]


def test_clean_draft_falls_back_for_unknown_category_and_missing_title():
    draft = clean_draft({"category": "spaceships"})
    assert draft.category == "other"
    assert draft.title == "Untitled product"


def test_clean_kit_trims_to_seo_limits():
    kit = clean_kit(
        {
            "instagram_caption": "Hello",
            "hashtags": ["#Home Decor", "decor", "decor"],
            "seo_title": "word " * 30,
            "seo_description": "word " * 60,
            "whatsapp_message": "Hi",
        }
    )
    assert kit.hashtags == ["homedecor", "decor"]
    assert len(kit.seo_title) <= 60 and kit.seo_title.endswith("…")
    assert len(kit.seo_description) <= 155


class FakeModels:
    def __init__(self, result):
        self.result = result

    async def generate_content(self, **kwargs):
        if isinstance(self.result, Exception):
            raise self.result
        return SimpleNamespace(text=self.result, prompt_feedback=None)


def gemini_with(result) -> GeminiWriter:
    writer = GeminiWriter(api_key="test-key", model="test-model", timeout_seconds=5)
    writer._client = SimpleNamespace(aio=SimpleNamespace(models=FakeModels(result)))
    return writer


def draft(writer: GeminiWriter):
    return asyncio.run(writer.draft_listing(Image.new("RGB", (64, 64)), "photo.jpg"))


def test_gemini_writer_parses_structured_output():
    payload = {
        "looks_like_product": True,
        "title": "Brass table lamp",
        "category": "home-decor",
        "description": "A brass lamp.",
        "tags": ["brass lamp"],
        "attributes": [{"name": "Finish", "value": "brushed brass"}],
    }
    result = draft(gemini_with(json.dumps(payload)))
    assert result.title == "Brass table lamp"
    assert result.category == "home-decor"


def test_gemini_writer_refuses_non_product_photos():
    payload = {
        "looks_like_product": False,
        "title": "",
        "category": "other",
        "description": "",
        "tags": [],
        "attributes": [],
    }
    with pytest.raises(WriterError) as caught:
        draft(gemini_with(json.dumps(payload)))
    assert caught.value.status_code == 422


@pytest.mark.parametrize(
    ("result", "status"),
    [
        ("not json", 502),
        ("", 422),
        (errors.ClientError(429, {"error": {"message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}}), 429),
        (errors.ClientError(400, {"error": {"message": "API key not valid.", "status": "INVALID_ARGUMENT"}}), 502),
        (errors.ServerError(503, {"error": {"message": "Overloaded", "status": "UNAVAILABLE"}}), 502),
    ],
)
def test_gemini_writer_turns_failures_into_clear_errors(result, status):
    with pytest.raises(WriterError) as caught:
        draft(gemini_with(result))
    assert caught.value.status_code == status
