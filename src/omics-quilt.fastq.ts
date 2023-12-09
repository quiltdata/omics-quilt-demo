
import {
  OmicsClient,
  RunLogLevel,
  StartRunCommand,
  StartRunCommandInput,
  WorkflowType,
} from '@aws-sdk/client-omics';
import { v4 as uuidv4 } from 'uuid';
import { Constants, KeyedConfig } from './constants';

async function start_omics_run(options: StartRunCommandInput) {
  const omicsClient = new OmicsClient();
  const command = new StartRunCommand(options);
  const response = await omicsClient.send(command);
  return response;
}

export async function fastq_config_from_uri(uri: string) {
  const params: Record<string, any> = {};
  const sample: KeyedConfig = await Constants.LoadObjectURI(uri);
  console.info(`Loaded JSON manifest:\n${JSON.stringify(sample, null, 2)}`);
  params.sample_name = sample.sample_name;
  params.fastq_pairs = [];
  params.fastq_pairs.push({
    read_group: sample.read_group as string,
    fastq_1: sample.fastq_1 as string,
    fastq_2: sample.fastq_2 as string,
    platform: sample.platform as string,
  });
  return params;
}

export async function handler(event: any, context: any) {
  const cc = new Constants(context);
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
  const uri = context.local_file || `s3://${bucket_name}/${filename}`;
  const item = await fastq_config_from_uri(uri);
  let error_count = 0;
  error_count += await run_workflow(
    item,
    uri,
    cc,
  );

  if (error_count > 0) {
    throw new Error('Error launching some workflows, check logs');
  }
  return { message: 'Success' };
}

async function save_input(prefix: string, item: any, cc: Constants) {
  const input_uri = cc.get('INPUT_S3_LOCATION') + '/' + prefix + '.json';
  console.info(`Writing input to ${input_uri}`);
  await Constants.SaveObjectURI(input_uri, item);
}

async function run_workflow(
  item: Record<string, string>,
  uri: string,
  cc: Constants,
) {
  const _samplename = item.sample_name;
  await save_input(_samplename, item, cc);
  console.info(`Starting workflow for sample: ${_samplename}`);
  const uuid = cc.get('TEST_UUID') || uuidv4();
  const run_name = `${_samplename}.${uuid}.`;
  const workflow_type = 'READY2RUN' as WorkflowType;
  const options = {
    workflowType: workflow_type,
    workflowId: cc.get('WORKFLOW_ID'),
    name: run_name,
    roleArn: cc.get('OMICS_ROLE'),
    parameters: item,
    logLevel: cc.get('LOG_LEVEL') as RunLogLevel,
    outputUri: cc.get('OUTPUT_S3_LOCATION'),
    tags: {
      SOURCE: 'LAMBDA_FASTQ',
      RUN_NAME: run_name,
      SAMPLE_MANIFEST: uri,
      VIVOS_ID: uuid,
    },
    requestId: uuid,
  };
  await save_input(run_name + 'input', options, cc);
  try {
    console.debug(`Workflow options: ${JSON.stringify(options)}`);
    if (cc.get('debug') === true) {
      console.info(`Skipping with context: ${JSON.stringify(cc)}`);
    } else {
      const input: StartRunCommandInput = options;
      const response = await start_omics_run(input);
      console.info(`Workflow response: ${JSON.stringify(response)}`);
      await save_input(run_name + 'output', response, cc);
    }
  } catch (e: any) {
    console.error('Error : ' + e.toString());
    return 1;
  }
  return 0;
}
