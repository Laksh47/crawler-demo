#!/usr/bin/env node

var gplay = require('gpapi');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config');
var fs = require("fs");

var rabbitMQurl = config.get('rabbitMQurl')
var apkTaskQueue = config.get('apkTaskQueueName')
var apkFailureQueue = config.get('apkFailureQueueName')
var filePath = config.get('filePathToStoreAPKs')

amqp.connect(rabbitMQurl).then(function(conn) {
	process.once('SIGINT', function() { conn.close(); });
	return conn.createChannel().then(function(ch) {
		var ok = ch.assertQueue(apkTaskQueue, {durable: true});
		ok = ok.then(function() { ch.prefetch(1); });
		ok = ok.then(function() {
			ch.consume(apkTaskQueue, doWork, {noAck: false});
			console.log(" [*] Waiting for messages. To exit press CTRL+C");
		});
		return ok;

		function doWork(msg) {
			// console.log(msg);
			var doc = JSON.parse(msg.content.toString());
			var body = doc.docid;
			var version = "0";

			if(doc.versionCode != null) version = doc.versionCode;

			console.log(" [x] Received '%s'", body);

			var filepath = filePath + body + "_"+ version +".apk"

			var usernames = config.get('usernames')
			var index = Math.floor(Math.random() * usernames.length)

			var delay = Math.floor(Math.random() * ((8-4)+1) + 4); //random number between 4 & 8
			delay = 7
			delay = delay * 1000

			var api = gplay.GooglePlayAPI({
				username: usernames[index],
				password: config.get('googlePassword'),
				androidId: config.get('androidID')
				// apiUserAgent: optional API agent override (see below)
				// downloadUserAgent: optional download agent override (see below)
			});

			fs.exists(filepath, (exists) => {
				if(!exists) {
					console.log("New APK!");

					//requesting google play for apk
					api.download(body, doc.versionCode).then(function (res) {
						var myFile = fs.createWriteStream(filepath);
						console.log("Starting: "+ body);

						//write the response to apk file
						res.pipe(myFile);

						res.on('end', () => {
							acknowledgeToQ(msg, delay, "Finished downloading: " + body);
							myFile.end();
						});

						//error when writing to the apk file
						res.on('error', () => {
							console.log("Error downloading: " + body);

							myFile.end(function() {
								fs.unlinkSync(filepath); //delete created file if any error occurs in the middle of download
							});
							errHandle(body, doc.versionCode);
						});
					}, function (err) { //handle error that occurs while requesting for apk file
					  console.error(err.toString());
					  errHandle(body, doc.versionCode);
					});
				} else {
					var log = "APK for " + body + "_"+ doc.versionCode + " exists already, skipping download";
					acknowledgeToQ(msg, 0, log);
				}
			});

			function acknowledgeToQ(msg, time, log) {
				setTimeout(function() {
					console.log(log);
					ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
				}, time);
			}

			function errHandle(body, versionCode) {
				var not_ok = ch.assertQueue(apkFailureQueue, {durable: true});
				var obj = { docid: body, versionCode: versionCode };
				ch.sendToQueue(apkFailureQueue, Buffer.from(JSON.stringify(obj)), {deliveryMode: true});
				acknowledgeToQ(msg, delay, "Failed: " + body);
			}
		}
	}); //channel code end
}).catch(console.warn); //end amqp 
