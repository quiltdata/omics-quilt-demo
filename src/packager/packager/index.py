from gsalib import GatkReport  # type: ignore

from .constants import Constants, KEYED


def handler(event: KEYED, context: KEYED = {}) -> KEYED:
    cc = Constants(context)
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
