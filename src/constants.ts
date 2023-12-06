import 'dotenv/config';
import { readFileSync } from 'fs';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import handlebars from 'handlebars';
import yaml from 'js-yaml';

export const AWS_ACCOUNT_ID = process.env.CDK_DEFAULT_ACCOUNT ?? '';
export const AWS_REGION = process.env.CDK_DEFAULT_REGION ?? '';

export const APP_NAME = process.env.CDK_APP_NAME ?? 'healthomics';
export const READY2RUN_WORKFLOW_ID =
  process.env.READY2RUN_WORKFLOW_ID ?? '9500764';
export const DEFAULT_EMAIL =
  process.env.CDK_DEFAULT_EMAIL ?? 'test@example.com';

export const INPUT_BUCKET = `${APP_NAME}-cka-input-${AWS_ACCOUNT_ID}-${AWS_REGION}`;
export const OUTPUT_BUCKET = `${APP_NAME}-cka-output-${AWS_ACCOUNT_ID}-${AWS_REGION}`;

export const MANIFEST_ROOT = 'fastq';
export const MANIFEST_PREFIX = `${MANIFEST_ROOT}/${AWS_REGION}`;
export const MANIFEST_SUFFIX = '.json';

export type KeyedConfig = {
  [key: string]: any;
};
export class Constants {

  public static DEFAULTS: { [key: string]: any } = {
    APP_NAME: 'omics-quilt',
    BENCHLING_API_FILE: 'benchling.yaml',
    BENCHLING_API_URL: 'https://quilt-dtt.benchling.com/api/v2',
    TEST_KEYED_FILE: './workflows/fastq/aws_region.json',
  };

  public static GET(key: string): any {
    const cc = new Constants({});
    return cc.get(key);
  }

  public static MapEnvars(envars: string[]): KeyedConfig {
    const envs: KeyedConfig = {};
    envars.forEach((key: string) => {
      envs[key] = Constants.GET(key);
    });
    return envs;
  }

  public static DefaultS3(region: string = '') {
    if (region === '') {
      region = Constants.GET('CDK_DEFAULT_REGION');
    }
    const s3 = new S3Client({ region: region });
    return s3;
  }

  public static GetPackageName(filePath: string): string {
    // first two components, joined by a slash
    const base = filePath.startsWith('/') ? 1 : 0;
    const components = filePath.split('/').slice(base, base + 2);
    return components.join('/');
  }

  public static async LoadObjectURI(uri: string, env: object = {}): Promise<KeyedConfig> {
    const split = uri.split('://');
    const scheme = split[0];
    if (!scheme || scheme === '' || scheme === 'file' || scheme[0] === '/' || scheme[0] == '.') {
      return Constants.LoadObjectFile(uri, env);
    }
    if (scheme !== 's3') {
      throw new Error(`Unsupported scheme: ${scheme}`);
    }
    const paths = split[1].split('/');
    const s3 = Constants.DefaultS3();
    const bucket = paths[0];
    const file = paths.slice(-1)[0];
    const key = paths.slice(1).join('/');
    console.info(`Loading ${file} from ${bucket} in ${key}`);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await s3.send(command);
    const contents = await response.Body!.transformToString();
    const extension = file.split('.').pop()?.toLowerCase();
    return Constants.LoadObjectData(contents, extension!, env);
  }

  public static LoadObjectFile(filePath: string, env: object = {}): KeyedConfig {
    var fileData = readFileSync(filePath, 'utf-8');
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    return Constants.LoadObjectData(fileData, fileExtension!, env);
  }

  public static LoadObjectData(data: string, extension: string, env: object = {}): KeyedConfig {
    if (Object.keys(env).length > 0) {
      const template = handlebars.compile(data);
      data = template(env);
    }

    if (extension === 'yaml' || extension === 'yml') {
      return yaml.load(data) as KeyedConfig;
    } else if (extension === 'json') {
      return JSON.parse(data);
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
  }

  public static async LoadPipeline(pipeline: string, env: any = {}) {
    var base = './config';
    if (typeof env.package !== 'string' || env.package === '') {
      env.package = pipeline;
    }
    if (typeof env.base_config === 'string' && env.base_config !== '') {
      base = env.base_config;
    }
    const paramsFile = `${base}/${pipeline}/params.json`;
    const launchFile = `${base}/${pipeline}/launch.json`;
    const params = await Constants.LoadObjectURI(paramsFile, env);
    const launch = await Constants.LoadObjectURI(launchFile, env);
    launch.paramsText = JSON.stringify(params);
    return launch;
  }

  public static GetKeyPathFromObject(object: any, keyPath: string): any {
    const keys = keyPath.split('.');
    let value = object;
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return undefined;
      }
    }
    return value;
  }

  public static GetKeyPathFromFile(filePath: string, keyPath: string): any {
    try {
      const object = Constants.LoadObjectFile(filePath);
      return Constants.GetKeyPathFromObject(object, keyPath);
    } catch (e: any) {
      console.error(e.message);
      return undefined;
    }
  }

  private context: any;

  constructor(context: any) {
    this.context = context;
    this.updateContext(process.env);
    this.updateContext(Constants.DEFAULTS);
  }

  public updateContext(envs: KeyedConfig) {
    Object.keys(envs).forEach(env => {
      if (this.context[env] === undefined) {
        // console.debug(`Setting ${env} to ${envs[env]}`)
        this.context[env] = envs[env];
      }
    });
  }

  // get checks context, then process.env, then DEFAULT_CONFIG
  public get(key: string): any {
    return this.context[key];
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public put(key: string, value: any): void {
    this.context[key] = value;
  }

  public defaultProps(): KeyedConfig {
    return {
      account: this.get('CDK_DEFAULT_ACCOUNT'),
      region: this.get('CDK_DEFAULT_REGION'),
      email: this.get('CDK_DEFAULT_EMAIL'),
    };
  }
}

export default Constants;


/*
// placeholders for lambda functions

export const OUTPUT_S3_LOCATION: string = process.env.OUTPUT_S3_LOCATION!
export const OMICS_ROLE: string = process.env.OMICS_ROLE!
export const WORKFLOW_ID: string = process.env.WORKFLOW_ID!
export const UPSTREAM_WORKFLOW_ID: string = process.env.UPSTREAM_WORKFLOW_ID!
export const ECR_REGISTRY: string = process.env.ECR_REGISTRY!
export const VEP_SPECIES: string = process.env.SPECIES!
export const VEP_DIR_CACHE: string = process.env.DIR_CACHE!
export const VEP_CACHE_VERSION: string = process.env.CACHE_VERSION!
export const VEP_GENOME: string = process.env.GENOME!
export const LOG_LEVEL: string = process.env.LOG_LEVEL!
*/
