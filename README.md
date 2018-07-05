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


# swag-crawler
- Make sure mongoDB is up and running, corresponding url is specified in config/default.json
- make sure rabbitMQ is up and running, corresponding url is specified in config/default.json
- make sure the queue names are proper in the config/default.json
- make sure the "path to file containing app ids" is correct and specified in config/default.json

To run as a service on linux: https://hackernoon.com/making-node-js-service-always-alive-on-ubuntu-server-e20c9c0808e4
