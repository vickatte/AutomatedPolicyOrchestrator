console.log('Loading function');
const aws = require('aws-sdk');
const stepfunctions = new aws.StepFunctions();

exports.handler = async(event, context) => {

    var NextAction = 'delete'
    if(event.requestContext.resourcePath =='/allow'){
        NextAction= 'allow'
    }
    var taskToken = event.queryStringParameters.token
    taskTokenClean = taskToken.split(" ").join("+");
   

console.log(event)

    var params = {
        output: JSON.stringify({"action":NextAction}),
        taskToken: taskTokenClean
    }
    
    await stepfunctions.sendTaskSuccess(params, (err, data) => {
        if (err)
            console.error(err.message);
    }).promise();
    

   return {
        statusCode: '200',
        body: JSON.stringify({action:NextAction}),
        headers: {
            'Content-Type': 'application/json',
        }
    }
   
};