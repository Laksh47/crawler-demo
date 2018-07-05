## Things needed to be installed (Ubuntu 16.04)

### MongoDB
    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org
    sudo systemctl enable mongod
    sudo service mongod restart

### RabbitMQ server
    sudo apt-get update
    sudo apt-get install -y rabbitmq-server
    sudo rabbitmq-plugins enable rabbitmq_management
    sudo rabbitmq-plugins enable rabbitmq_shovel rabbitmq_shovel_management
    sudo rabbitmq-server restart &

### nodeJS
    sudo apt install curl
    sudo curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    sudo apt-get install -y nodejs

# Client - server architecture

############ SERVER ############

### MongoDB installation: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list
sudo apt-get update
sudo apt-get install -y mongodb-org

### MongoDB configuration

1. Edit file /etc/mongod.conf
	- set variable dbpath to point to external mounted storage
	
2. Enable and restart mongo service
	sudo systemctl enable mongod
	sudo service mongod restart
	
3. Enable mongo authentication
	- Enter mongo shell by typing command "mongo" in the terminal
	- Run in mongo shell (please change the password):
		use admin
		db.createUser({ user: "application", pwd: "test", roles: [ "root" ] })
	- Then go to /etc/mongod.conf file and add the following lines (use spaces not tabs for indentation)
		bindIp: 0.0.0.0
		security:
    	  authorization: "enabled"

4. Restart mongo service
	sudo service mongod restart

### RabbitMQ installation
sudo apt-get update
sudo apt-get install -y rabbitmq-server
sudo rabbitmqctl stop

### CONFIGURE FILE /etc/rabbitmq/rabbitmq-env.conf
	Add variable RABBITMQ_MNESIA_BASE=/path/to/external/mounted/storage
	Create dir on external storage and change user ownsership to rabbitmq

sudo rabbitmq-server restart
sudo rabbitmq-plugins enable rabbitmq_management
sudo rabbitmq-plugins enable rabbitmq_shovel rabbitmq_shovel_management
rabbitmqctl add_user application test
rabbitmqctl set_user_tags application administrator
rabbitmqctl set_permissions -p / application ".*" ".*" ".*"

MavenCrawler

1. Install Java
	sudo apt-get install default-jre

---------------------------------------------------------------------------------------------------------------------------------------

############ CLIENT ############

### Install npm and nodeJS
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs

### Clone and install our application

cd /
sudo git clone https://github.com/uw-swag/swag-crawler.git
cd swag-crawler
sudo npm install

### Configure our application and start

1. Edit the following variables in /swag-crawler/config/default.json file:
	- set config "rabbitMQurl" value (change SERVER_ADDRESS) to "amqp://application:test@SERVER_ADDRESS:5672"
	- set config "mongoDBurl" value (change SERVER_ADDRESS) to "mongodb://application:test@SERVER_ADDRESS:27017/DBname?authMechanism=DEFAULT&authSource=admin"
	- set config "filePathToStoreAPKs" to point to external mounted storage
	- set config "googlePassword" to "password"

run the scripts with sudo node!

# swag-crawler
- Make sure mongoDB is up and running, corresponding url is specified in config/default.json
- make sure rabbitMQ is up and running, corresponding url is specified in config/default.json
- make sure the queue names are proper in the config/default.json
- make sure the "path to file containing app ids" is correct and specified in config/default.json

To run as a service on linux: https://hackernoon.com/making-node-js-service-always-alive-on-ubuntu-server-e20c9c0808e4
