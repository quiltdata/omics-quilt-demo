import json
import os
import pytest
from datetime import datetime

from packager import GSAHandler
from tempfile import TemporaryDirectory

# from unittest.mock import MagicMock, patch
from pathlib import Path
from .conftest import CTX


@pytest.fixture
def handler():
    return GSAHandler({})


@pytest.fixture
def root():
    with TemporaryDirectory() as tempdir:
        yield Path(tempdir)


def test_parse_event(handler):
    event_file = CTX["EVENT"]
    event_path = Path(event_file)
    assert event_path.exists()
    event = json.loads(event_path.read_text())
    assert event is not None
    assert "Records" in event
    opts = handler.parseEvent(event)
    assert opts is not None
    assert "bucket" in opts
    assert "key" in opts
    assert "package" in opts
    assert "test/omics-quilt-output" == opts["package"]


def test_download_report(handler, root):
    report = CTX["REPORT"]
    report_path = Path(report)
    assert report_path.exists()
    tables = handler.downloadReport(report, root)
    assert len(tables) == 5
    for name, table in tables.items():
        print(name)
        assert Path(table).exists()


@pytest.mark.skipif(
    not os.environ.get("WRITE_BUCKET", False),
    reason="Skipping unless WRITE_BUCKET is set",
)
def test_package_folder(handler, root):
    bucket = os.environ["WRITE_BUCKET"]
    meta = handler.cc.get("QUILT_METADATA")
    assert meta is not None
    meta_path = root / meta
    assert not meta_path.exists()
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "write_bucket": bucket,
        "cc": handler.cc.to_dict(),
    }
    ctx_dump = json.dumps(metadata, indent=2)
    meta_path.write_text(ctx_dump)
    assert meta_path.exists()
    options = {
        "bucket": bucket,
        "package": "test/omics-quilt-demo",
    }
    rc = handler.packageFolder(root, options)
    assert rc is not None
    assert bucket in rc["quilt+uri"]
    assert "@" in rc["quilt+uri"]
    assert "top_hash" in rc
