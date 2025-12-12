from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.api.errors import (
    AppError,
    handle_app_error,
    handle_request_validation_error,
    handle_unhandled_exception,
)
from backend.api.routes.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="GameDevMap API",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    # Error handlers (consistent {success, message, error} shape)
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(Exception, handle_unhandled_exception)

    # FastAPI uses Starlette's validation error type
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(RequestValidationError, handle_request_validation_error)

    # API routes
    app.include_router(health_router)

    # Static mounts (added AFTER /api routes so /api is not shadowed)
    repo_root = Path(__file__).resolve().parents[1]

    submissions_dir = repo_root / "data" / "submissions"
    public_dir = repo_root / "public"

    app.mount(
        "/assets/submissions",
        StaticFiles(directory=str(submissions_dir), check_dir=False),
        name="submissions",
    )

    app.mount(
        "/",
        StaticFiles(directory=str(public_dir), html=True, check_dir=False),
        name="public",
    )

    return app


app = create_app()
