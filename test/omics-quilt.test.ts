import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Constants } from '../src/constants';
import { OmicsQuiltStack } from '../src/omics-quilt';

describe('OmicsQuiltStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new App();
    const region = Constants.GetRegion();

    // Create the OmicsQuiltStack.
    const omicsWorkflowStack = new OmicsQuiltStack(
      app,
      'OmicsQuiltStack',
      { CDK_DEFAULT_REGION: region, CDK_DEFAULT_ACCOUNT: '123456789012' },
    );

    // Prepare the stack for assertions.
    const template = Template.fromStack(omicsWorkflowStack);

    // First, simple verify it created the function.
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
    });

    // Verify it creates the function with the correct properties...
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
      Code: {
        S3Bucket: {
          'Fn::Sub': Match.stringLikeRegexp('.*assets.*'),
        },
        S3Key: Match.stringLikeRegexp('.*.zip'),
      },
      Environment: {
        Variables: {
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        },
      },
    });

    template.resourceCountIs('AWS::SNS::Topic', 1);
    /*template.resourceCountIs('AWS::SNS::TopicPolicy', 1)
    template.hasResourceProperties('AWS::SNS::TopicPolicy',
      {
        PolicyDocument: {
          Statement: [
            {
              Action: 'sns:Publish',
              Effect: 'Allow',
              Principal: {
                Service: 'events.amazonaws.com',
              },
              Resource: {
                Ref: Match.stringLikeRegexp('.*workflowstatustopic.*')
              },
            },
            {

            }
          ],
          Version: '2012-10-17'
        }
      }
    )*/

    // Fully assert the lambdas's IAM role with matchers.
    template.hasResourceProperties(
      'AWS::IAM::Role',
      Match.objectLike({
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
      }),
    );
  });
});
