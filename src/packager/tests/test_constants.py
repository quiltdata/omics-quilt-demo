from packager import Constants
from .conftest import CTX
import pytest


@pytest.fixture
def cc():
    return Constants(CTX)


def test_constants(cc):
    assert cc
    assert "data.csv" in cc.get("FASTQ_SENTINEL")


def test_download_object(cc):
    assert cc
    for filename in cc.DownloadURI(CTX["META"]):
        print(filename)
        assert filename
        assert filename.exists()
        assert filename.is_file()
