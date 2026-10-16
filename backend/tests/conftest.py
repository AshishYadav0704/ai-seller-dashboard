from __future__ import annotations

import io
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app


def make_image(
    colour: tuple[int, int, int] = (40, 90, 60),
    size: tuple[int, int] = (640, 480),
    fmt: str = "JPEG",
    mode: str = "RGB",
) -> bytes:
    """A plain image with a contrasting border, roughly how a product shot on a backdrop looks."""
    image = Image.new(mode, size, (250, 250, 250) if mode == "RGB" else (250, 250, 250, 255))
    inner = Image.new(mode, (size[0] // 2, size[1] // 2), colour if mode == "RGB" else (*colour, 255))
    image.paste(inner, (size[0] // 4, size[1] // 4))
    buffer = io.BytesIO()
    image.save(buffer, fmt)
    return buffer.getvalue()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path / "data", force_demo=True, max_upload_mb=1)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def upload(client: TestClient) -> Callable[..., dict[str, Any]]:
    def _upload(data: bytes | None = None, filename: str = "product.jpg") -> dict[str, Any]:
        response = client.post("/api/uploads", files={"file": (filename, data or make_image(), "image/jpeg")})
        assert response.status_code == 201, response.text
        return response.json()

    return _upload


@pytest.fixture
def create_product(client: TestClient) -> Callable[..., dict[str, Any]]:
    def _create(**fields: Any) -> dict[str, Any]:
        body = {"title": "Stoneware coffee mug", "category": "kitchen", **fields}
        response = client.post("/api/products", json=body)
        assert response.status_code == 201, response.text
        return response.json()

    return _create
