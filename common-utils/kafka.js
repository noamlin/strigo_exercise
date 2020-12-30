const { v4: uuidv4 } = require('uuid');
const { Kafka } = require('kafkajs');

function setUp(bootstrap_servers, asType) {
	const kafka = new Kafka({
		brokers: [bootstrap_servers]
	});

	return new Promise((resolve, reject) => {
		let entity;
		if(asType === 'consumer') entity = kafka.consumer({ groupId: uuidv4() });
		else entity = kafka.producer();
		
		entity.connect()
		.then(() => {
			resolve(entity);
		})
		.catch((err) => {
			reject(err);
		});
	});
}

module.exports.consumerConnect = function(bootstrap_servers) {
	return setUp(bootstrap_servers, 'consumer');
}
module.exports.producerConnect = function(bootstrap_servers) {
	return setUp(bootstrap_servers, 'producer');
}