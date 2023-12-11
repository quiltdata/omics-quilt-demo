from gsalib import GatkReport  # type: ignore
from typing import Any, TYPE_CHECKING
from pathlib import Path
from upath import UPath
from quilt3 import Package  # type: ignore

from .constants import Constants, KEYED

if TYPE_CHECKING:
    from aws_lambda_powertools.utilities.typing import LambdaContext
else:
    LambdaContext = object

LOG_STREAM = "OmicsQuiltDemo-{:0>4d}{:0>2d}{:0>2d}"


class Handler:
    @staticmethod
    def ParseURI(file_uri: str) -> KEYED:
        # file_uri = s3://bucket/pkg/name/.../sentinel_file
        splits = file_uri.split("/")
        bucket = splits[2]
        pkg_names = splits[3:4]
        pkg_name = "/".join(pkg_names)
        filename = splits[-1]
        return {"bucket": bucket, "pkg_name": pkg_name, "filename": filename}

    @staticmethod
    def GetContext(context: Any) -> KEYED:
        if isinstance(context, dict):
            return context
        elif context is LambdaContext:
            if context.client_context and context.client_context.env:
                return dict(context.client_context.env)
        return {}

    def __init__(self, context: Any):
        self.context = self.GetContext(context)
        self.cc = Constants(self.context)

    def handleEvent(self, event: KEYED) -> KEYED:
        event = self.parseEvent(event)
        print(event)
        if "type" not in event:
            return {
                "statusCode": 400,
                "body": "No type",
            }
        if event["type"] != "ObjectCreated:Put":
            return {
                "statusCode": 200,
                "body": "No action",
            }

        report_uri = f"s3://{event['bucket']}/{event['key']}"
        report_path = UPath(report_uri)
        root = report_path.parent.parent.parent
        tables = self.downloadReport(report_uri, root)
        result = self.packageFolder(tables, root, event)
        return {
            "statusCode": 200,
            "body": result,
        }

    def parseEvent(self, event: KEYED) -> KEYED:
        records = event["Records"]
        if len(records) == 0:
            raise ValueError("No records in event")
        record = records[0]
        if "s3" not in record:
            raise ValueError("No s3 in record")
        s3 = record["s3"]
        key = s3["object"]["key"]
        return {
            "region": record["awsRegion"],
            "time": record["eventTime"],
            "type": record["eventName"],
            "bucket": s3["bucket"]["name"],
            "key": key,
            "package": Constants.GetPackageName(UPath(key)),
        }

    def downloadReport(self, report_uri: str, root: Path) -> KEYED:
        for temp_path in Constants.DownloadURI(report_uri):
            print(temp_path)
            if temp_path.exists():
                report = GatkReport(str(temp_path))
                root = Path(report_uri).parent.parent.parent
                return self.downloadTables(report, root)
        return {}

    def downloadTables(self, report: GatkReport, root: Path) -> KEYED:
        tables = {}
        for name, table in report.tables.items():
            dest = root / f"{name}.csv"
            print(dest)
            table.to_csv(dest)
            tables[name] = str(dest)
        return tables

    def packageFolder(self, tables: KEYED, root: Path, opts: KEYED) -> str:
        pkg = Package()
        pkg.set_dir(root)
        pkg_name = f"{root.name}.quilt"
        pkg_path = root / pkg_name
        pkg.build(pkg_path)
        return str(pkg_path)
