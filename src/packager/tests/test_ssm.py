from packager import SSMParameterStore
import pytest


@pytest.fixture
def store():
    return SSMParameterStore("SSMParameterStoreTest")


def test_parameter(store):
    store["key"] = "value"
    assert "value" == store["key"]
