import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Document, OpenAPIClientAxios, OpenAPIClient } from 'openapi-client-axios';
import { Constants, KeyedConfig } from './constants';
import { UPath } from './upath';

export class Vivos {

    public static ENVARS = [
        //'BASE_API',
        //'BASE_CONFIG',
        'OPEN_API_FILE',
        'OPEN_API_KEY',
        'OPEN_API_URL',
        'STATUS_TOPIC_ARN',
    ];

    public readonly event_bucket: string;
    public readonly event_object: string;
    public readonly event_path: UPath;
    protected event: any;
    protected cc: Constants;
    protected api_file: string;
    protected api_key: string;
    protected api_url: string;
    protected sns_client: SNSClient;
    private _api: OpenAPIClientAxios | undefined;

    constructor(event: any, context: any) {
        this.event = event;
        const detail = event.detail;
        this.event_bucket = (detail) ? detail.bucket.name : '';
        this.event_object = (detail) ? detail.object.key : '';
        this.event_path = new UPath(this.event_object, this.event_bucket, 's3', context);
        this.cc = new Constants(context);
        this.cc.updateContext(this.api_defaults());
        this.cc.updateContext(this.env_defaults());
        this._api = undefined;
        this.api_file = this.cc.get('OPEN_API_FILE');
        this.api_key = this.cc.get('OPEN_API_KEY');
        this.api_url = this.cc.get('OPEN_API_URL');
        this.sns_client = new SNSClient({});
    }

    public api_defaults(): KeyedConfig {
        return {
            BASE_API: 's3://vivos-pipes/api',
            BASE_CONFIG: 's3://vivos-pipes/config',
            BASE_REGION: 'us-east-1',
            PETSTORE_API_FILE: 'petstore.yaml',
            PETSTORE_API_URL: 'https://petstore.swagger.io/v2',
        };
    }

    public env_defaults(): KeyedConfig {
        return {
            OPEN_API_FILE: this.cc.get('PETSTORE_API_FILE'),
        };
    }

    public defaultProps(): KeyedConfig {
        return {
            env: {
                account: this.get('CDK_DEFAULT_ACCOUNT'),
                region: this.get('CDK_DEFAULT_REGION'),
            },
            email: this.get('CDK_DEFAULT_EMAIL'),
        };
    }

    public async api(reset: boolean = false): Promise<OpenAPIClientAxios> {
        if (reset || this._api === undefined) {
            this._api = await this.api_client(this.api_file);
        }
        return this._api;
    }

    public async client(): Promise<OpenAPIClient> {
        const this_api = await this.api();
        return this_api.getClient();
    }

    public getEventObjectURI(): string {
        return `s3://${this.event_bucket}/${this.event_object}`;
    }

    public async getEventObject(): Promise<KeyedConfig> {
        const entry_uri = this.getEventObjectURI();
        return UPath.LoadObjectURI(entry_uri, this.cc.context);
    }

    // log message to STATUS_TOPIC_ARN if defined
    public async log(message: string): Promise<void> {
        if (typeof message !== 'string' || message === '') {
            return;
        }
        const topic_arn = this.cc.get('STATUS_TOPIC_ARN');
        if (typeof topic_arn !== 'string' || topic_arn === '') {
            return;
        }
        if (message.includes('"eventVersion": "0.0"')) {
            return; // testing event-launch.json
        }
        const params = {
            Message: message,
            TopicArn: topic_arn,
        };
        console.debug(`log: ${JSON.stringify(params)}`);
        try {
            const command = new PublishCommand(params);
            await this.sns_client.send(command);
        } catch (e: any) {
            console.error(params, e);
        }
    }

    public get(key: string): string {
        const value = this.cc.get(key);
        if (typeof value !== 'string' || value === '') {
            throw new Error(`get[${key}] not a valid string: ${value}`);
        }
        return value;
    }

    protected tokenType(): string {
        return 'Bearer';
    }

    public async api_config(filename: string): Promise<Document> {
        const api_path = `${this.get('BASE_API')}/${filename}`;
        const config = await UPath.LoadObjectURI(
            api_path,
            this.cc.context,
            this.get('BASE_REGION'),
        );
        return config as Document;
    }

    public async api_client(filename: string): Promise<OpenAPIClientAxios> {
        const yaml_doc = await this.api_config(filename);
        let options = {
            definition: yaml_doc,
            axiosConfigDefaults: {},
        };
        if (typeof this.api_key === 'string') {
            options.axiosConfigDefaults = {
                withCredentials: true,
                headers: {
                    Authorization: `${this.tokenType()} ${this.api_key}`,
                },
            };
        }
        if (typeof this.api_url !== 'string') {
            return new OpenAPIClientAxios(options);
        } else {
            const server = {
                ...options,
                withServer: { url: this.api_url, description: `OPEN_API_URL for ${filename}` },
            };
            return new OpenAPIClientAxios(server);
        }
    }

    public async api_post(path: string, params: any): Promise<any> {
        const client = await this.client();
        try {
            const response = await client.post(path, params);
            return response;
        } catch (e: any) {
            console.error(this, e);
            throw `Failed to invoke POST ${path} with ${params}`;
        }
    }

    public async api_get(path: string): Promise<any> {
        const client = await this.client();
        try {
            const response = await client.get(path);
            return response;
        } catch (e: any) {
            console.error(this, e);
            throw `Failed to invoke GET ${path}`;
        }
    }

    public toDict(): any {
        return {
            event: this.event,
            api_file: this.api_file,
            api_key: this.api_key,
            api_url: this.api_url,
            api: this._api,
        };
    }

    public toString(): string {
        return JSON.stringify(this.toDict(), null, 2);
    }
}
