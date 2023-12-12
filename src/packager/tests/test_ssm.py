from packager import SSMParameterStore
import pytest


@pytest.fixture
def store():
    return SSMParameterStore("SSMParameterStoreTest")


def test_parameter(store):
    store["key"] = "value"
    assert "value" == store["key"]


def test_slashes(store):
    store["key"] = "value"
    assert "value" == store["key"]
    store["key/2"] = "value2"
    assert "value2" == store["key/2"]
