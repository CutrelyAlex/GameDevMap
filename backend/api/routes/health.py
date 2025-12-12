from __future__ import annotations

from fastapi import APIRouter

from backend.api.errors import ok

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health() -> dict:
    return ok(message="ok")
