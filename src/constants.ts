import 'dotenv/config';

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
