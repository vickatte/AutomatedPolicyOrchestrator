var message = {};
const AWS = require('aws-sdk')
var sns = new AWS.SNS();

exports.handler = async (event,context) => {

    console.log(event)
    var params = {
                    TopicArn: process.env.Topic,
                    Message: 'A restricted Policy change has been detected   ####################   Approve  '+process.env.APIAllowEndpoint+'?token='+JSON.stringify(event.token) +'  ####################   Or Deny  '+process.env.APIDenyEndpoint+'?token='+JSON.stringify(event.token) 
                }
    try {
        const res = sns.publish(params)
    }catch(err){
        console.error(err)
    }         

return event;

};


