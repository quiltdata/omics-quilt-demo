import { readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'fs';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  GetObjectAttributesCommand,
  GetObjectAttributesRequest,
  ListObjectsCommand,
  ObjectAttributes,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import handlebars from 'handlebars';
import yaml from 'js-yaml';
// import { fileSync } from 'tmp';
import { Constants, KeyedConfig } from './constants';


export class UPath {

  static S3Attributes: ObjectAttributes[] = [
    ObjectAttributes.OBJECT_SIZE || ObjectAttributes.CHECKSUM || ObjectAttributes.ETAG,
  ];

  public static DefaultS3(region: string = '') {
    if (region === '') {
      region = Constants.GET('AWS_DEFAULT_REGION');
    }
    const s3 = new S3Client({ region: region });
    return s3;
  }

  public static FromURI(uri: string, env: object = {}): UPath {
    const split = uri.split('://');
    const scheme = split[0];
    if (scheme === 'file') {
      return new UPath(split[1], '', scheme, env);
    }
    if (scheme === 's3') {
      const paths = split[1].split('/');
      const bucket = paths[0];
      const key = paths.slice(1).join('/').replace(/^(\.)+\//, '');
      return new UPath(key, bucket, scheme, env);
    }
    if (!scheme || scheme === '' || scheme[0] === '/' || scheme[0] == '.') {
      return new UPath(scheme, '', 'file', env);
    }
    throw new Error(`Unsupported scheme: ${scheme}`);
  }

  /*
    public static TemporaryFile(): UPath {
        const tmpobj = fileSync();
        return new UPath(tmpobj.name, '', 'file');
    }
    */

  // @ts-ignore
  public static async LoadObjectURI(uri: string, env: object = {}, region = ''): Promise<KeyedConfig> {
    const upath = UPath.FromURI(uri, env);
    return upath.parse(region);
  }

  public static LoadObjectFile(filePath: string, env: object = {}): KeyedConfig {
    var fileData = readFileSync(filePath, 'utf-8');
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    return UPath.LoadObjectData(fileData, fileExtension!, env);
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

  readonly scheme: string;
  readonly bucket: string;
  readonly key: string;
  readonly params: object;

  constructor(key: string, bucket = '', scheme = 'file', params = {}) {
    this.bucket = bucket;
    this.scheme = (bucket === '') ? 'file' : scheme;
    this.key = key;
    this.params = params;
  }

  public toURI(): string {
    if (this.scheme === 's3') {
      return `s3://${this.bucket}/${this.key}`;
    } else if (this.scheme === 'file') {
      return this.key;
    } else {
      throw new Error(`Unsupported scheme: ${this.scheme}`);
    }
  }

  public toString(): string {
    return `UPath(${this.toURI()})`;
  }

  public extension(): string {
    const split = this.key.split('.');
    return split.slice(-1)[0];
  }

  public replaceExtension(extension: string): UPath {
    const split = this.key.split('.');
    split.pop();
    split.push(extension);
    const key = split.join('.');
    return new UPath(key, this.bucket, this.scheme, this.params);
  }

  public parent(): UPath {
    const split = this.key.split('/');
    split.pop();
    const key = split.join('/');
    return new UPath(key, this.bucket, this.scheme, this.params);
  }

  public append(suffix: string): UPath {
    const key = `${this.key}/${suffix}`;
    return new UPath(key, this.bucket, this.scheme, this.params);
  }

  public async matchingS3(suffix: string, region = ''): Promise<UPath[]> {
    const s3 = UPath.DefaultS3(region);
    const command = new ListObjectsCommand({
      Bucket: this.bucket,
      Prefix: this.key,
    });
    const response = await s3.send(command);
    const contents = await response.Contents;
    const matches: UPath[] = [];
    for (const object of contents!) {
      const key = object.Key!;
      if (key.endsWith(suffix)) {
        matches.push(new UPath(key, this.bucket, this.scheme, this.params));
      }
    }
    return matches;
  }

  public async load(region = ''): Promise<string> {
    if (this.scheme === 's3') {
      return this.loadS3(region);
    } else if (this.scheme === 'file') {
      return this.loadLocal();
    } else {
      throw new Error(`Unsupported scheme: ${this.scheme}`);
    }
  }

  public async parse(region = ''): Promise<KeyedConfig> {
    const contents = await this.load(region);
    return UPath.LoadObjectData(contents, this.extension(), this.params);
  }

  public async loadS3(region = ''): Promise<string> {
    const s3 = UPath.DefaultS3(region);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });
    const response = await s3.send(command);
    const contents = await response.Body!.transformToString();
    return contents;
  }

  public loadLocal(): string {
    const contents = readFileSync(this.key, 'utf-8');
    return contents.toString();
  }

  public async save(contents: string, region = ''): Promise<void> {
    if (this.scheme === 's3') {
      return this.saveS3(contents, region);
    } else if (this.scheme === 'file') {
      this.saveLocal(contents);
    } else {
      throw new Error(`Unsupported scheme: ${this.scheme}`);
    }
  }

  public async saveS3(contents: string, region = ''): Promise<void> {
    const s3 = UPath.DefaultS3(region);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
      Body: contents,
    });
    await s3.send(command);
  }

  public saveLocal(contents: string): void {
    writeFileSync(this.key, contents);
  }

  public async delete(region = ''): Promise<void> {
    if (this.scheme === 's3') {
      await this.deleteS3(region);
    } else if (this.scheme === 'file') {
      this.deleteLocal();
    } else {
      throw new Error(`Unsupported scheme: ${this.scheme}`);
    }
  }

  public async deleteS3(region = ''): Promise<DeleteObjectCommandOutput> {
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/DeleteObjectCommand/
    const options: DeleteObjectCommandInput = {
      Bucket: this.bucket,
      Key: this.key,
    };
    const s3 = UPath.DefaultS3(region);
    console.log(`delete.options: ${JSON.stringify(options)}`);
    const command = new DeleteObjectCommand(options);

    const response = await s3.send(command);
    console.log(`delete.response: ${JSON.stringify(response)}`);
    return response;
  }

  public deleteLocal(): void {
    unlinkSync(this.key);
  }

  public async getAttributesS3(region = ''): Promise<KeyedConfig> {
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/GetObjectAttributesCommand/
    const options: GetObjectAttributesRequest = {
      Bucket: this.bucket,
      Key: this.key,
      ObjectAttributes: UPath.S3Attributes,
    };
    const s3 = UPath.DefaultS3(region);
    console.log(`getAttributesS3.options: ${JSON.stringify(options)}`);
    const command = new GetObjectAttributesCommand(options);

    const response = await s3.send(command);
    console.log(`getAttributesS3.response: ${JSON.stringify(response)}`);
    return response;
  }

  public getAttributesLocal(): KeyedConfig {
    if (!existsSync(this.key)) {
      return {};
    }
    const stats = statSync(this.key);
    return {
      ObjectSize: stats.size,
      LastModified: stats.mtime,
    };
  }

  public async getAttributes(region = ''): Promise<KeyedConfig> {
    if (this.scheme === 's3') {
      return this.getAttributesS3(region);
    } else if (this.scheme === 'file') {
      return this.getAttributesLocal();
    } else {
      throw new Error(`Unsupported scheme: ${this.scheme}`);
    }
  }

}
