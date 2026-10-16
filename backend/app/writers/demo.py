"""Offline writer used when no Gemini key is configured.

It can't see the product, so it works from two signals it does have: the
dominant colour of the photo and any useful words in the file name. The output
is clearly a starting point, which is exactly how the UI presents it.
"""

from __future__ import annotations

import re

from PIL import Image

from ..categories import category_label
from ..media import dominant_colour
from ..schemas import Attribute, ListingDraft, MarketingKit, MarketingRequest
from . import clean_kit

# keyword in file name -> (category slug, noun used in the title)
KEYWORDS: dict[str, tuple[str, str]] = {
    "sneaker": ("mens-footwear", "sneakers"),
    "shoe": ("mens-footwear", "shoes"),
    "loafer": ("mens-footwear", "loafers"),
    "boot": ("mens-footwear", "boots"),
    "heel": ("womens-footwear", "heels"),
    "sandal": ("womens-footwear", "sandals"),
    "flats": ("womens-footwear", "flats"),
    "shirt": ("apparel", "shirt"),
    "tshirt": ("apparel", "t-shirt"),
    "tee": ("apparel", "t-shirt"),
    "kurta": ("apparel", "kurta"),
    "dress": ("apparel", "dress"),
    "hoodie": ("apparel", "hoodie"),
    "jacket": ("apparel", "jacket"),
    "saree": ("apparel", "saree"),
    "polo": ("apparel", "polo shirt"),
    "sweatshirt": ("apparel", "sweatshirt"),
    "beanie": ("apparel", "beanie"),
    "cap": ("accessories", "cap"),
    "belt": ("accessories", "belt"),
    "bag": ("accessories", "bag"),
    "tote": ("accessories", "tote bag"),
    "backpack": ("accessories", "backpack"),
    "wallet": ("accessories", "wallet"),
    "watch": ("accessories", "watch"),
    "sunglass": ("accessories", "sunglasses"),
    "ring": ("jewellery", "ring"),
    "necklace": ("jewellery", "necklace"),
    "earring": ("jewellery", "earrings"),
    "bracelet": ("jewellery", "bracelet"),
    "serum": ("beauty", "serum"),
    "cream": ("beauty", "cream"),
    "lipstick": ("beauty", "lipstick"),
    "perfume": ("beauty", "perfume"),
    "soap": ("beauty", "soap bar"),
    "headphone": ("electronics", "headphones"),
    "earbud": ("electronics", "earbuds"),
    "speaker": ("electronics", "speaker"),
    "keyboard": ("electronics", "keyboard"),
    "mouse": ("electronics", "mouse"),
    "camera": ("electronics", "camera"),
    "charger": ("electronics", "charger"),
    "kettle": ("home-appliances", "electric kettle"),
    "toaster": ("home-appliances", "toaster"),
    "mixer": ("home-appliances", "mixer grinder"),
    "fan": ("home-appliances", "fan"),
    "mug": ("kitchen", "mug"),
    "cup": ("kitchen", "cup"),
    "coffee": ("kitchen", "coffee cup"),
    "bowl": ("kitchen", "bowl"),
    "plate": ("kitchen", "plate"),
    "bottle": ("kitchen", "bottle"),
    "lamp": ("home-decor", "lamp"),
    "vase": ("home-decor", "vase"),
    "candle": ("home-decor", "candle"),
    "cushion": ("home-decor", "cushion cover"),
    "planter": ("home-decor", "planter"),
    "clock": ("home-decor", "wall clock"),
    "pennant": ("home-decor", "pennant flag"),
    "chair": ("furniture", "chair"),
    "stool": ("furniture", "stool"),
    "table": ("furniture", "table"),
    "shelf": ("furniture", "shelf"),
    "yoga": ("sports", "yoga mat"),
    "dumbbell": ("sports", "dumbbell"),
    "racket": ("sports", "racket"),
    "football": ("sports", "football"),
    "toy": ("toys", "toy"),
    "puzzle": ("toys", "puzzle"),
    "teddy": ("toys", "teddy bear"),
}


def _match_keyword(filename: str | None) -> tuple[str, str] | None:
    if not filename:
        return None
    words = re.split(r"[^a-z]+", filename.lower().rsplit(".", 1)[0])
    for word in words:
        for keyword, match in KEYWORDS.items():
            if word.startswith(keyword):
                return match
    return None


class DemoWriter:
    source = "demo"
    model = None

    async def draft_listing(self, image: Image.Image, filename: str | None) -> ListingDraft:
        colour = dominant_colour(image)
        category, noun = _match_keyword(filename) or ("other", "product")
        label = category_label(category).lower()

        return ListingDraft(
            title=f"{colour.capitalize()} {noun}",
            category=category,
            description=(
                f"A {colour} {noun} for your {label} range. "
                "This draft was written in demo mode from the photo's colours and file name, "
                "so add the material, size and finish before you publish."
            ),
            tags=[f"{colour} {noun}", noun, label, f"{colour} {label}"],
            attributes=[Attribute(name="Colour", value=colour)],
        )

    async def marketing_kit(self, request: MarketingRequest) -> MarketingKit:
        title = request.title
        label = category_label(request.category).lower()
        openers = {
            "warm": f"Say hello to our {title.lower()}.",
            "premium": f"{title}. Considered, and made to last.",
            "playful": f"Plot twist: your {label} shelf just got better. 👀",
            "minimal": f"{title}. Now available.",
        }
        first_sentence = request.description.split(". ")[0].strip().rstrip(".")
        lines = [openers[request.tone], f"{first_sentence}." if first_sentence else "", "Tap the link in bio to order."]
        caption = "\n".join(line for line in lines if line)
        hashtag_seed = [*request.tags, label, "shopsmall", "newarrivals", "supportlocal"]
        return clean_kit(
            {
                "instagram_caption": caption,
                "hashtags": hashtag_seed,
                "seo_title": f"{title} | Shop {label.capitalize()}",
                "seo_description": f"{title}. {request.description}",
                "whatsapp_message": f"*New in:* {title}. Reply to this message to order or ask a question.",
            }
        )
