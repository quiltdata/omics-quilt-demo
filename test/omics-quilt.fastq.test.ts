// import exp from 'constants'
import { TEST_EVENT } from './fixture';
import {
  fastq_config_from_uri,
  handler,
} from '../src/omics-quilt.fastq';


const CONTEXT = {
  debug: true,
  local_file: './workflows/fastq/aws_region.json',
  INPUT_S3_LOCATION: './',
};

describe('fastq_config_from_uri', () => {
  it('should return a single sample', async () => {
    const sample = await fastq_config_from_uri(CONTEXT.local_file);
    expect(sample).toBeDefined();
    expect(typeof sample).toEqual('object');
    expect(sample.sample_name).toEqual('NA12878');
    const pairs = sample.fastq_pairs;
    expect(pairs.length).toEqual(1);
    const pair = pairs[0];
    expect(pair.read_group).toEqual('Sample_U0a');
    expect(pair.fastq_1).toContain('NA12878/Sample_U0a/U0a_CGATGT_L001_R1_001');
    expect(pair.fastq_2).toContain('NA12878/Sample_U0a/U0a_CGATGT_L001_R2_001');
    expect(pair.platform).toEqual('illumina');
  });
});

// test handler with TEST_EVENT and context = {debug: true}
describe('handler', () => {
  it('should run without error', async () => {
    const result = await handler(TEST_EVENT, CONTEXT);
    expect(result.message).toEqual('Success');
  });
});
