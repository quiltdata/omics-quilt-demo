import json

# import pytest
from packager.index import handler

TEST_EVENT = "./tests/outputs/8637245/quilt_metadata.json"


def test_handler():
    # Load the TEST_EVENT from the quilt_metadata.json file
    with open(TEST_EVENT) as f:
        test_event = json.load(f)
    # Call the handler function with the test event
    result = handler(test_event, None)

    # Add your assertions here to validate the result

    # Example assertion:
    assert test_event["outputUri"] in result["body"]
