#!/usr/bin/env node

var gplay = require('gpapi');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config')

var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('mongoCollectionName')
var reviewCollectionName = config.get('reviewCollectionName')

var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('taskQueueName')
var apkTaskQueue = config.get('apkTaskQueueName')
var failureQueue = config.get('failureQueueName')
var reviewQueue = config.get('reviewQueueName')
var reviews10KQueue = config.get('reviews10KQueueName')


MongoClient.connect(mongoDBurl, function(err, db) {
	if(!err) {
		console.log("MongoClient connected");
		var collection = db.collection(collectionName);
		var reviewCollection = db.collection(reviewCollectionName);

		amqp.connect(rabbitMQurl).then(function(conn) {
			process.once('SIGINT', function() { conn.close(); });
			return conn.createChannel().then(function(ch) {
				var ok = ch.assertQueue(taskQueue, {durable: true});

				ok = ok.then(function() { ch.prefetch(1); });
				ok = ok.then(function() {
					ch.consume(taskQueue, doWork, {noAck: false});
					console.log(" [*] Waiting for messages. To exit press CTRL+C");
				});
				return ok;

				function doWork(msg) {
					var body = msg.content.toString();
					console.log(" [x] Received '%s'", body);

					var usernames = config.get('usernames');
					var index = Math.floor(Math.random() * usernames.length)

					console.log('Requesting from:' + usernames[index]);

					var delay = Math.floor(Math.random() * ((8-4)+1) + 4); //random number between 4 & 8
					delay = 5
					delay = delay * 1000

					var api = gplay.GooglePlayAPI({
						username: usernames[index],
						password: config.get('googlePassword'),
						androidId: config.get('androidID')
						// apiUserAgent: optional API agent override (see below)
						// downloadUserAgent: optional download agent override (see below)
					});

					// Might need to change the logic to first db query then api request for efficiency

					api.details(body).then((data) => {
						var json = JSON.stringify(data);
	        	json = JSON.parse(json);
	        	json.last_crawled_date = new Date();
	        	// console.log(json);

	        	//Update metadata if already exists in db otherwise insert
	        	collection.find({ docid: body }).toArray(function(err, results) {
							if(results && results.length > 0) {
								var result = results[results.length - 1] //latest(last inserted) document version
								enqueueToReview(json);

								var api_last_upload_date = new Date(json.details.appDetails.uploadDate);
								var db_last_upload_date = new Date(result.details.appDetails.uploadDate);

								api_last_upload_date.setHours(0,0,0,0);
								db_last_upload_date.setHours(0,0,0,0);

								//logic to update only if versionCode is large
								if ((json.details.appDetails.versionCode != result.details.appDetails.versionCode) || (api_last_upload_date != db_last_upload_date)) {
									enqueueToAPK(body, json.details.appDetails.versionCode);
								
									collection.insert(json, function(err, result){
								    if (!err)	console.log("inserted:" + body);
								    else {
								    	console.log("failed:" + body);
								    	console.log(err)
								    }

								    acknowledgeToQ(msg, delay, " [x] Done");
									});
								} else acknowledgeToQ(msg, delay, " [x] Done");
							}
							else {
								collection.insert(json, function(err, result){
							    if (!err) {
							    	console.log("inserted:" + body);
							    	enqueueToAPK(body, json.details.appDetails.versionCode);
							    	enqueueToReview(json);
							    }
							    else {
							    	console.log("failed:" + body);
							    	console.log(err)
							    }

							    acknowledgeToQ(msg, delay, " [x] Done");
								});
							}
						});
					}).catch((err) => {
						var not_ok = ch.assertQueue(failureQueue, {durable: true});
						ch.sendToQueue(failureQueue, Buffer.from(body), {deliveryMode: true});
						console.log(err)
						console.log(" [y] Sent '%s'", body);
						acknowledgeToQ(msg, delay, " [y] Failed");
					}); //end api details
				} //end doWork()

				function acknowledgeToQ(msg, time, log) {
					setTimeout(function() {
						console.log(log);
						ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
					}, time);
				}

				function enqueueToAPK(body, versionCode) {
					var apk = ch.assertQueue(apkTaskQueue, {durable: true});
					var obj = { docid: body, versionCode: versionCode };
					return apk.then(function() {
						ch.sendToQueue(apkTaskQueue, Buffer.from(JSON.stringify(obj)), {deliveryMode: true});
					});
				}

				function enqueueToReview(doc) {
					console.log(doc);
					var reviews = ch.assertQueue(reviewQueue, {durable: true});

					return reviews.then(function() {
						reviewCollection.findOne({ docid: doc.docid }, function(err, result) {
						  var newCommentsCount = doc.aggregateRating.commentCount.low;
						  console.log('Enq to review,')
						  console.log(newCommentsCount)

						  if(result != null) {
						  	var oldCommentsCount = result.totalComments;
						  	console.log(oldCommentsCount)
						  	if(newCommentsCount > oldCommentsCount) {
						  		newCommentsCount = newCommentsCount - oldCommentsCount;
						  	}
						  }

						  var pushToQueue = reviewQueue;
						  var limit = 7;

						  var newPages = Math.ceil( newCommentsCount / 40)
						  if (newPages < limit) {
						  	limit = newPages;
						  }
						  // capture first five pages or new pages of review (make sure it is less than 5 pages all the time)
							for(var i=0; i < limit; i++) {
							  var obj = { docid: doc.docid, page: i, totalComments: doc.aggregateRating.commentCount.low };
							  ch.sendToQueue(pushToQueue, Buffer.from(JSON.stringify(obj)), {deliveryMode: true});
							  console.log(" [a] Sent '%s'", doc.docid);
							}
						});
					});
				}
			}); //channel code end
		}).catch(console.warn); //end amqp 
	} //end-if
	else {
		console.log(err);
	}
}); //end MongoDB conn
