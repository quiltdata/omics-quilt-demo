# import pytest
from packager import handler, Constants, PseudoContext
from .conftest import CTX


def test_handler():
    ctx = PseudoContext(CTX)
    event = Constants.LoadObjectUri(CTX["EVENT"])
    assert event
    uri = Constants.KeyPathFromObject(event, "detail.runOutputUri")
    result = handler(event, ctx)
    assert result
    print(result)
    assert result["statusCode"] == 200
    assert uri in result["uri"]
