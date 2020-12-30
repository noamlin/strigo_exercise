const { MongoClient } = require('mongodb');

const opts = {
	useNewUrlParser: true,
	useUnifiedTopology: true,
}

module.exports.connect = function(uri, dbName) {
	return new Promise((resolve, reject) => {
		MongoClient.connect(uri, opts).then(client => {
			db = client.db(dbName);
			resolve(db);
		}).catch(err => {
			reject(err);
		});
	});
}