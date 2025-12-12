from __future__ import annotations

import json
from typing import Any


def dumps_stable(value: Any) -> str:
    """Stable JSON serialization for fields persisted as TEXT.

    - sort_keys: deterministic diffs
    - ensure_ascii=False: keep Chinese readable
    """

    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def loads_json(value: str | None, default: Any) -> Any:
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default
