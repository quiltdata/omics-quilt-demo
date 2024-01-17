# omics-quilt-demo

Use CDK to create Quilt packages from AWS HealthOmics

## Usage

### Installation

Use CDK to create and deploy the stack.

```bash
cp example.env .env # and edit
aws configure list-profiles # verify AWS credentials exist
npx npm install # if npm not present (but npx is)
npm install yarn -g # if yarn not present (but npm is)
yarn install
npx cdk bootstrap # if not yet done for this account/region
# start Docker if not already running
sudo systemctl start docker # e.g. on Linux (requires large Cloud9 instance!)
npm run deploy
```

You will also need to accept the Subscription from your email client.

### Quilt Integration

Use your Quilt Catalog to browse the inputs and outputs

1. Go to AWS Console and find the Omics-Quilt stack
2. Copy names of the INPUT and OUTPUT buckets
3. Copy the Status Topic ARN?!?
4. Go your Quilt Catalog
5. Click "+" on the front page (or Admin Settings -> Buckets)
6. Click "+" in the upper right corner to add a new bucket
   1. Name: Physical Name from Stack
   2. Title: Omics Quilt Input / Output
   3. SNS Topic ARN

### Run the Workflow

1. Find or create your region's input parameters file: `./workflows/fastq/<region>.json`
2. Go to Console and find the input bucket
3. Create Folders `fastq` and, inside that, `<region>`
4. Upload the JSON file to `s3://<input-bucket>/fastq/<region>/<region>.json`

TODO: Setup a Quilt package push that does this for you

### View the Results

1. Go to the 'packager' Lambda and view the logs
2. Grab the 'quilt+uri' from the output
3. Paste into the URI field of the Quilt Catalog (next to the search bar)
   1. NOTE: May need to click the package name to stop page reloading
4. Click "Expand" (and tripledot menu) to interact with result DataGrids

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
