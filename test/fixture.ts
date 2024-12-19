function generateRandomString(length: number): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const TEST_STACK = `omicsworkflowstack-omics${generateRandomString(20)}`;
export const TEST_EVENT = {
    version: '0',
    id: generateRandomString(36),
    'detail-type': 'Object Created',
    source: 'aws.s3',
    account: '123456789012',
    time: '2023-11-17T00:51:47.862Z',
    region: 'us-west-2',
    resources: [`arn:aws:s3:::${TEST_STACK}`],
    detail: {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-west-2',
        eventTime: '2023-11-17T00:51:47.862Z',
        eventName: 'ObjectCreated:Put',
        requestParameters: {
            sourceIPAddress: '34.220.14.62',
        },
        responseElements: {
            'x-amz-request-id': generateRandomString(10),
            'x-amz-id-2': generateRandomString(100),
        },
        bucket: {
            name: TEST_STACK,
            arn: `arn:aws:s3:::${TEST_STACK}`,
        },
        object: {
            key: 'fastq/us-west-2/us-west-2.json',
            size: 425,
            eTag: generateRandomString(20),
            versionId: generateRandomString(25),
            sequencer: generateRandomString(15),
        },
    },
};
