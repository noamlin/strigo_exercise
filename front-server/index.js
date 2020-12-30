"use strict";
const conf = require('./config.json');
const path = require('path');
const baseDir = path.resolve(__dirname, '../');
const http = require('http');
const OH = require('object-hub');
const kafka = require('../common-utils/kafka.js');
const express = require('express');
const { raw } = require('express');
const app = express();

let rawEvents, //all events as we got from our data provider
	allEvents, //will hold our hub's object
	allEventsInstance, //instance for our object-hub (access class methods etc.)
	consumer, //kafka consumer
	clients = {}; //a map for quickly determining who's online

//connect to kafka as a consumer
kafka.consumerConnect(conf.KAFKA_BOOTSTRAP_SERVERS).then((consumerInstance) => {
	consumer = consumerInstance;
	fetchAllEvents();
});

async function fetchAllEvents() {
	//get all of the events from the database.
	//they are pretty lean and workspaces will be added only later, upon specific client requests
	http.get(`${conf.DAL_ADDR}/events`, (res) => {
		const { statusCode } = res;
		const contentType = res.headers['content-type'];

		let error;
		if(statusCode >= 300) {
			error = new Error(`Request Failed With Status Code: ${statusCode}`);
		} else if(!/^application\/json/.test(contentType)) {
			error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
		}
		if(error) {
			console.error(error.message);
			res.resume(); // Consume response data to free up memory
			return;
		}

		res.setEncoding('utf8');
		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				rawEvents = JSON.parse(rawData); //we have a snapshot of all events and now we can continue
				startServer();
			} catch (e) {
				console.error(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Got error: ${e.message}`);
	});
}

function fetchWorkspaces(eventId) {
	//get all workspaces per event.
	//This could be greatly improved if added an option to get only workspaces of a specific owner
	http.get(`${conf.DAL_ADDR}/events/${eventId}`, (res) => {
		const { statusCode } = res;
		const contentType = res.headers['content-type'];

		let error;
		if(statusCode >= 300) {
			error = new Error(`Request Failed With Status Code: ${statusCode}`);
		} else if(!/^application\/json/.test(contentType)) {
			error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
		}
		if(error) {
			console.error(error.message);
			res.resume(); // Consume response data to free up memory
			return;
		}

		res.setEncoding('utf8');
		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				let workspaces = JSON.parse(rawData);
				for(let workspace of workspaces) {
					addNewWorkspace(workspace);
				}
			} catch (e) {
				console.error(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Got error: ${e.message}`);
	});
}

function startServer() {
	//REST for serving assets for the client
	app.get('/', (req, res) => { res.sendFile(`${baseDir}/public/client.html`); });
	app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/dist/proxserve.min.js`); });
	app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/object-hub/client-side/dist/oh.min.js`); });
	const server = http.createServer(app).listen(conf.PORT);
	console.log(`Server is listening on port ${conf.PORT}`);

	//constructing an object-hub (which uses SocketIO) on the namespace 'events'
	allEvents = new OH('events', server, {});
	allEventsInstance = OH.getInstance(allEvents);
	
	for(let event of rawEvents) {
		//set permissions for the path of the event:
		//reading: clients that can read the specific event they chose to. writing: no one
		allEventsInstance.setPermissions(`.${event.id}`, event.id, 'no_one');
		//construct the raw event into our hub
		allEvents[event.id] = {
			id: event.id,
			name: event.name,
			workspaces: {}
		}
	}

	//handle new socket connections
	allEventsInstance.on('connection', function(client, clientData, init) {
		//if client tried to connect without required parameters or somebody is already connected with his email
		if(!clientData.eventId || !clientData.email || clients[clientData.email]) {
			client.socket.disconnect(true);
			return;
		}
	
		clients[clientData.email] = {
			eventId: clientData.email,
			ohId: client.id
		};
		//set permissions so client can read a specific event, read only his own workspaces
		//and write only to workspaces which he is the owner
		client.setPermissions([clientData.eventId, clientData.email], clientData.email);

		fetchWorkspaces(clientData.eventId);
	
		init();
	});

	allEventsInstance.on('disconnection', function(client, reason) {
		let keys = Object.keys(clients);
		for(let email of keys) {
			if(clients[email].ohId === client.id) {
				delete clients[email];
				break;
			}
		}
	});

	handleKafkaMessages();
}

async function handleKafkaMessages() {
	await consumer.subscribe({ topic: 'WORKSPACE_UPDATE', fromBeginning: false });

	await consumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			let value = message.value.toString();
			let workspace = JSON.parse(value);
			let { eventId, id, owner: email } = workspace;

			if(!clients[email]) return; //was an update regarding a workspace of a client that is not connected
			
			if(!allEvents[eventId].workspaces[id]) {
				addNewWorkspace(workspace);
			} else {
				//update an existing workspace
				allEvents[eventId].workspaces[id].status = workspace.status;
			}
		},
	});
}

function addNewWorkspace(workspace) {
	let { eventId, id, owner: email } = workspace;
	//set permisisons just for the owner of the workspace
	allEventsInstance.setPermissions(`.${eventId}.workspaces.${id}`, email, email);
	//save the new workspace
	allEvents[eventId].workspaces[id] = workspace;
}