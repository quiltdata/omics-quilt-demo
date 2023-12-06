import { App } from 'aws-cdk-lib';
import { OmicsQuiltStack } from './omics-quilt';

function main() {
  const app = new App();

  new OmicsQuiltStack(app, 'omics-quilt', { env: { region: 'us-west-2' } });
  // new DiaStack(app, 'vivos-prod', { env: prodEnv });
  app.synth();
}

main();
