import { awscdk } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  description: 'Use CDK to create Quilt packages from AWS HealthOmics',
  name: 'omics-quilt-demo',
  projenrcTs: true,
  deps: [
    'aws-lambda',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-sns',
    '@aws-sdk/client-omics',
    'dotenv',
    'handlebars',
    'js-yaml',
    'uuid',
    '@types/uuid',
    '@types/js-yaml',
  ],
  devDeps: [
    'eslint',
  ],
  gitignore: [
    '.env*',
    '.DS_Store',
    'test/__snapshots__/*',
  ],
});
project.tryFindObjectFile('.github/workflows/build.yml')!.addOverride('jobs.build.env', {
  CI: 'true',
  AWS_ACCOUNT_ID: '${{ secrets.AWS_ACCOUNT_ID }}',
  AWS_DEFAULT_REGION: '${{ secrets.AWS_DEFAULT_REGION }}',
  CDK_APP_NAME: '${{ secrets.CDK_APP_NAME }}',
  CDK_DEFAULT_ACCOUNT: '${{ secrets.AWS_ACCOUNT_ID }}',
  CDK_DEFAULT_REGION: '${{ secrets.AWS_DEFAULT_REGION }}',
  CDK_DEFAULT_EMAIL: '${{ secrets.CDK_DEFAULT_EMAIL }}',
  QUILT_CATALOG_DOMAIN: '${{ secrets.QUILT_CATALOG_DOMAIN }}',
});
// Fix Jest 29 warning about deprecated config in `globals`
project.jest!.config.transform ??= {};
project.jest!.config.transform['\\.ts$'] = [
  'ts-jest',
  project.jest?.config.globals['ts-jest'],
];
delete project.jest!.config.globals['ts-jest'];
project.synth();
