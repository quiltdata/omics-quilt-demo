import * as fs from 'fs';
import { regionalManifest } from '../src/region';

describe('regionalManifest', () => {
  it('should return the correct regional manifest', () => {
    const region = 'us-test-0';
    const timestamp = '2020-01-01T00:00:00.000Z';
    const expected_folder = `workflows/fastq/${region}`;
    const expected_file = `${expected_folder}/${region}.json`;

    const result_folder = regionalManifest(region, timestamp);
    expect(result_folder).toContain(expected_folder);

    const result_file = `${result_folder}/${region}.json`;
    expect(result_file).toContain(expected_file);

    // read the file and check the contents
    const data = fs.readFileSync(result_file, 'utf8');
    expect(data).toContain(`"region": "${region}"`);
    expect(data).toContain(`"timestamp": "${timestamp}"`);
  });
});
