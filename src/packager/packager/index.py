from typing import Any

from .gsa_handler import GSAHandler
from .types import KEYED


def handler(event: KEYED, context: Any) -> KEYED:
    handler = GSAHandler(context)
    return handler.handleEvent(event)
