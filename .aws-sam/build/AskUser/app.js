var message = {};
const AWS = require('aws-sdk')
var sns = new AWS.SNS();

exports.handler = async (event,context) => {

    console.log(event)
    var params = {
                    TopicArn: process.env.Topic,
                    Message: 'A restricted Policy change has been detected   ####################   Approve  '+process.env.APIAllowEndpoint+'?token='+JSON.stringify(event.token) +'  ####################   Or Deny  '+process.env.APIDenyEndpoint+'?token='+JSON.stringify(event.token) 
                }
    await sns.publish(params, function(err, data) {
    if(err) 
        console.error('error publishing to SNS');
    }).promise();

return event;

};


