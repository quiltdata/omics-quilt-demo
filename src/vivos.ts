import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
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
    protected sns_client: SNSClient;

    constructor(event: any, context: any) {
        this.event = event;
        const detail = event.detail;
        this.event_bucket = (detail) ? detail.bucket.name : '';
        this.event_object = (detail) ? detail.object.key : '';
        this.event_path = new UPath(this.event_object, this.event_bucket, 's3', context);
        this.cc = new Constants(context);
        this.cc.updateContext(this.env_defaults());
        this.sns_client = new SNSClient({});
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

    public getEventObjectURI(): string {
        return `s3://${this.event_bucket}/${this.event_object}`;
    }

    public async getEventObject(): Promise<KeyedConfig> {
        const entry_uri = this.getEventObjectURI();
        return UPath.LoadObjectURI(entry_uri, this.cc.getContext(), this.get('BASE_REGION'));
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

    public toString(): string {
        return JSON.stringify(this.event, null, 2);
    }
}
