let restrictedActions = process.env.restrictedActions.split(",");
const AWS = require('aws-sdk')
var iam = new AWS.IAM({apiVersion: '2010-05-08'});
exports.handler = async(event, context) => {


    /* The following command Create a new blank policy version as a placeholder*/
    var params = {
      PolicyArn: event.policyMeta.arn, /* required */
      PolicyDocument: '{"Version": "2012-10-17","Statement": [{ "Sid": "VisualEditor0","Effect": "Allow","Action": "logs:GetLogGroupFields", "Resource": "*"}] }',
      SetAsDefault: true
    };

    await iam.createPolicyVersion(params, function(err, data) {
      if (err)
        return(err, err.stack); // an error occurred
    }).promise()
    
    
    
    //Delete the restricted policy version
    var params = {
      PolicyArn: event.policyMeta.arn, /* required */
      VersionId: event.policyMeta.defaultVersionId /* required */
    };
    iam.deletePolicyVersion(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     console.log(data);           // successful response
    });

    return {
      "message": `Policy ${event.policyMeta.policyName} Has been altered and contains restricted Actions: ${event.policy}, please approve or deny this change`,
      "action": "remedy"
    };

}
