import * as fs from 'fs';
import { fastqConfig } from '../src/fastq-config';
import { Constants } from '../src/constants';

describe('fastqConfig', () => {
  it('should create a config for the current region', () => {
    const region = Constants.GET('CDK_DEFAULT_REGION');
    expect(region).toBeDefined();
    expect(region).toEqual('us-east-1');
    const timestamp = new Date().toISOString();
    const expected_folder = `workflows/fastq/${region}`;
    const expected_file = `${expected_folder}/${region}.json`;

    const result_folder = fastqConfig(region, timestamp);
    const result_file = `${result_folder}/${region}.json`;
    expect(result_folder).toContain(expected_folder);
    expect(result_file).toContain(expected_file);

    // read the file and check the contents
    const data = fs.readFileSync(result_file, 'utf8');
    expect(data).toContain(`"region": "${region}"`);
    expect(data).toContain(`"timestamp": "${timestamp}"`);
  });
});
