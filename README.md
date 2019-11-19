# sam-app

This is a SAM template for an Automated policy orchestrator - Below is an explanation of how to deploy the template and build the Step Function state machine:

```bash
.
├── README.MD                   <-- This instructions file
├── event.json                  <-- API Gateway Proxy Integration event payload
├── hello-world                 <-- Source code for a lambda function
│   └── app.js                  <-- Lambda function code
│   └── package.json            <-- NodeJS dependencies and scripts
│   └── tests                   <-- Unit tests
│       └── unit
│           └── test-handler.js
├── template.yaml               <-- SAM template
```

## Packaging and deployment

Firstly, we need a `S3 bucket` where we can upload our Lambda functions packaged as ZIP before we deploy anything - If you don't have a S3 bucket to store code artifacts then this is a good time to create one:

```bash
aws s3 mb s3://BUCKET_NAME
```

Next, run the following command to package our Lambda function to S3:

```bash

sam build && sam package \
--output-template-file package.yaml \
--s3-bucket BUCKET_NAME
```

Next, the following command will create a Cloudformation Stack and deploy your SAM resources.

```bash
sam deploy \
    --template-file package.yaml \
    --stack-name sam-app \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides EmailAddress={YOUR-EMAIL-ADDRESS}

```

## Creating the Step function

[Screenshot]: /src/images/Step-Functions-Management_Console.png "Step Functions state machine"

Navigate to the [Step Functions console](https://console.aws.amazon.com/states/home?#/statemachines) and click on **edit**.

### State machine Definition
All states will be defined insite `States{}` object:
```bash
{
    "Comment": "Defect detection state machine",
    "StartAt": "ModifyState",
    "States": {
        
    }
}
```
#### MofidyState
Re-structures the input data into a more usable format:
```bash
"ModifyState": {
    "Type": "Pass",
    "Parameters": {
        "policy.$": "$.detail.requestParameters.policyDocument",
        "accountId.$": "$.detail.userIdentity.accountId",
        "region.$": "$.region",
        "policyMeta.$":"$.detail.responseElements.policy"
    },
    "ResultPath": "$",
    "Next": "ValidatePolicy"
},
```

#### ValidatePolicy
Invokes the ValidatePolicy Lambda that checkes the new policy document against the rescricted actions:
```bash
"ValidatePolicy": {
    "Type": "Task",
    "ResultPath":"$.taskresult",
    "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${ValidatePolicy}",
    "Next": "ChooseAction"
},
```

#### TempRemove
Creates a new default version of the policy with only Log permissions and deletes previously created policy version:
```bash
"TempRemove": {
    "Type": "Task",
    "ResultPath":"$.taskresult",
    "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${RevertPolicy}",
    "Next": "AskUser"
},
```

#### ChooseAction
Choice state, branches depending on input from ValidatePolicy step:
```bash
"ChooseAction": {
    "Type" : "Choice",
    "Choices": [
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "remedy",
        "Next": "TempRemove"
        },
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "alert",
        "Next": "AllowWithNotification"
        }
    ],
    "Default": "AllowWithNotification"
},
```
#### AllowWithNotification
Choice state, branches depending on input from ValidatePolicy step:
```bash
"ChooseAction": {
    "Type" : "Choice",
    "Choices": [
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "remedy",
        "Next": "TempRemove"
        },
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "alert",
        "Next": "AllowWithNotification"
        }
    ],
    "Default": "AllowWithNotification"
},
```
#### AllowWithNotification
No restricted actions detected, user is still notificed of change (via SNS email) then executions ends:
```bash
"AllowWithNotification": {
    "Type": "Task",
    "Resource": "arn:aws:states:::sns:publish",
    "Parameters": {
        "TopicArn": "${AlertTopic}",
        "Subject": "Policy change detected!",
        "Message.$": "$.taskresult.message"
    },
    "End": true
},
```

#### AskUser
Restricted action detected, send approval email to user via SNS, with taskToken that initiates the callback pattern:
```bash
"AskUser":{
    "Type": "Task",
    "Resource":"arn:aws:states:::lambda:invoke.waitForTaskToken",
    "Parameters":{  
        "FunctionName":"askUser",
        "Payload":{  
            "token.$":"$$.Task.Token"
            }
    },
    "ResultPath":"$.taskresult",
    "Next": "usersChoice"
},
```

#### usersChoice
Branch based on user's approval/deny action:
```bash
"usersChoice": {
    "Type" : "Choice",
    "Choices": [
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "delete",
        "Next": "denied"
        },
        {
        "Variable": "$.taskresult.action",
        "StringEquals": "allow",
        "Next": "approved"
        }
    ],
    "Default": "denied"
},
```

#### denied
User dennied policy creation, end execution with no further action:
```bash
 "denied": {
    "Type": "Pass",
    "End":true
},
```

#### Approved
Restore innitial policy document by creating as a new version:
```bash
"approved": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${policyChangerApprove}",
    "TimeoutSeconds": 3600,
    "End": true
}
```

## Testing

Use the AWS CLI to create a new policy.  An example policy document has been included in this repository named `badpolicy.json` .

```bash
aws iam create-policy --policy-name my-bad-policy --policy-document file://badpolicy.json
```

## Cleanup

In order to delete our Serverless Application recently deployed you can use the following AWS CLI Command:

```bash
aws cloudformation delete-stack --stack-name sam-app
```

## Bringing to the next level

Here are a few things you can try to get more acquainted with building serverless applications using SAM:

### Learn how SAM Build can help you with dependencies

* Uncomment state machine definition `template.js`

### Step-through debugging

* **[Enable step-through debugging docs for supported runtimes]((https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-debugging.html))**

Next, you can use AWS Serverless Application Repository to deploy ready to use Apps that go beyond hello world samples and learn how authors developed their applications: [AWS Serverless Application Repository main page](https://aws.amazon.com/serverless/serverlessrepo/)

# Appendix

## Building the project

[AWS Lambda requires a flat folder](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-create-deployment-pkg.html) with the application as well as its dependencies in a node_modules folder. When you make changes to your source code or dependency manifest,
run the following command to build your project local testing and deployment:

```bash
sam build
```

If your dependencies contain native modules that need to be compiled specifically for the operating system running on AWS Lambda, use this command to build inside a Lambda-like Docker container instead:
```bash
sam build --use-container
```

By default, this command writes built artifacts to `.aws-sam/build` folder.

## SAM and AWS CLI commands

All commands used throughout this document

```bash
# Invoke function locally with event.json as an input
sam local invoke HelloWorldFunction --event event.json

```

**NOTE**: Alternatively this could be part of package.json scripts section.
