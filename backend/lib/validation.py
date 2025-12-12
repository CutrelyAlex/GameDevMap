from __future__ import annotations

from typing import Any


class ValidationError(ValueError):
    pass


def validate_coordinates(longitude: float, latitude: float) -> None:
    if longitude < -180 or longitude > 180:
        raise ValidationError("longitude must be within [-180, 180]")
    if latitude < -90 or latitude > 90:
        raise ValidationError("latitude must be within [-90, 90]")


def normalize_name(value: str) -> str:
    return (value or "").strip()


def normalize_school(value: str) -> str:
    return (value or "").strip()


def validate_external_links(value: Any) -> None:
    """Validate externalLinks structure.

    Expected (list of objects):
      { "type": str, "url": str, "qrcode": optional str }

    Keep it permissive to match current front-end expectations.
    """

    if value is None:
        return

    if not isinstance(value, list):
        raise ValidationError("externalLinks must be a list")

    for item in value:
        if not isinstance(item, dict):
            raise ValidationError("externalLinks items must be objects")
        if "type" not in item or "url" not in item:
            raise ValidationError("externalLinks items must include 'type' and 'url'")
        if not isinstance(item.get("type"), str) or not isinstance(item.get("url"), str):
            raise ValidationError("externalLinks 'type' and 'url' must be strings")
        if "qrcode" in item and item["qrcode"] is not None and not isinstance(item["qrcode"], str):
            raise ValidationError("externalLinks 'qrcode' must be a string when present")
