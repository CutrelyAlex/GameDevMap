from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    env: str
    jwt_secret: str
    database_url: str
    db_path: str


def _repo_root() -> Path:
    # backend/config.py -> backend/ -> repo root
    return Path(__file__).resolve().parents[1]


def get_settings() -> Settings:
    env = (os.getenv("ENV") or os.getenv("NODE_ENV") or "development").strip()

    jwt_secret = (os.getenv("JWT_SECRET") or "dev-insecure-change-me").strip()

    database_url = (os.getenv("DATABASE_URL") or "").strip()
    db_path = (os.getenv("DB_PATH") or "data/gamedevmap.db").strip()

    if not database_url:
        p = Path(db_path)
        if not p.is_absolute():
            p = (_repo_root() / p).resolve()
        # SQLAlchemy sqlite URL wants forward slashes
        database_url = f"sqlite:///{p.as_posix()}"

    return Settings(env=env, jwt_secret=jwt_secret, database_url=database_url, db_path=db_path)
