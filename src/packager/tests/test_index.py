import pytest
from packager import handler, Constants, PseudoContext
from .conftest import CTX


@pytest.fixture
def ctx():
    return PseudoContext(CTX)


@pytest.fixture
def event():
    return Constants.LoadObjectUri(CTX["EVENT"])


def set_type(event, type):
    record = event["Records"][0]
    record["eventName"] = type
    return record


def test_fixtures(ctx, event):
    assert ctx
    assert event


def test_no_type(ctx, event):
    set_type(event, None)
    result = handler(event, ctx)
    assert result["statusCode"] == 400


def test_bad_type(ctx, event):
    set_type(event, "ObjectCreated:Delete")
    result = handler(event, ctx)
    assert result["statusCode"] == 404


def test_valid_type(ctx, event):
    record = set_type(event, "ObjectCreated:Put")
    record["debug"] = True
    result = handler(event, ctx)
    assert result
    print(record)
    assert result["statusCode"] == 201
    body = result["body"]
    assert body
    print(body)
