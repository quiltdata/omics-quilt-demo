import json

from gsalib import GatkReport  # type: ignore
from pathlib import Path
from quilt3 import Package  # type: ignore
from typing import Any, TYPE_CHECKING

from .types import KEYED

from .constants import Constants

if TYPE_CHECKING:
    from aws_lambda_powertools.utilities.typing import LambdaContext
else:
    LambdaContext = object

LOG_STREAM = "OmicsQuiltDemo-{:0>4d}{:0>2d}{:0>2d}"
REPORT_SUFFIX = "out/bqsr_report/NA12989.hg38.recal_data.csv"


class GSAHandler:
    @staticmethod
    def ReportRoot(report_uri: str) -> Path:
        report_path = Constants.ToPath(report_uri)
        return report_path.parent.parent

    @staticmethod
    def ParseURI(file_uri: str) -> KEYED:
        splits = file_uri.split("/")
        bucket = splits[2]
        pkg_names = splits[3:5]
        pkg_name = "/".join(pkg_names)
        return {"bucket": bucket, "package": pkg_name}

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
        body = {
            "message": "N/A",
            "event": event,
            "opts": opts,
        }
        print(f"handleEvent.opts: {opts}")
        ready = (not opts["debug"]) and self.cc.check_time(opts["uri"])
        if not ready:
            body["message"] = "Not ready"
            return {
                "statusCode": 200,
                "body": body,
            }
        if not opts.get("type"):
            body["message"] = "ERROR: No type"
            return {
                "statusCode": 400,  # Bad Request
                "body": body,
            }
        if opts["type"] != "Run Status Change":
            body["message"] = f"ERROR: Bad event type: {opts['type']}"
            return {
                "statusCode": 404,  # Not Found
                "body": body,
            }

        root = opts["uri"]
        report_uri = f"{root}/{REPORT_SUFFIX}"
        print(f"handleEvent.root: {root}")
        if not opts.get("debug"):
            tables = self.downloadReport(report_uri, root)
            self.summarizeTables(tables, root)
            body["opts"] = self.packageFolder(root, opts)
            body["message"] = f"{report_uri} @ {root}"
        return {
            "statusCode": 201,
            "body": body,
        }

    def parseEvent(self, event: KEYED) -> KEYED:
        if "detail" not in event:
            raise ValueError("No `detail` in event")
        detail = event["detail"]
        if "status" not in detail:
            raise ValueError("No `status` in detail")
        if "runOutputUri" not in detail:
            raise ValueError("No `runOutputUri` in detail")
        uri = detail["runOutputUri"]
        parts = self.ParseURI(uri)
        return {
            "account": event["account"],
            "region": event["region"],
            "source": event["source"],
            "time": event["time"],
            "type": event["detail-type"],
            "package": parts["package"],
            "debug": event.get("debug", False),
            "uri": uri,
        }

    def downloadReport(self, report_uri: str, root: Path) -> KEYED:
        for temp_path in Constants.DownloadURI(report_uri):
            if temp_path.exists():
                report = GatkReport(str(temp_path))
                root = self.ReportRoot(report_uri)
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
        files = list(tables.values())
        filename_list = json.dumps(files, ensure_ascii=True)
        sum: Path = root / self.cc.get("QUILT_SUMMARIZE")
        sum.write_text(filename_list)
        return sum

    def packageFolder(self, root: Path, opts: KEYED) -> KEYED:
        parsed = self.ParseURI(opts["uri"])
        print(f"packageFolder.parsed: {parsed}")
        base_uri = f"quilt+s3://{parsed["bucket"]}#package={parsed["package"]}"
        pkg = Package()
        assert root.exists()
        assert root.is_dir()

        meta_file = root / self.cc.get("QUILT_METADATA")
        if meta_file.exists():
            text = meta_file.read_text()
            meta: KEYED = json.loads(text)
        else:
            meta = {}
        input_file = root / self.cc.get("INPUT_METADATA")
        if input_file.exists():
            text = input_file.read_text()
            meta["input"] = json.loads(text)
        meta["options"] = opts
        meta["context"] = self.context

        root_folder = str(root)
        pkg.set_dir(".", path=root_folder)
        pkg.set_meta(meta)

        print(f"packageFolder.opts: {opts}")
        new_pkg = pkg.push(
            opts["package"],
            registry=f"s3://{parsed["bucket"]}",
            message=json.dumps(opts, ensure_ascii=True),
            force=True,
        )
        print(f"packageFolder.new_pkg: {new_pkg}")
        meta["top_hash"] = new_pkg.top_hash
        meta["quilt+uri"] = f"{base_uri}@{new_pkg.top_hash}"
        print(f"packageFolder.meta: {meta}")
        return meta
