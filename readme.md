# Strigo Home Exercise

## Motivation
building a scalable, live data streaming service (within a reasonable time constraint)

## Architecture
There are two services, a message bus and a database. One service is the server for streaming the data to the clients and the other service is a data-access-layer for querying the DB. Kafka is used as a message bus and MongoDB as the database.

## Workflow

### Front-Server
The front-server service is the server in charge of getting clients requests for data or static files. This service requests or streams data from other data services, filters out redundant data and then sends new data or deltas to the client.

### DAL
The data access layer is in charge of DB queries. It has a simple REST interface for clients to ask for events or workspaces. For this exercise the DAL is also making random manipulations for our data model, saving to the DB and then publishing the changes to our message bus.

### Kafka
A simple kafka that runs locally will suffice. You may use the docker-composer files at the ./docker folder for running kafka on docker.

### MongoDB
A sample database backup is in ./mongo folder. Use mongorestore to load it to your database.