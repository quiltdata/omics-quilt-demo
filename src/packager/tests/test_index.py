# import pytest
from packager import handler, Constants
from .conftest import CTX


def test_handler():
    event = Constants.LoadObjectUri(CTX["EVENT"])
    assert event
    uri = Constants.KeyPathFromObject(event, "detail.runOutputUri")
    result = handler(event, CTX)
    assert result
    print(result)
    assert result["statusCode"] == 200
    assert uri in result["uri"]
