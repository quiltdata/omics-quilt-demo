import json
from gsalib import GatkReport  # type: ignore


REPORT_FILE = "out/bqsr_report/*.csv"


def handler(event, context):
    # Extract the value of detail.outputURI from the event
    print(event)
    output_uri = event["outputUri"]
    # Create a GatkReport object
    report_uri = f"{output_uri}/{REPORT_FILE}"
    report = GatkReport(report_uri)

    return {"statusCode": 200, "body": json.dumps(f"Created {report}")}
