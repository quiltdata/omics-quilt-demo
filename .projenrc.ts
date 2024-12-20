import { awscdk } from 'projen';

const cdkVersion = '2.173.2';
const solutionName = 'omics-quilt-demo';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: cdkVersion,
  majorVersion: 1,
  defaultReleaseBranch: 'main',
  description: 'Use CDK to create Quilt packages from AWS HealthOmics',
  name: solutionName,
  projenrcTs: true,
  eslint: true,
  deps: [
    'aws-lambda',
    `@aws-cdk/aws-lambda-python-alpha@^${cdkVersion}-alpha.0`,
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
    '__pycache__', // Python
    '*.pyc', // Python
    '*_metadata.json', // Quilt
    '/build/', // Makefile
    'package-lock.json', // Node
  ],
});
override_file_key('.github/workflows/build.yml', 'jobs.build.env');
/*
const appTestTask = project.addTask('pytest', {
  cwd: 'src/packager',
  exec: 'make test',
});
const testTask = project.tasks.tryFind('test');
testTask?.spawn(appTestTask);
*/
project.addFields({ version: '0.1.1' });
project.synth();


function override_file_key(file: string, key: string) {
  const KEYS = 'AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_ACCOUNT_ID AWS_DEFAULT_REGION CDK_APP_NAME CDK_DEFAULT_EMAIL QUILT_CATALOG_DOMAIN'.split(' ');
  var opts: {[key: string]: string} = { CI: 'true' };
  for (const k of KEYS) {
    opts[k] = `\${{ secrets.${k} }}`;
  }
  opts.CDK_DEFAULT_ACCOUNT = opts.AWS_ACCOUNT_ID;
  opts.CDK_DEFAULT_REGION = opts.AWS_DEFAULT_REGION;

  project.tryFindObjectFile(file)?.addOverride(key, opts);
}
