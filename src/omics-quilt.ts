import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import {
  AccountPrincipal,
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
import { type Construct } from 'constructs';
import { Constants } from './constants';

export class OmicsQuiltStack extends Stack {
  public readonly inputBucket: Bucket;
  public readonly outputBucket: Bucket;
  public readonly statusTopic: Topic;

  public readonly manifest_prefix: string;
  public readonly manifest_suffix: string;

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

    // Create Input/Output S3 buckets
    this.inputBucket = this.makeBucket('input');
    this.outputBucket = this.makeBucket('output');

    // SNS Topic for failure notifications
    const topicName = `${this.cc.app}-status-topic`;
    this.statusTopic = new Topic(this, topicName, {
      displayName: topicName,
      topicName: topicName,
    });

    // Create an EventBridge rule that sends SNS notification on failure
    const ruleWorkflowStatusTopic = new Rule(
      this,
      `${topicName}-role`,
      {
        eventPattern: {
          source: ['aws.omics'],
          detailType: ['Run Status Change'],
          detail: {
            status: ['FAILED', 'COMPLETED', 'CREATED'],
          },
        },
      },
    );

    ruleWorkflowStatusTopic.addTarget(new SnsTopic(this.statusTopic));

    const servicePrincipal = new ServicePrincipal('events.amazonaws.com');
    this.statusTopic.grantPublish(servicePrincipal);
    this.statusTopic.grantPublish(this.principal); // for debugging purposes

    // Create an IAM service role for HealthOmics workflows
    this.omicsRole = this.makeOmicsRole();

    // Create an IAM role for the Lambda functions
    this.lambdaRole = this.makeLambdaRole();

    // Create Lambda function to submit initial HealthOmics workflow
    const fastqWorkflowLambda = this.makeLambda('fastq', {});
    // Add S3 event source to Lambda
    fastqWorkflowLambda.addEventSource(
      new S3EventSource(this.inputBucket, {
        events: [EventType.OBJECT_CREATED],
        filters: [
          { prefix: this.manifest_prefix, suffix: this.manifest_suffix },
        ],
      }),
    );
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
    return bucket;
  }

  private makeLambda(name: string, env: object) {
    const default_env = {
      OMICS_ROLE: this.omicsRole.roleArn,
      OUTPUT_S3_LOCATION: 's3://' + this.outputBucket.bucketName + '/outputs',
      WORKFLOW_ID: this.cc.get('READY2RUN_WORKFLOW_ID'),
      ECR_REGISTRY: this.cc.getEcrRegistry(),
      LOG_LEVEL: 'ALL',
    };
    // create merged env
    const final_env = Object.assign(default_env, env);
    return new NodejsFunction(this, name, {
      runtime: Runtime.NODEJS_18_X,
      role: this.lambdaRole,
      timeout: Duration.seconds(60),
      retryAttempts: 1,
      environment: final_env,
    });
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
    const AWS_REGION = this.cc.get('AWS_REGION');
    const omicsRoleAdditionalPolicy = new PolicyStatement({
      actions: ['s3:Get*', 's3:List*'],
      resources: [
        'arn:aws:s3:::broad-references',
        'arn:aws:s3:::broad-references/*',
        'arn:aws:s3:::giab',
        'arn:aws:s3:::giab/*',
        `arn:aws:s3:::aws-genomics-static-${AWS_REGION}`,
        `arn:aws:s3:::aws-genomics-static-${AWS_REGION}/*`,
        `arn:aws:s3:::omics-${AWS_REGION}`,
        `arn:aws:s3:::omics-${AWS_REGION}/*`,
      ],
    });
    omicsRole.addToPolicy(omicsRoleAdditionalPolicy);
    return omicsRole;
  }
}
