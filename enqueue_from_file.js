/**
 * Created by lakshmanan on 12/01/18.
 */

var fs = require('fs')
var amqp = require('amqplib')
var config = require('config')

/* file reading */

var filepath = config.get('filePathToAppIds')
var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('taskQueueName')

console.log("Queing to: " + taskQueue);

var contents = fs.readFileSync(filepath, 'utf8');
var ids = contents.split("\n");

amqp.connect(rabbitMQurl).then(function(conn) {
  return conn.createChannel().then(function(ch) {
    var ok = ch.assertQueue(taskQueue, {durable: true});
    // ok = ch.assertQueue(apkTaskQueue, {durable: true});

    return ok.then(function() {
        ids.forEach((msg) => {
            if (msg && msg.length) {
                ch.sendToQueue(taskQueue, Buffer.from(msg), {deliveryMode: true});
                // ch.sendToQueue(apkTaskQueue, Buffer.from(msg), {deliveryMode: true});
                console.log(" [x] Sent '%s'", msg);
            }
        });
      return ch.close();
    });
  }).finally(function() { conn.close(); });
}).catch(console.warn);