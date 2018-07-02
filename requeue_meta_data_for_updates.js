#!/usr/bin/env node
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config')

var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('mongoCollectionName')

var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('taskQueueName')

MongoClient.connect(mongoDBurl, function(err, db) {
	if(!err) {
		console.log("MongoClient connected");
		var collection = db.collection(collectionName);

		collection.find({}).forEach(function(doc) {
			console.log(doc.docid);

			//Logic is erroneous as redundant entries in db for same docid with different last_crawled_date -> will lead to reEnq everytime

			collection.find({ docid: doc.docid }).toArray(function(err, results) { 
				if(results.length > 0) {
					var latest = results[results.length - 1] //latest(last crawled) document version

					if(latest.last_crawled_date) {
						var last_crawled_date = new Date(latest.last_crawled_date);
						console.log('contains last_crawled_date: '+ last_crawled_date);
						last_crawled_date.setDate(last_crawled_date.getDate() + 7);
						last_crawled_date.setHours(0,0,0,0);

						var today = new Date();
						today.setHours(0,0,0,0);

						if(last_crawled_date <= today) {
							pushToTaskQ(latest.docid);
						}				
					} else pushToTaskQ(latest.docid);
				}
			});
		});

		function pushToTaskQ(msg) {
			amqp.connect(rabbitMQurl).then(function(conn) {
			  return conn.createChannel().then(function(ch) {
			    var ok = ch.assertQueue(taskQueue, {durable: true});

			    return ok.then(function() {
						var ok = ch.assertQueue(taskQueue, {durable: true});

						return ok.then(function() {
				        if (msg && msg.length) {
			            ch.sendToQueue(taskQueue, Buffer.from(msg), {deliveryMode: true});
			            console.log('pushing Id to taskQueue for update: ' + msg);
			          }
			          return ch.close();
				    });
					});
			  }).finally(function() { 
			  	console.log('done!')
			  	conn.close(); 
			  });
			}).catch(console.warn);
		} //end pushToTaskQ function
	} else console.log(err);
});
