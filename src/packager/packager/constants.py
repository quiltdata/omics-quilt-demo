import json
import yaml
import os

from datetime import datetime
from dotenv import load_dotenv
from tempfile import TemporaryDirectory
from typing import Any, Generator
from pathlib import Path
from upath import UPath

from .types import KEYED
from .ssm_parameter_store import SSMParameterStore


load_dotenv("../../.env")


class Constants:
    DEFAULTS = {
        "APP_NAME": "packager",
        "CDK_DEFAULT_EMAIL": "test@example.com",
        "CDK_DEFAULT_REGION": "us-east-1",
        # "SENTINEL_BUCKET": "data-yaml-spec-tests",
        # "SENTINEL_FILE": "quilt_metadata.json",
        "TIMESTAMP_FILE": "quilt_timestamp.json",
        "SOURCE_APP": "omics-quilt",
        "QUILT_METADATA": "quilt_metadata.json",
        "INPUT_METADATA": "input_metadata.json",
        "QUILT_SUMMARIZE": "quilt_summarize.json",
    }

    @classmethod
    def GET(cls, key: str) -> Any:
        cc = cls({})
        return cc.get(key)

    @classmethod
    def KeyPathFromObject(cls, object: Any, key_path: str) -> Any:
        keys = key_path.split(".")
        value = object
        for key in keys:
            value = value.get(key)
            if value is None:
                return None
        return value

    @classmethod
    def KeyPathFromPath(cls, file_path: Path, key_path: str) -> Any:
        try:
            parsed = cls.LoadObjectPath(file_path)
            return cls.KeyPathFromObject(parsed, key_path)
        except Exception as e:
            print(e)
            return None

    @staticmethod
    def LoadObjectData(data: str, extension: str, env: KEYED = {}) -> KEYED:
        parsed = None
        if extension in ["yaml", "yml"]:
            parsed = yaml.safe_load(data)
        elif extension == "json":
            parsed = json.loads(data)
        else:
            raise ValueError(f"Unsupported file extension: {extension}")
        if isinstance(parsed, list):
            parsed = parsed[0]
        return KEYED(parsed)

    @classmethod
    def LoadObjectUri(cls, uri: str, env: KEYED = {}) -> KEYED:
        file_path = cls.ToPath(uri)
        return cls.LoadObjectPath(file_path)

    @classmethod
    def LoadObjectPath(cls, file_path: Path) -> KEYED:
        assert file_path.exists(), f"File does not exist: {file_path}"
        return cls.LoadObjectData(file_path.read_text(), file_path.suffix[1:])

    @classmethod
    def ToPath(cls, uri: str) -> Path:
        if uri.startswith("s3://"):
            return UPath(uri)
        return Path(uri).absolute().resolve()

    @classmethod
    def DownloadURI(cls, uri: str) -> Generator[Path, None, None]:
        file_path = cls.ToPath(uri)
        print(f"DownloadURI: {file_path} exists: {file_path.exists()}")
        data = file_path.read_text()
        print(f"DownloadURI.data: {len(data)}")
        """Save into a temporary directory and return the path"""
        with TemporaryDirectory() as tmp:
            file_path = Path(tmp) / file_path.name
            file_path.write_text(data)
            yield file_path

    @classmethod
    def GetRegion(cls) -> str:
        cc = cls({})
        if cc.region is None:
            raise ValueError("AWS region not set")
        return str(cc.region)

    def __init__(self, context: KEYED = {}) -> None:
        self.context: KEYED = {}
        if isinstance(context, dict):
            self.update_context(context.items())
        self.update_context(Constants.DEFAULTS.items())
        self.update_context(os.environ.items())
        self.app = self.get("APP_NAME")
        self.account = self.get("CDK_DEFAULT_ACCOUNT", "AWS_ACCOUNT_ID")
        self.region = self.get("CDK_DEFAULT_REGION", "AWS_DEFAULT_REGION")
        self.ssm = SSMParameterStore(self.app, self.region)

    def to_dict(self) -> KEYED:
        return {
            "app": self.app,
            "account": self.account,
            "region": self.region,
        }

    def to_string(self) -> str:
        return json.dumps(self.to_dict())

    def update_context(self, items: Any) -> None:
        for env, value in items:
            if self.context.get(env) is None:
                self.context[env] = value

    def get(self, key: str, key2: str = "") -> Any:
        value = self.context.get(key)
        if value or key2 == "":
            return value
        return self.context.get(key2)

    def has(self, key: str) -> bool:
        return self.get(key) is not None

    def put(self, key: str, value: Any) -> None:
        self.context[key] = value

    def default_props(self) -> KEYED:
        return {
            "account": self.account,
            "region": self.region,
            "email": self.get("CDK_DEFAULT_EMAIL"),
        }

    def get_acct_region(self) -> str:
        return f"{self.region}:{self.account}"

    def get_bucket_name(self, type: str) -> str:
        return f"{self.app}-cka-{type}-{self.account}-{self.region}"

    def get_ecr_registry(self) -> str:
        return f"{self.account}.dkr.ecr.{self.region}.amazonaws.com"

    def timeout(self) -> int:
        return int(self.get("TIMEOUT"))

    def check_time(self, uri: str) -> bool:
        # remove prefix from uri
        key = uri.replace("s3://", "")
        now = round(datetime.now().timestamp())
        if key in self.ssm:
            prior = int(self.ssm[key])
            delta = now - prior
            timeout = self.timeout()
            if delta < timeout:
                print(f"Too soon: {delta} < {timeout}")
                return False
        self.ssm[key] = str(now)
        return True
