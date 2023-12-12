from typing import Any

from .handler import Handler
from .constants import KEYED


def handler(event: KEYED, context: Any) -> KEYED:
    handler = Handler(context)
    return handler.handleEvent(event)
