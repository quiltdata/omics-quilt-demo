import json

from gsalib import GatkReport  # type: ignore
from pathlib import Path
from quilt3 import Package  # type: ignore
from typing import Any, TYPE_CHECKING
from upath import UPath

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
        opts = self.parseEvent(event)
        print(f"handleEvent.opts: {opts}")
        if not opts.get("type"):
            return {
                "statusCode": 400,  # Bad Request
                "body": "No type",
            }
        if opts["type"] != "ObjectCreated:Put":
            return {
                "statusCode": 404,  # Not Found
                "body": "No action",
            }

        report_uri = f"s3://{opts['bucket']}/{opts['key']}"
        report_path = UPath(report_uri)
        root = report_path.parent.parent.parent
        print(f"handleEvent.root: {root}")
        meta = opts
        if not opts.get("debug"):
            tables = self.downloadReport(report_uri, root)
            self.summarizeTables(tables, root)
            meta = self.packageFolder(root, opts)
        return {
            "statusCode": 200,
            "body": {
                "root": str(root),
                "report": report_uri,
                "meta": meta,
                "event": event,
            },
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
            "package": Constants.GetPackageName(Path(key)),
            "debug": record.get("debug", False),
        }

    def downloadReport(self, report_uri: str, root: Path) -> KEYED:
        for temp_path in Constants.DownloadURI(report_uri):
            if temp_path.exists():
                report = GatkReport(str(temp_path))
                report_path = Constants.ToPath(report_uri)
                root = report_path.parent.parent.parent
                return self.downloadTables(report, root)
        return {}

    def downloadTables(self, report: GatkReport, root: Path) -> KEYED:
        tables = {}
        for name, table in report.tables.items():
            dest = root / f"{name}.csv"
            print(f"downloadTables: {name} -> {dest}")
            table.to_csv(dest)
            tables[name] = str(dest)
        return tables

    def summarizeTables(self, tables: KEYED, root: Path) -> Path:
        names = list(tables.keys())
        name_string = json.dumps(names, ensure_ascii=True)
        sum: Path = root / self.cc.get("QUILT_SUMMARIZE")
        sum.write_text(name_string)
        return sum

    def packageFolder(self, root: Path, opts: KEYED) -> KEYED:
        base_uri = f"quilt+s3://{opts['bucket']}#package={opts['package']}"
        pkg = Package()
        assert root.exists()
        assert root.is_dir()

        meta_file = root / self.cc.get("QUILT_METADATA")
        if meta_file.exists():
            text = meta_file.read_text()
            meta: KEYED = json.loads(text)
        else:
            meta = {}
        meta["options"] = opts
        meta["context"] = self.context

        print(f"packageFolder.meta: {meta}")

        root_folder = str(root)
        pkg.set_dir(".", path=root_folder)
        pkg.set_meta(meta)

        new_pkg = pkg.push(
            opts["package"],
            registry=f"s3://{opts['bucket']}",
            message=json.dumps(opts, ensure_ascii=True),
            force=True,
        )
        meta["top_hash"] = new_pkg.top_hash
        meta["quilt+uri"] = f"{base_uri}@{new_pkg.top_hash}"
        print(f"packageFolder.meta: {meta}")
        return meta
