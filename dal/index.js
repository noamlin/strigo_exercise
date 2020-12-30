"use strict";
const conf = require('./config.json');
const mongo = require('../common-utils/mongo.js');
const kafka = require('../common-utils/kafka.js');
const express = require('express');
const app = express();

//connect to a data source (mongodb)
let db;
mongo.connect(conf.MONGO_URI, conf.MONGO_DB).then(dbInstance => {
	db = dbInstance;

	//now get the server up
	app.get('/events', async (req, res) => {
		let docs = await db.collection('events').find().toArray();
		res.send(docs);
	});
	app.get('/events/:eventId', async (req, res) => {
		let eventId = req.params.eventId;
		let docs = await db.collection('workspaces').find({ eventId }).toArray();
		res.send(docs);
	});
	app.listen(conf.PORT);
	console.log(`DAL is listening on port ${conf.PORT}`);

	//connect to kafka as a producer
	kafka.producerConnect(conf.KAFKA_BOOTSTRAP_SERVERS).then(randomWriting);
});

//produce random updates for the exercise
let statuses = ['offline', 'preparing', 'ready', 'terminated', 'deleted'];
function randomWriting(producer) {
	db.collection('workspaces').aggregate([{$sample: {size: 1}}]).next().then(doc => { //get one random doc
		let newStatus = statuses[ Math.floor(Math.random() * statuses.length) ];
		//update the 'status' field of the doc
		db.collection('workspaces').updateOne({_id: doc._id}, { $set: {status: newStatus}}, {upsert: false}).finally(() => {
			//update our doc's object accordingly and then produce to kafka
			doc.status = newStatus;
			producer.send({
				topic: 'WORKSPACE_UPDATE',
				messages: [{ value: JSON.stringify(doc) }],
			});

			//trigger the next iteration
			setTimeout(randomWriting, 500, producer);
		});
	});
}