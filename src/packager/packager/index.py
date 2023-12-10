import json


def handler(event, context):
    # Extract the value of detail.outputURI from the event
    print(event)
    output_uri = event["outputUri"]

    return {"statusCode": 200, "body": json.dumps(f"Package created at {output_uri}")}
