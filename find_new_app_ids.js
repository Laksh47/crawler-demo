#!/usr/bin/env node
var gplay = require('google-play-scraper');
var amqp = require('amqplib');
var config = require('config')

var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('taskQueueName')

var similarAppsQueue = config.get('similarAppsQueueName')
var fs = require('fs')
var filepath = config.get('filePathToAppIds')
var grepit = require('grepit');

amqp.connect(rabbitMQurl).then(function(conn) {
	process.once('SIGINT', function() { conn.close(); });
	return conn.createChannel().then(function(ch) {
		var contents = fs.readFileSync(filepath, 'utf8');
		var ids = contents.split("\n")
		var randomIds = [];
		
		for(var i=0; i<25; i++) {
			var randomIndex = Math.floor(Math.random() * (ids.length-1));
			if(ids[randomIndex] && ids[randomIndex].length) randomIds.push(ids[randomIndex])
		}
		reQueueSimilarApps(randomIds); // populate the queue with some initial 50 ids

		// consuming from the same Queue
		var ok = ch.assertQueue(similarAppsQueue, {durable: true, maxLength: 10000});
		ok = ok.then(function() { ch.prefetch(1); });
		ok = ok.then(function() {
			ch.consume(similarAppsQueue, doWork, {noAck: false});
			console.log(" [*] Waiting for messages. To exit press CTRL+C");
		});
		return ok;

		function doWork(msg) {
			var docid = msg.content.toString();
			console.log(docid);

			var delay = Math.floor(Math.random() * ((15-5)+1) + 5); //random number between 5 & 15
			delay = 1000
			delay = delay * 1000

			gplay.similar({appId: docid}).then((data) => {
				console.log('Similar apps found: '+ data.length);
				if (data.length > 0) {
					var similarIds = data.map((item) => { return item.appId });
					checkAndEnQ(similarIds);
					reQueueSimilarApps(similarIds);

					acknowledgeToQ(msg, delay, " [x] Done");
				} else acknowledgeToQ(msg, delay, " [x] Done");
			}).catch((err) => {
				console.log('Error requesting Google');
				console.log(err);
				acknowledgeToQ(msg, delay, " [x] failure Done");
			}); //end gplay similar api call
		}

		function checkAndEnQ(similarIds) {
			similarIds.forEach((id) => {
				var result = grepit(id, filepath); //searches in the file
				if(result && result.length == 0) { //newAppId found
					pushToTaskQ(id); //pushes to metadata queue
					var writeStream = fs.createWriteStream(filepath, {'flags': 'a'});
					writeStream.end('\n'+id); //adds entry to the file.txt
				}
			});
		} //end checkAndEnQ function

		function pushToTaskQ(msg) {
			var ok = ch.assertQueue(taskQueue, {durable: true});

			return ok.then(function() {
	        if (msg && msg.length) {
            ch.sendToQueue(taskQueue, Buffer.from(msg), {deliveryMode: true});
            console.log('new Id pushing to taskQueue: ' + msg);
          }
	    });
		} //end pushToTaskQ function

		function reQueueSimilarApps(idArray) {
			var ok = ch.assertQueue(similarAppsQueue, {durable: true, maxLength: 10000});
			console.log('reQueing for similar apps Queue..');

			return ok.then(function() {
				idArray.forEach((msg) => {
					if (msg && msg.length) {
            ch.sendToQueue(similarAppsQueue, Buffer.from(msg), {deliveryMode: true});
          }
				});
	    });
		} //end reQueueSimilarApps function

		function acknowledgeToQ(msg, time, log) {
			setTimeout(function() {
				console.log(log);
				ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
			}, time);
		}
	});
}).catch(console.log); //end of ampq
