"""Runtime settings, read once from the environment (and backend/.env if present)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def _flag(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _origins(value: str | None) -> list[str]:
    if not value:
        return list(DEFAULT_ORIGINS)
    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"
    force_demo: bool = False
    allowed_origins: list[str] = field(default_factory=lambda: list(DEFAULT_ORIGINS))
    max_upload_mb: int = 8
    ai_timeout_seconds: float = 45.0

    @property
    def database_path(self) -> Path:
        return self.data_dir / "shelfwise.db"

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def ai_mode(self) -> str:
        """Use Gemini when a key is configured, otherwise fall back to the offline demo writer."""
        if self.gemini_api_key and not self.force_demo:
            return "gemini"
        return "demo"

    @classmethod
    def from_env(cls) -> Settings:
        load_dotenv(BACKEND_DIR / ".env")
        return cls(
            data_dir=Path(os.getenv("DATA_DIR") or BACKEND_DIR / "data"),
            gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
            gemini_model=os.getenv("GEMINI_MODEL") or cls.gemini_model,
            force_demo=_flag(os.getenv("DEMO_MODE")),
            allowed_origins=_origins(os.getenv("ALLOWED_ORIGINS")),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB") or cls.max_upload_mb),
            ai_timeout_seconds=float(os.getenv("AI_TIMEOUT_SECONDS") or cls.ai_timeout_seconds),
        )
