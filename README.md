# omics-quilt-demo

Use CDK to create Quilt packages from AWS HealthOmics

## Usage

```bash
aws configure list-profiles # ensure it is setup properly
yarn install
npx cdk bootstrap # if not yet done for this account/region
npm run deploy
```

## Development

Uses [pre-commit](https://pre-commit.com/) to pre-lint files.

```bash
pre-commit install
pre-commit run --all-files
```

Uses [projen](https://github.com/projen/projen) to manage project files.

```bash
yarn install
npm run projen
npm run eslint
npm run build
npm run test:watch
```
