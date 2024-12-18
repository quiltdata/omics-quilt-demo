# omics-quilt-demo

Use CDK to create Quilt packages from AWS HealthOmics

## Usage

### Installation

Use CDK to create and deploy the stack.
Note that it requires a large Cloud9 instance to run Docker.

```bash
cp example.env .env # and edit
source .env
aws configure list-profiles # verify AWS credentials exist
# npx npm install # if npm not present (but npx is)
npm install yarn -g # if yarn not present (but npm is)
yarn install
# set bootstrap region (if new or changed)
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
# start Docker if not already running
sudo systemctl start docker # e.g. on Linux (requires large Cloud9 instance!)
npm run deploy
```

You will also need to accept the Subscription from your email client.

#### Note: macOS fails on docker-credential-helper

If running on macOS, you will get an error for `docker-credentials-helper`.
You will need to install and alias that and the `docker-credential-desktop` helper.

```bash
brew install docker-credential-helper
cd /opt/homebrew/bin
ln -s docker-credential-osxkeychain docker-credential-helper
ln -s docker-credential-osxkeychain docker-credential-desktop
```

### Quilt Integration

Use your Quilt Catalog to browse the inputs and outputs

1. Go to AWS Console and find the Omics-Quilt stack
   1. Copy names of the INPUT and OUTPUT buckets
   2. Copy the SNS Topic ARN, with type "AWS::SNS::Topic", e.g. `arn:aws:sns:us-east-1:1234567890:omics-quilt-status-topic`
2. Go your Quilt Catalog
3. Click "+" on the front page (or Admin Settings -> Buckets)
4. Click "+" in the upper right corner to add a new bucket
   1. Name: Physical Name from Stack
   2. Title: Omics Quilt Input / Output
   3. SNS Topic ARN (under Indexing and Notifications)

### Run the Workflow

1. Find or create your region's input parameters file: `./workflows/fastq/<region>.json`
2. Go to Console and find the input bucket
3. Create Folders `fastq` and, inside that, `<region>`
4. Upload the JSON file to `s3://<input-bucket>/fastq/<region>/<region>.json`

If it already exists, set the timestamp to a future time to trigger a new run.

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
