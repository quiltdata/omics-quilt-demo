import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import handlebars from 'handlebars';
import yaml from 'js-yaml';

export type KeyedConfig = {
  [key: string]: any;
};
export class Constants {

  public static DEFAULTS: { [key: string]: any } = {
    APP_NAME: 'omics-quilt',
    BENCHLING_API_FILE: 'benchling.yaml',
    BENCHLING_API_URL: 'https://quilt-dtt.benchling.com/api/v2',
    CDK_DEFAULT_EMAIL: 'test@example.com',
    TEST_KEYED_FILE: './workflows/fastq/aws_region.json',
    READY2RUN_WORKFLOW_ID: '9500764',
    MANIFEST_ROOT: 'fastq',
    MANIFEST_SUFFIX: '.json',
    QUILT_METADATA: 'quilt_metadata.json',
    FASTQ_SENTINEL: 'out/bqsr_report/NA12878.hg38.recal_data.csv',
    TIMEOUT: '900',
  };

  public static GET(key: string): any {
    const cc = new Constants({});
    return cc.get(key);
  }

  public static GetRegion(): string {
    const cc = new Constants({});
    return cc.region;
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
      region = Constants.GetRegion();
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
    try {
      const response = await s3.send(command);
      const contents = await response.Body!.transformToString();
      const extension = file.split('.').pop()?.toLowerCase();
      return Constants.LoadObjectData(contents, extension!, env);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  public static async SaveObjectURI(uri: string, itme: any): Promise<void> {
    const data = JSON.stringify(itme, null, 2);
    const split = uri.split('://');
    const scheme = split[0];
    if (!scheme || scheme === '' || scheme === 'file' || scheme[0] === '/' || scheme[0] == '.') {
      return writeFileSync(uri, data);
    }
    if (scheme !== 's3') {
      throw new Error(`Unsupported scheme: ${scheme}`);
    }
    const paths = split[1].split('/');
    const s3 = Constants.DefaultS3();
    const bucket = paths[0];
    const file = paths.slice(-1)[0];
    const key = paths.slice(1).join('/');
    console.info(`Saving ${file} to ${bucket} in ${key}`);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
    });
    try {
      const response = await s3.send(command);
      console.debug(response);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
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
    var parsed: any;

    if (extension === 'yaml' || extension === 'yml') {
      parsed = yaml.load(data);
    } else if (extension === 'json') {
      parsed = JSON.parse(data);
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
    if (Array.isArray(parsed)) {
      return parsed[0] as KeyedConfig;
    }
    return parsed as KeyedConfig;
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

  public readonly app: string;
  public readonly account: string;
  public readonly region: string;
  private context: any;

  constructor(context: any) {
    this.context = context;
    this.updateContext(process.env);
    this.updateContext(Constants.DEFAULTS);
    this.app = this.get('APP_NAME');
    this.account = this.get('CDK_DEFAULT_ACCOUNT') || this.get('AWS_ACCOUNT_ID');
    this.region = this.get('CDK_DEFAULT_REGION') || this.get('AWS_DEFAULT_REGION');
  }

  public toDict(): KeyedConfig {
    return {
      app: this.app,
      account: this.account,
      region: this.region,
    };
  }

  public toString(): string {
    return JSON.stringify(this.toDict());
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
      account: this.account,
      region: this.region,
      email: this.get('CDK_DEFAULT_EMAIL'),
    };
  }

  public getAcctRegion(): string {
    return `${this.region}:${this.account}`;
  }

  public getBucketName(type: string): string {
    return `${this.app}-cka-${type}-${this.account}-${this.region}`;
  }

  public getEcrRegistry(): string {
    return `${this.account}.dkr.ecr.${this.region}.amazonaws.com`;
  }
  public getParameterName(name: string): string {
    return `/vivos/${this.app}/${name}`;
  }

  public timeout(): number {
    return parseInt(this.get('TIMEOUT'));
  }
}

export default Constants;
