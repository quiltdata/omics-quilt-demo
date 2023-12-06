import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

const SOURCE_TEMPLATE = 'aws_region.json';
const CWD = process.cwd();
const SOURCE_FOLDER = path.join(CWD, 'workflows', 'fastq');
const SOURCE = path.join(SOURCE_FOLDER, SOURCE_TEMPLATE);

export function fastqConfig(region: string, timestring: string = '') {
  const timestamp = (timestring != '') ? timestring : new Date().toISOString();
  const DEST_FOLDER = path.join(SOURCE_FOLDER, region);
  const DEST_KEY = `${region}.json`;
  const DEST = path.join(DEST_FOLDER, DEST_KEY);
  fs.mkdirSync(DEST_FOLDER, { recursive: true });

  // read the source file and print its contents
  const source = fs.readFileSync(SOURCE, 'utf8');
  // use handlebars to compile the source file and replace region/timestamp
  const template = Handlebars.compile(source);
  const dest = template({ region, timestamp });
  fs.writeFileSync(DEST, dest, 'utf8');
  return DEST_FOLDER;
}
