from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from google import genai
from google.genai import errors, types
from PIL import Image

from ..categories import category_label
from ..media import jpeg_for_model
from ..schemas import ListingDraft, MarketingKit, MarketingRequest
from . import WriterError, clean_draft, clean_kit
from .prompts import (
    LISTING_INSTRUCTIONS,
    MARKETING_INSTRUCTIONS,
    listing_prompt,
    listing_schema,
    marketing_prompt,
    marketing_schema,
)

log = logging.getLogger(__name__)

# Transient statuses worth retrying. 429 is included because the free tier
# rate-limits per minute, and a short back-off is usually enough.
RETRY_STATUSES = [429, 500, 502, 503, 504]


class GeminiWriter:
    source = "gemini"

    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        self.model = model
        self._timeout = timeout_seconds
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                retry_options=types.HttpRetryOptions(attempts=3, initial_delay=1.5, http_status_codes=RETRY_STATUSES),
            ),
        )

    async def draft_listing(self, image: Image.Image, filename: str | None) -> ListingDraft:
        photo = types.Part.from_bytes(data=jpeg_for_model(image), mime_type="image/jpeg")
        data = await self._generate_json(
            contents=[photo, listing_prompt(filename[:80] if filename else None)],
            instructions=LISTING_INSTRUCTIONS,
            schema=listing_schema(),
            temperature=0.4,
        )
        if data.get("looks_like_product") is False:
            raise WriterError(422, "This photo doesn't look like a product. Try a clear shot of the item on its own.")
        return clean_draft(data)

    async def marketing_kit(self, request: MarketingRequest) -> MarketingKit:
        prompt = marketing_prompt(
            title=request.title,
            category_label=category_label(request.category),
            description=request.description,
            tags=request.tags,
            tone=request.tone,
        )
        data = await self._generate_json(
            contents=[prompt],
            instructions=MARKETING_INSTRUCTIONS,
            schema=marketing_schema(),
            temperature=0.8,
        )
        return clean_kit(data)

    async def _generate_json(
        self,
        *,
        contents: list[Any],
        instructions: str,
        schema: dict[str, Any],
        temperature: float,
    ) -> dict[str, Any]:
        config = types.GenerateContentConfig(
            system_instruction=instructions,
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=temperature,
        )
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(model=self.model, contents=contents, config=config),
                timeout=self._timeout,
            )
        except TimeoutError as exc:
            raise WriterError(504, "Gemini took too long to answer. Try again in a moment.") from exc
        except errors.APIError as exc:
            log.warning("Gemini API error %s: %s", exc.code, exc.message)
            raise _translate(exc) from exc

        text = response.text
        if not text:
            # Usually a safety block or an empty candidate list.
            log.warning("Gemini returned no text: %s", response.prompt_feedback)
            raise WriterError(422, "Gemini didn't return a listing for this photo. Try a different shot.")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            log.warning("Unparseable Gemini response: %.300s", text)
            raise WriterError(502, "Gemini sent back something we couldn't read. Try again.") from exc
        if not isinstance(data, dict):
            raise WriterError(502, "Gemini sent back something we couldn't read. Try again.")
        return data


def _translate(exc: errors.APIError) -> WriterError:
    message = (exc.message or "").lower()
    if exc.code == 429:
        return WriterError(429, "The Gemini quota for this key is used up for now. Wait a minute and try again.")
    if exc.code in (400, 401, 403) and "api key" in message:
        return WriterError(502, "Gemini rejected the API key. Check GEMINI_API_KEY on the server.")
    if exc.code == 404:
        return WriterError(502, "The configured Gemini model wasn't found. Check GEMINI_MODEL on the server.")
    return WriterError(502, f"Gemini returned an error ({exc.code}). Try again in a moment.")
