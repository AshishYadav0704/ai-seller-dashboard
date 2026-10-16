import sqlite3

import pytest

from app.database import connect, migrate


def test_fresh_database_reaches_latest_version(tmp_path):
    path = tmp_path / "fresh.db"
    assert migrate(path) == 2
    assert migrate(path) == 2  # running again is a no-op


def test_database_from_first_release_is_upgraded_in_place(tmp_path):
    path = tmp_path / "legacy.db"
    legacy = sqlite3.connect(path)
    legacy.execute(
        "CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, description TEXT, status TEXT)"
    )
    legacy.executemany(
        "INSERT INTO products (category, description, status) VALUES (?, ?, ?)",
        [
            ("mens footwear", "Lightweight running shoes with a breathable mesh upper. Great for jogs.", "published"),
            ("Error", "Error parsing description.", "published"),
            ("home appliances", "", None),
        ],
    )
    legacy.commit()
    legacy.close()

    assert migrate(path) == 2

    conn = connect(path)
    rows = conn.execute("SELECT id, title, category, status, tags FROM products ORDER BY id").fetchall()
    conn.close()
    assert [tuple(row) for row in rows] == [
        (1, "Lightweight running shoes with a breathable mesh upper", "mens-footwear", "published", "[]"),
        (2, "Error parsing description", "other", "published", "[]"),
        (3, "Product 3", "home-appliances", "draft", "[]"),
    ]


def test_failed_migration_rolls_back(tmp_path, monkeypatch):
    import app.database as database

    def broken(conn):
        conn.execute("CREATE TABLE half_done (id INTEGER)")
        raise RuntimeError("boom")

    monkeypatch.setattr(database, "MIGRATIONS", [database._v1_initial, broken])
    path = tmp_path / "broken.db"
    with pytest.raises(RuntimeError):
        migrate(path)

    conn = connect(path)
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    conn.close()
    assert version == 1
    assert "half_done" not in tables
