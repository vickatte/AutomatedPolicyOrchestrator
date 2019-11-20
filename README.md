# sam-app

This is a SAM template for an Automated policy orchestrator - Below is an explanation of how to deploy the template and build the Step Function state machine:

[Screenshot]: https://raw.githubusercontent.com/bls20AWS/AutomatedPolicyOrchestrator/master/src/img/architecture.png?token=AB5CUU4S75KOIVDE2GJOUDK52VAN4 "Applicaiton Architecture"

architecture

```bash
.
├── README.MD                   <-- This instructions file
├── hello-world                 <-- Source code for a lambda function
├── src
│   └── askUser                 <-- Source code for a lambda function
│   └── app.js                  <-- Lambda function code
│   └── package.json            <-- NodeJS dependencies and scripts
│   └── tests                   <-- Unit tests
│       └── unit
│           └── test-handler.js
├── template.yaml               <-- SAM template
```

## Set up

##### Option 1: Deploy from the Serverless application repository (preferred)


[![button](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/serverlessrepo/home?region=us-east-1#/available-applications)

 :lock:**NOTE**: Note This is a private applicaiton in the Servlerless Applicaiton Repository (SAR), in order to deploy from SAR You must have been granted access.


---

##### Option 2: clone, package and deploy
follow the instructions below in order to deploy from this repository
Clone this repo to your local machine using `https://github.com/bls20AWS/AutomatedPolicyOrchestrator`

Firstly, we need a `S3 bucket` where we can upload our Lambda functions packaged as ZIP before we deploy anything - If you don't have a S3 bucket to store code artifacts then this is a good time to create one:

```bash
aws s3 mb s3://BUCKET_NAME
```

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
## SAM and AWS CLI commands

All commands used throughout this document

```bash
# create a bucket
aws s3 mb s3://BUCKET_NAME
```

```bash
# Build and package application
sam build && sam package \
--output-template-file package.yaml \
--s3-bucket BUCKET_NAME
```

Next, the following command will create a Cloudformation Stack and deploy your SAM resources.

```bash
# Deploy SAM application
sam deploy \
    --template-file package.yaml \
    --stack-name sam-app \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides EmailAddress={YOUR-EMAIL-ADDRESS}

```

```bash
# Creating a new Policy
aws iam create-policy --policy-name my-bad-policy --policy-document file://badpolicy.json
```