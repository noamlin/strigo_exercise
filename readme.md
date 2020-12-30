# Strigo Home Exercise

## Motivation
building a scalable, live data streaming service (within a reasonable time constraint)

## Architecture
There are two services, a message bus and a database. One service is the server for streaming the data to the clients and the other service is a data-access-layer for querying the DB. Kafka is used as a message bus and MongoDB as the database.

## Workflow

### Front-Server
The front-server service is the server in charge of getting clients requests for data or static files. This service requests data from other services, filters out redundant messages and then sends new data or deltas to the client.

### DAL
The data access layer is in charge of DB queries. It has a simple REST interface for clients to ask for events or workspaces. For this exercise the DAL is also making random manipulations to our data model, saving to the DB and then publishing the changes to our message bus.

### Kafka
A simple kafka that runs locally will suffice. You may use the docker-compose file at the ./docker folder for running kafka on a docker container.

### MongoDB
A sample database backup is inside ./mongo folder. Use mongorestore to load it to your database.

### In general
Each service is one file with functions for each phase. This was done to mimic a higher level service where each section (be it folder, file or class) is in charge of different logic.

## Usage
1. Along each service there is a config.json file (./front-server, ./dal). Update those files.
2. Make sure Kafka and MongoDB are up and running.
3. Start the DAL service by executing `npm run dal` in your terminal.
4. Start the front server by executing `npm run main`.
5. Open your browser and navigate to `http://localhost:{port}`.
6. You will not see any fancy GUI (didn't seem relevant to the exercise), just two select boxes hard-coded (making them dynamic also didn't seem relevant to the exercise) with users and events from the sample database.
7. Click `Log In` and you should immediately see an array (at the length of 1 :D) of event name and user's workspaces under it.
8. Every 500 milliseconds the DAL writes an update to the DB and then publishes this update through Kafka.
9. When an update relating your user will be caught by the server, will update the workspace on the server and then will mirror to you.
10.  the workspace (printed as json) should be updated on the-fly. You can also open the console to check and see if it logs changes to the workspace's status field.

## Final Thoughts
For the limited time I had to think and to execute, the solution is good but not perfect. The services can scale horizontally but the front-server is flawed. It holds all of the 'events' from the database and if enough users will connect then it might hold all of the workspaces (meaning the entire database) on the RAM. Possible solutions require restructuring the data model and holding an object per client, instead of all clients subscribing to the same object (the `allEvents` object)