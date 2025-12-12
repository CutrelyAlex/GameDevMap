from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


@dataclass
class AppError(Exception):
    message: str
    status_code: int = 400
    code: str = "bad_request"
    details: Any | None = None


def ok(data: Any | None = None, message: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return payload


def fail(message: str, *, status_code: int = 400, code: str = "bad_request", details: Any | None = None) -> JSONResponse:
    body: dict[str, Any] = {"success": False, "message": message, "error": {"code": code}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return fail(exc.message, status_code=exc.status_code, code=exc.code, details=exc.details)


async def handle_request_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return fail(
        "Request validation failed",
        status_code=422,
        code="validation_error",
        details=exc.errors(),
    )


async def handle_unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
    # Keep details minimal to avoid leaking secrets.
    return fail("Internal server error", status_code=500, code="internal_error")
