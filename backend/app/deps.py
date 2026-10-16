"""FastAPI dependencies shared by the routers."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request

from .config import Settings
from .database import connect
from .writers import ListingWriter


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    conn = connect(request.app.state.settings.database_path)
    try:
        yield conn
    finally:
        conn.close()


def get_writer(request: Request) -> ListingWriter:
    return request.app.state.writer


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[sqlite3.Connection, Depends(get_db)]
WriterDep = Annotated[ListingWriter, Depends(get_writer)]
