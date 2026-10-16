"""The fixed category list. Slugs are stored in the database; labels are for people."""

from __future__ import annotations

# slug -> (label, SKU prefix)
CATEGORIES: dict[str, tuple[str, str]] = {
    "mens-footwear": ("Men's footwear", "MFW"),
    "womens-footwear": ("Women's footwear", "WFW"),
    "apparel": ("Apparel", "APP"),
    "accessories": ("Bags & accessories", "ACC"),
    "jewellery": ("Jewellery", "JWL"),
    "beauty": ("Beauty & personal care", "BTY"),
    "electronics": ("Electronics", "ELC"),
    "home-appliances": ("Home appliances", "HAP"),
    "kitchen": ("Kitchen & dining", "KIT"),
    "home-decor": ("Home decor", "DEC"),
    "furniture": ("Furniture", "FUR"),
    "sports": ("Sports & fitness", "SPT"),
    "toys": ("Toys & kids", "TOY"),
    "other": ("Other", "OTH"),
}

# Values written by the first version of the app, before categories had slugs.
LEGACY_CATEGORY_NAMES = {
    "mens footwear": "mens-footwear",
    "womens footwear": "womens-footwear",
    "electronics": "electronics",
    "home appliances": "home-appliances",
    "furniture": "furniture",
    "apparel": "apparel",
}


def category_label(slug: str) -> str:
    return CATEGORIES.get(slug, CATEGORIES["other"])[0]


def sku_prefix(slug: str) -> str:
    return CATEGORIES.get(slug, CATEGORIES["other"])[1]


def normalize_category(value: str | None) -> str:
    """Best-effort mapping of free text (old rows, model output) onto a known slug."""
    if not value:
        return "other"
    cleaned = value.strip().lower()
    if cleaned in CATEGORIES:
        return cleaned
    if cleaned in LEGACY_CATEGORY_NAMES:
        return LEGACY_CATEGORY_NAMES[cleaned]
    slugged = cleaned.replace("'", "").replace("&", "and").replace(" ", "-")
    if slugged in CATEGORIES:
        return slugged
    for slug, (label, _) in CATEGORIES.items():
        if cleaned == label.lower():
            return slug
    return "other"
