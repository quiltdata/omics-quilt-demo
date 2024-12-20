
import {
  OmicsClient,
  RunLogLevel,
  StartRunCommand,
  StartRunCommandInput,
  WorkflowType,
} from '@aws-sdk/client-omics';
import { v4 as uuidv4 } from 'uuid';
import { Constants, KeyedConfig } from './constants';
import { Vivos } from './vivos';

export async function handler(event: any, context: any) {
  const pipe = new OmicsQuiltFastq(event, context);
  return pipe.exec();
}

export class OmicsQuiltFastq extends Vivos {
  static async start_omics_run(options: StartRunCommandInput) {
    const omicsClient = new OmicsClient();
    const command = new StartRunCommand(options);
    const response = await omicsClient.send(command);
    return response;
  }

  static async fastq_config_from_uri(uri: string) {
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

  constructor(event: any, context: any) {
    super(event, context);
    console.debug('Received event: ' + JSON.stringify(event, null, 2));
  }

  async exec() {
    const uri = this.cc.get('local_file') || this.getEventObjectURI();
    const item = await OmicsQuiltFastq.fastq_config_from_uri(uri);
    let error_count = 0;
    error_count += await this.run_workflow(item, uri);

    if (error_count > 0) {
      throw new Error('Error launching some workflows, check logs');
    }
    return { message: 'Success' };
  }

  async save_metadata(id: string, item: any) {
    const location = this.cc.get('OUTPUT_S3_LOCATION');
    if (!location) {
      console.info('No OUTPUT_S3_LOCATION, skipping metadata save');
      return;
    }
    const metadata_file = this.cc.get('INPUT_METADATA');
    if (!metadata_file) {
      console.info('No INPUT_METADATA, skipping metadata save');
      return;
    }
    const uri = `${location}/${id}/out/${metadata_file}`;
    console.info(`Writing input to ${uri}`);
    await Constants.SaveObjectURI(uri, item);
  }

  async run_workflow(item: Record<string, string>, uri: string) {
    const _samplename = item.sample_name;
    console.info(`Starting workflow for sample: ${_samplename}`);
    const uuid = this.cc.get('TEST_UUID') || uuidv4();
    const run_name = `${_samplename}.${uuid}.`;
    const workflow_type = 'READY2RUN' as WorkflowType;
    const options = {
      workflowType: workflow_type,
      workflowId: this.cc.get('WORKFLOW_ID'),
      name: run_name,
      roleArn: this.cc.get('OMICS_ROLE'),
      parameters: item,
      logLevel: this.cc.get('LOG_LEVEL') as RunLogLevel,
      outputUri: this.cc.get('OUTPUT_S3_LOCATION'),
      tags: {
        SOURCE: 'LAMBDA_FASTQ',
        RUN_NAME: run_name,
        SAMPLE_MANIFEST: uri,
        VIVOS_ID: uuid,
      },
      requestId: uuid,
    };
    try {
      console.debug(`Workflow options: ${JSON.stringify(options)}`);
      if (this.cc.get('debug') === true) {
        console.info(`Skipping with context: ${JSON.stringify(this.cc)}`);
      } else {
        const input: StartRunCommandInput = options;
        const response = await OmicsQuiltFastq.start_omics_run(input);
        console.info(`Workflow response: ${JSON.stringify(response)}`);
        const run_metadata = {
          sample: item,
          run: response,
          workflow: options,
        };
        const id = response.id!;
        await this.save_metadata(id, run_metadata);
      }
    } catch (e: any) {
      console.error('Error : ' + e.toString());
      return 1;
    }
    return 0;
  }
}

export default OmicsQuiltFastq;
