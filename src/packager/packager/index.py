from typing import Any

from .handler import Handler
from .types import KEYED


def handler(event: KEYED, context: Any) -> KEYED:
    handler = Handler(context)
    return handler.handleEvent(event)
