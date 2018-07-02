#!/usr/bin/env node

var gplay = require('google-play-scraper');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config')

var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('mongoCollectionName')
var reviewCollectionName = config.get('reviewCollectionName')
var rabbitMQurl = config.get('rabbitMQurl')
var reviewQueue = config.get('reviewQueueName')
var failureQueue = config.get('reviewFailureQueueName')

MongoClient.connect(mongoDBurl, function(err, db) {
	if(!err) {
		console.log("MongoClient connected");
		var collection = db.collection(collectionName);
		var reviewCollection = db.collection(reviewCollectionName);

		amqp.connect(rabbitMQurl).then(function(conn) {
			process.once('SIGINT', function() { conn.close(); });

			return conn.createChannel().then(function(ch) {
				var ok = ch.assertQueue(reviewQueue, {durable: true});
				ok = ok.then(function() { ch.prefetch(1); });
				ok = ok.then(function() {
					ch.consume(reviewQueue, doWork, {noAck: false});
					console.log(" [*] Waiting for messages. To exit press CTRL+C");
				});
				return ok;

				function doWork(msg) {
					var body = msg.content.toString();
					console.log(" [x] Received '%s'", body);

					var doc = JSON.parse(body);

					var delay = Math.floor(Math.random() * ((8-4)+1) + 4); //random number between 4 & 8
					delay = 18
					delay = delay * 1000

					gplay.reviews({
					  appId: doc.docid,
					  page: doc.page,
					  sort: gplay.sort.NEWEST
					}).then((data) => {
						console.log(data.length);

						if (data.length > 0) {
							reviewCollection.findOne({ docid: doc.docid }, function(err, result) {
								if(result != null) {
									result.reviews = result.reviews.concat(data);
									reviewCollection.update({_id: result._id}, result, function(err, res) {
										if (!err) console.log('Found and updated:' + doc.docid);
										else {
											console.log("failed:" + doc.docid);
											console.log(err)
										}

										acknowledgeToQ(msg, delay, " [x] Done");
									});
								} else if (result == null){
									doc.reviews = data;
									reviewCollection.insert(doc, function(err, result) {
										if (!err) console.log('inserted:' + doc.docid);
										else {
											console.log("failed:" + doc.docid);
											console.log(err)
										}

										acknowledgeToQ(msg, delay, " [x] Done");
									});
								}
							});
						} else { acknowledgeToQ(msg, delay, " [x] Done"); }
					}).catch((err) => {
						var not_ok = ch.assertQueue(failureQueue, {durable: true});
						// var obj = { docid: doc.docid, page: doc.page, totalComments: doc.aggregateRating.commentCount.low };
					  ch.sendToQueue(failureQueue, Buffer.from(JSON.stringify(doc)), {deliveryMode: true});

					  console.log(err)
						console.log(" [y] Sent '%s'", doc.docid);
						acknowledgeToQ(msg, delay, " [y] Failed");
					}); //end gapi reviews api call
				} //end doWork()

				function acknowledgeToQ(msg, time, log) {
					setTimeout(function() {
						console.log(log);
						ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
					}, time);
				}
			}); //channel code end
		}).catch(console.warn); //end amqp 
	}
}); //end mongo connect
