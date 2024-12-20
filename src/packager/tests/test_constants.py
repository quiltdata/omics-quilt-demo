from packager import Constants
from .conftest import CTX
import pytest
import time


@pytest.fixture
def cc():
    return Constants(CTX)


def test_constants(cc):
    assert cc
    assert "packager" in cc.get("APP_NAME")


def test_download_object(cc):
    assert cc
    for filename in cc.DownloadURI(CTX["META"]):
        print(filename)
        assert filename
        assert filename.exists()
        assert filename.is_file()


def test_check_time(cc):
    key = "timer"
    assert cc.check_time(key)
    assert not cc.check_time(key)
    time.sleep(1.5 * cc.timeout())
    assert cc.check_time(key)
