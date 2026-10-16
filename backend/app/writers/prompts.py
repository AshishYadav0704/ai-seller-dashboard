"""Prompts and response schemas for the Gemini writer."""

from __future__ import annotations

from typing import Any

from ..categories import CATEGORIES

LISTING_INSTRUCTIONS = """\
You write product listings for independent online sellers. You get one product photo.

Describe only what you can see. Don't invent brand names, sizes, materials,
certifications or claims ("best", "100% genuine") that the photo can't back up.

- title: what a shopper would type into a search box. Max 70 characters,
  sentence case, no emoji, no price, no ALL CAPS.
- category: the single closest slug from the allowed list. Use "other" if
  nothing fits.
- description: 2-3 plain sentences. Say what the item is and who it suits,
  then one concrete detail from the photo (colour, finish, shape, closure).
- tags: 5-8 lowercase search phrases a buyer might use, without '#'.
- attributes: up to 5 visible facts as name/value pairs, e.g. Colour: olive,
  Material: canvas, Pattern: striped.
- looks_like_product: false if the photo doesn't show something sellable
  (a selfie, a screenshot, a landscape). Keep the other fields short then.
"""

MARKETING_INSTRUCTIONS = """\
You write launch copy for a small online shop. Use only the facts in the
listing you are given; don't add discounts, delivery promises or claims.

- instagram_caption: 2-4 short lines and a call to action at the end.
  No hashtags inside the caption.
- hashtags: 6-10 tags without '#', mixing broad and niche ones.
- seo_title: max 60 characters, for the product page <title>.
- seo_description: max 155 characters, for the meta description.
- whatsapp_message: max 300 characters for a broadcast list. WhatsApp
  formatting such as *bold* is fine, once.
"""

TONES = {
    "warm": "Friendly and personal, like a shop owner talking to regulars.",
    "premium": "Understated and confident. Short sentences, no exclamation marks, no emoji.",
    "playful": "Light and a bit witty. One or two emoji at most.",
    "minimal": "Plain and factual, as few words as possible. No emoji.",
}


def listing_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "looks_like_product": {"type": "boolean"},
            "title": {"type": "string"},
            "category": {"type": "string", "enum": list(CATEGORIES)},
            "description": {"type": "string"},
            "tags": {"type": "array", "items": {"type": "string"}},
            "attributes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "value": {"type": "string"},
                    },
                    "required": ["name", "value"],
                },
            },
        },
        "required": ["looks_like_product", "title", "category", "description", "tags", "attributes"],
    }


def marketing_schema() -> dict[str, Any]:
    fields = ["instagram_caption", "seo_title", "seo_description", "whatsapp_message"]
    properties: dict[str, Any] = {name: {"type": "string"} for name in fields}
    properties["hashtags"] = {"type": "array", "items": {"type": "string"}}
    return {"type": "object", "properties": properties, "required": [*fields, "hashtags"]}


def listing_prompt(filename: str | None) -> str:
    allowed = ", ".join(CATEGORIES)
    hint = f'\nThe file was named "{filename}", which may or may not be meaningful.' if filename else ""
    return f"Allowed category slugs: {allowed}.{hint}\nWrite the listing for this photo."


def marketing_prompt(title: str, category_label: str, description: str, tags: list[str], tone: str) -> str:
    return (
        f"Tone: {TONES.get(tone, TONES['warm'])}\n\n"
        f"Product: {title}\n"
        f"Category: {category_label}\n"
        f"Description: {description or '(none)'}\n"
        f"Search tags: {', '.join(tags) or '(none)'}"
    )
