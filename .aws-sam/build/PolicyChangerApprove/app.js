let restrictedActions = process.env.restrictedActions
const AWS = require('aws-sdk')
var iam = new AWS.IAM({apiVersion: '2010-05-08'});
exports.handler = async(event, context) => {


    /* The following command Create a new blank policy version as a placeholder*/
    var params = {
      PolicyArn: event.policyMeta.arn, /* required */
      PolicyDocument: event.policy, /*revert to original edit which is still saved in the SFN data*/
      SetAsDefault: true
    };

    await iam.createPolicyVersion(params, function(err, data) {
      if (err)
        return(err, err.stack); // an error occurred
    }).promise()
    
    return {
      "message": `Policy ${event.policyMeta.policyName} Has been approved ${event.policy} `,
      "action": "remedy"
    };

}
