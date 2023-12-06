import { createWriteStream, readFile } from 'fs';
import { promisify } from 'util';
import { Omics, S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const OUTPUT_S3_LOCATION = process.env.OUTPUT_S3_LOCATION!;
const OMICS_ROLE = process.env.OMICS_ROLE!;
const WORKFLOW_ID = process.env.WORKFLOW_ID!;
const LOG_LEVEL = process.env.LOG_LEVEL!;

async function download_s3_file(
  bucket: string,
  _key: string,
  local_file: string,
) {
  const s3 = new S3();

  try {
    const file = createWriteStream(local_file);
    const stream = s3
      .getObject({ Bucket: bucket, Key: _key })
      .createReadStream();
    stream.pipe(file);
    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });
  } catch (e: any) {
    if (e.code === 'NoSuchKey') {
      console.error('The object does not exist.');
    } else {
      throw e;
    }
  }
}

export async function fastq_config_from_json(manifest_json_file: string) {
  const contents = await promisify(readFile)(manifest_json_file, 'utf8');
  console.debug(`fastq_config_from_json[${manifest_json_file}]:\n${contents}`);
  const samples = JSON.parse(contents);
  if (!Array.isArray(samples)) {
    throw new Error(`samples is not an array: ${samples}`);
  }
  const samples_params = [];
  for (const _sample of samples) {
    if (typeof _sample !== 'object') {
      throw new Error(`sample is not an object: ${_sample}`);
    }
    console.info(`Creating input payload for sample: ${_sample}`);
    const _params: Record<string, any> = {};
    _params.sample_name = _sample.sample_name;
    _params.fastq_pairs = [];
    _params.fastq_pairs.push({
      read_group: _sample.read_group as string,
      fastq_1: _sample.fastq_1 as string,
      fastq_2: _sample.fastq_2 as string,
      platform: _sample.platform as string,
    });
    samples_params.push(_params);
  }

  return samples_params;
}

export async function handler(event: any, context: any) {
  console.debug('Received event: ' + JSON.stringify(event, null, 2));

  const num_upload_records = event.Records.length;
  let filename, bucket_arn, bucket_name;
  if (num_upload_records === 1) {
    filename = event.Records[0].s3.object.key;
    bucket_arn = event.Records[0].s3.bucket.arn;
    bucket_name = event.Records[0].s3.bucket.name;
    console.info(`Processing ${filename} in ${bucket_arn}`);
  } else if (num_upload_records === 0) {
    throw new Error('No file detected for analysis!');
  } else {
    throw new Error('Multiple s3 files in event not yet supported');
  }

  var local_file = context.local_file || '/tmp/sample_manifest.json';
  if (!context.local_file) {
    await download_s3_file(bucket_name, filename, local_file);
  }
  console.info(`Downloaded manifest JSON to: ${local_file}`);

  const multi_sample_params = await fastq_config_from_json(local_file);
  let error_count = 0;
  for (const _item of multi_sample_params) {
    error_count += await run_workflow(
      _item,
      bucket_name,
      filename,
      error_count,
      context,
    );
  }

  if (error_count > 0) {
    throw new Error('Error launching some workflows, check logs');
  }
  return { message: 'Success' };
}
async function run_workflow(
  _item: Record<string, string>,
  bucket_name: string,
  filename: string,
  error_count: number,
  context: any,
) {
  const _samplename = _item.sample_name;
  console.info(`Starting workflow for sample: ${_samplename}`);
  const run_name = `Sample_${_samplename}_` + uuidv4();
  try {
    const options = {
      workflowType: 'READY2RUN',
      workflowId: WORKFLOW_ID,
      name: run_name,
      roleArn: OMICS_ROLE,
      parameters: _item,
      logLevel: LOG_LEVEL,
      outputUri: OUTPUT_S3_LOCATION,
      tags: {
        SOURCE: 'LAMBDA_WF1_FASTQ',
        RUN_NAME: run_name,
        SAMPLE_MANIFEST: `s3://${bucket_name}/${filename}`,
      },
      requestId: uuidv4(), // add a unique requestId
    };
    console.debug(`Workflow options: ${JSON.stringify(options)}`);
    if (context.debug) {
      console.info(`Skipping with context: ${JSON.stringify(context)}`);
    } else {
      const omics = new Omics();
      const response = await omics.startRun(options).promise();
      console.info(`Workflow response: ${JSON.stringify(response)}`);
    }
  } catch (e: any) {
    console.error('Error : ' + e.toString());
    error_count += 1;
  }
  return error_count;
}
