"""Application factory. ``create_app()`` is used by uvicorn and by the tests."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from . import __version__
from .catalog import image_ids_in_use
from .config import Settings
from .database import connect, migrate
from .media import ImageRejected, prune_orphans
from .routers import ai, products, system
from .writers import WriterError, build_writer

log = logging.getLogger("shelfwise")


class MediaFiles(StaticFiles):
    """Uploaded photos get a fresh random name and are never rewritten, so they can be cached forever."""

    def file_response(self, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.media_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        version = migrate(settings.database_path)
        conn = connect(settings.database_path)
        try:
            prune_orphans(settings.media_dir, keep=image_ids_in_use(conn))
        finally:
            conn.close()
        app.state.writer = build_writer(settings)
        log.info("Database at schema v%d. Listing writer: %s", version, settings.ai_mode)
        yield

    app = FastAPI(title="Shelfwise API", version=__version__, lifespan=lifespan)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(WriterError)
    async def writer_error(_: Request, exc: WriterError) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    @app.exception_handler(ImageRejected)
    async def image_rejected(_: Request, exc: ImageRejected) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    app.include_router(system.router, prefix="/api")
    app.include_router(ai.router, prefix="/api")
    app.include_router(products.router, prefix="/api")
    app.mount("/media", MediaFiles(directory=settings.media_dir), name="media")
    return app
