from gsalib import GatkReport  # type: ignore
from typing import Any, TYPE_CHECKING

from .constants import Constants, KEYED

if TYPE_CHECKING:
    from aws_lambda_powertools.utilities.typing import LambdaContext
else:
    LambdaContext = object

LOG_STREAM = "InstanceScheduler-{:0>4d}{:0>2d}{:0>2d}"


def handler(event: KEYED, context: Any) -> KEYED:
    ctx: KEYED = {}
    if isinstance(context, dict):
        ctx = context
    elif context is LambdaContext:
        if context.client_context and context.client_context.env:
            ctx = context.client_context.env
    cc = Constants(ctx)
    # Extract the value of detail.outputURI from the event
    print(event)
    output_uri = cc.KeyPathFromObject(event, "detail.runOutputUri")
    print(output_uri)
    # Create a GatkReport object
    report_uri = f"{output_uri}/{cc.get('FASTQ_SENTINEL')}"
    for temp_path in cc.DownloadURI(report_uri):
        print(temp_path)
        if temp_path.exists():
            report = GatkReport(str(temp_path))
            return {"statusCode": 200, "body": report, "uri": report_uri}
    return {"statusCode": 404, "body": f"File not found: {report_uri}"}
