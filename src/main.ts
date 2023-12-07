import { App } from 'aws-cdk-lib';
import { Constants } from './constants';
import { OmicsQuiltStack } from './omics-quilt';

function main() {
  const app = new App();
  const env = { CDK_DEFAULT_REGION: 'us-east-1' };
  const cc = new Constants(env);

  new OmicsQuiltStack(app, cc.app, env);
  // new DiaStack(app, 'vivos-prod', { env: prodEnv });
  app.synth();
}

main();
