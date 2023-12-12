from typing import Any
from aws_lambda_powertools.utilities.typing import LambdaContext
from dataclasses import dataclass, field


KEYED = dict[str, Any]

SKEYED = dict[str, str]


@dataclass
class ClientContext:
    client: Any = None
    custom: Any = None
    env: dict[str, str] = field(default_factory=dict)


@dataclass
class PseudoContext(LambdaContext):
    function_name: str = "test"
    function_version: str = "1"
    memory_limit_in_mb: int = 128
    aws_request_id: str = "test"
    log_group_name: str = "test"
    log_stream_name: str = "test"
    identity: Any = None
    client_context: ClientContext | None = None  # type: ignore

    def __init__(self, env: SKEYED) -> None:
        self.client_context = ClientContext()
        self.client_context.env = env
