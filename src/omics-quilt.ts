import * as python from '@aws-cdk/aws-lambda-python-alpha';
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import {
  AccountPrincipal,
  ArnPrincipal,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  Bucket,
  BlockPublicAccess,
  EventType,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { type Construct } from 'constructs';
import { Constants } from './constants';

const PYTHON_LAMBDA = './src/packager/packager';

export class OmicsQuiltStack extends Stack {
  public readonly inputBucket: Bucket;
  public readonly outputBucket: Bucket;

  public readonly manifest_prefix: string;
  public readonly manifest_suffix: string;
  public readonly packager_sentinel: string;

  readonly cc: Constants;
  readonly lambdaRole: Role;
  readonly omicsRole: Role;
  readonly principal: AccountPrincipal;

  constructor(scope: Construct, id: string, env = {}, props?: StackProps) {
    super(scope, id, props);
    this.cc = new Constants(env);
    this.principal = new AccountPrincipal(this.cc.account);
    const manifest_root = this.cc.get('MANIFEST_ROOT');
    this.manifest_prefix = `${manifest_root}/${this.cc.region}`;
    this.manifest_suffix = this.cc.get('MANIFEST_SUFFIX');
    this.packager_sentinel = this.cc.get('FASTQ_SENTINEL');

    // Create Input/Output S3 buckets
    this.inputBucket = this.makeBucket('input');
    this.outputBucket = this.makeBucket('output');

    this.makeParameter('INPUT_BUCKET_NAME', this.inputBucket.bucketName);
    this.makeParameter('OUTPUT_BUCKET_NAME', this.outputBucket.bucketName);
    // SNS Topic for Workflow notifications
    this.makeStatusNotifications(this.principal); // for debugging purposes

    // Create an IAM service role for HealthOmics workflows
    this.omicsRole = this.makeOmicsRole();

    // Create an IAM role for the Lambda functions
    this.lambdaRole = this.makeLambdaRole();

    // Create Lambda function to submit initial HealthOmics workflow
    const fastqLambda = this.makeLambda('fastq', {});
    this.makeParameter('FASTQ_LAMBDA_ARN', fastqLambda.functionArn);
    // Add S3 event source to Lambda
    const fastqTrigger = new S3EventSource(this.inputBucket, {
      events: [EventType.OBJECT_CREATED],
      filters: [
        { prefix: this.manifest_prefix, suffix: this.manifest_suffix },
      ],
    });
    fastqLambda.addEventSource(fastqTrigger);

    const packagerLambda = this.makePythonLambda('packager', {});
    // TODO: trigger on Omics completion event, not report file
    const packagerTrigger = new S3EventSource(this.outputBucket, {
      events: [EventType.OBJECT_CREATED],
      filters: [
        { suffix: this.packager_sentinel },
      ],
    });
    packagerLambda.addEventSource(packagerTrigger);
  }

  private makeParameter(name: string, value: any) {
    if (typeof value != 'string') {
      value = JSON.stringify(value);
    }
    return new StringParameter(this, name, {
      parameterName: this.cc.getParameterName(name),
      stringValue: value,
    });
  }

  private makeStatusNotifications(principal: AccountPrincipal) {
    const topicName = `${this.cc.app}-status-topic`;
    const statusTopic = new Topic(this, topicName, {
      displayName: topicName,
      topicName: topicName,
    });
    this.makeParameter('STATUS_TOPIC_ARN', statusTopic.topicArn);
    const email = this.cc.get('CDK_DEFAULT_EMAIL');
    const subscription = new EmailSubscription(email);
    statusTopic.addSubscription(subscription);
    const servicePrincipal = new ServicePrincipal('events.amazonaws.com');
    statusTopic.grantPublish(servicePrincipal);
    statusTopic.grantPublish(principal);

    // Create EventBridge rule to detect Omics status changes
    const omicsRule = this.makeOmicsEventRule(`${topicName}-omics-rule`);
    omicsRule.addTarget(new SnsTopic(statusTopic));
    // Create EventBridge rule to detect S3 bucket events
    const inputBucketRule = this.makeBucketEventRule(
      this.inputBucket,
      `${topicName}-input-bucket-rule`,
    );
    inputBucketRule.addTarget(new SnsTopic(statusTopic));
    const outputBucketRule = this.makeBucketEventRule(
      this.outputBucket,
      `${topicName}-output-bucket-rule`,
    );
    outputBucketRule.addTarget(new SnsTopic(statusTopic));
    return statusTopic;
  }

  private makeOmicsEventRule(ruleName: string) {
    const ruleOmics = new Rule(this, ruleName,
      {
        eventPattern: {
          source: ['aws.omics'],
          detailType: ['Run Status Change'],
          detail: {
            status: ['*'],
          },
        },
      },
    );
    return ruleOmics;
  }

  private makeBucketEventRule(bucket: Bucket, ruleName: string) {
    const rule = new Rule(this, ruleName, {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['s3.amazonaws.com'],
          eventName: ['PutObject', 'CompleteMultipartUpload'],
          requestParameters: {
            bucketName: [bucket.bucketName],
          },
        },
      },
    });
    return rule;
  }

  private makeBucket(type: string) {
    const name = this.cc.getBucketName(type);
    const bucketOptions = {
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
    };
    const bucket = new Bucket(this, name, bucketOptions);
    bucket.grantDelete(this.principal);
    bucket.grantReadWrite(this.principal);
    const quilt_arn = this.cc.get('QUILT_ROLE_ARN');
    if (quilt_arn) {
      const quilt_principal = new ArnPrincipal(quilt_arn);
      bucket.grantReadWrite(quilt_principal);
    }
    return bucket;
  }

  private makeLambda(name: string, env: object) {
    return new NodejsFunction(this, name, {
      runtime: Runtime.NODEJS_18_X,
      role: this.lambdaRole,
      timeout: Duration.seconds(60),
      retryAttempts: 1,
      environment: this.makeLambdaEnv(env),
    });
  }

  private makePythonLambda(name: string, env: object) {
    return new python.PythonFunction(this, name, {
      entry: PYTHON_LAMBDA,
      runtime: Runtime.PYTHON_3_8,
      role: this.lambdaRole,
      timeout: Duration.seconds(60),
      retryAttempts: 1,
      environment: this.makeLambdaEnv(env),
    });
  }

  private makeLambdaEnv(env: object) {
    const output = ['s3:/', this.outputBucket.bucketName, this.cc.app];
    const input = ['s3:/', this.inputBucket.bucketName, this.manifest_prefix];
    const final_env = {
      ECR_REGISTRY: this.cc.getEcrRegistry(),
      INPUT_S3_LOCATION: input.join('/'),
      LOG_LEVEL: 'ALL',
      OMICS_ROLE: this.omicsRole.roleArn,
      OUTPUT_S3_LOCATION: output.join('/'),
      SENTINEL_FILE: this.packager_sentinel,
      QUILT_METADATA: this.cc.get('QUILT_METADATA'),
      WORKFLOW_ID: this.cc.get('READY2RUN_WORKFLOW_ID'),
      ...env,
    };
    return final_env;
  }

  private makeLambdaRole() {
    const lambdaRole = new Role(this, `${this.cc.app}-lambda-role`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    // Allow the Lambda functions to pass Omics service role to the Omics service
    const lambdaIamPassrolePolicy = new PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [this.omicsRole.roleArn],
    });
    lambdaRole.addToPolicy(lambdaIamPassrolePolicy);

    const lambdaS3Policy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
      resources: [
        this.inputBucket.bucketArn,
        this.outputBucket.bucketArn,
        this.inputBucket.bucketArn + '/*',
        this.outputBucket.bucketArn + '/*',
      ],
    });
    lambdaRole.addToPolicy(lambdaS3Policy);

    const lambdaOmicsPolicy = new PolicyStatement({
      actions: ['omics:StartRun', 'omics:TagResource', 'omics:GetRun'],
      resources: ['*'],
    });
    lambdaRole.addToPolicy(lambdaOmicsPolicy);
    return lambdaRole;
  }

  private makeOmicsRole() {
    const omicsRole = new Role(this, `${this.cc.app}-omics-service-role`, {
      assumedBy: new ServicePrincipal('omics.amazonaws.com'),
    });

    // Limit to buckets from where inputs need to be read
    const omicsS3ReadPolicy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject'],
      resources: [
        this.inputBucket.bucketArn,
        this.outputBucket.bucketArn,
        this.inputBucket.bucketArn + '/*',
        this.outputBucket.bucketArn + '/*',
      ],
    });
    omicsRole.addToPolicy(omicsS3ReadPolicy);

    // Limit to buckets where outputs need to be written
    const omicsS3WritePolicy = new PolicyStatement({
      actions: ['s3:ListBucket', 's3:PutObject'],
      resources: [
        this.outputBucket.bucketArn,
        this.outputBucket.bucketArn + '/*',
      ],
    });
    omicsRole.addToPolicy(omicsS3WritePolicy);

    // ECR image access
    const omicsEcrPolicy = new PolicyStatement({
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchCheckLayerAvailability',
      ],
      resources: [`arn:aws:ecr:${this.cc.getAcctRegion()}:repository/*`],
    });
    omicsRole.addToPolicy(omicsEcrPolicy);

    // CloudWatch logging access
    const omicsLoggingPolicy = new PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:DescribeLogStreams',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        `arn:aws:logs:${this.cc.getAcctRegion()}:log-group:/aws/omics/WorkflowLog:log-stream:*`,
        `arn:aws:logs:${this.cc.getAcctRegion() }:log-group:/aws/omics/WorkflowLog:*`,
      ],
    });
    omicsRole.addToPolicy(omicsLoggingPolicy);

    // KMS access
    const omicsKmsPolicy = new PolicyStatement({
      actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
      resources: ['*'],
    });
    omicsRole.addToPolicy(omicsKmsPolicy);

    // Allow Omics service role to access some common public AWS S3 buckets with test data
    const omicsRoleAdditionalPolicy = new PolicyStatement({
      actions: ['s3:Get*', 's3:List*'],
      resources: [
        'arn:aws:s3:::broad-references',
        'arn:aws:s3:::broad-references/*',
        'arn:aws:s3:::giab',
        'arn:aws:s3:::giab/*',
        `arn:aws:s3:::aws-genomics-static-${this.cc.region}`,
        `arn:aws:s3:::aws-genomics-static-${this.cc.region}/*`,
        `arn:aws:s3:::omics-${this.cc.region}`,
        `arn:aws:s3:::omics-${this.cc.region}/*`,
      ],
    });
    omicsRole.addToPolicy(omicsRoleAdditionalPolicy);
    return omicsRole;
  }
}
