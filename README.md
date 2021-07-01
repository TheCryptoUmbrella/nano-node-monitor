# Realtime Nano node monitor

This is a nano node monitor dashboard which gives you insight in the node status and resource usage of the server.

see it live: [https://nano.thecryptoumbrella.com](https://nano.thecryptoumbrella.com)

![Monitor](https://i.imgur.com/wF9wer9.png)

## Features
- Node's block information / sync status
- Server average resources usage (load / ram / bandwidth)
- Representative info (delegators / voting weight)
- Realtime statistics (Voting / CPU usage / Bandwidth usage)
- Optional: Node transaction speedtest (by default disabled)

## Docker

### Installing Docker image

    sudo docker pull thecryptoumbrella/nano-node-monitor:v1.0.0

#### Docker compose

Besides the default RPC port, it uses nano's websocket for live events so make sure the port is accessible.
Change ports accordingly if you'd like a different setup.

```
version: '3'
services:
  monitor:
    image: "thecryptoumbrella/nano-node-monitor:v1.0.0"
    restart: "unless-stopped"
    ports:
     - "80:80"
    volumes:
     - "~:/opt"
  node:
    image: "nanocurrency/nano:tagVersion"
    restart: "unless-stopped"
    ports:
     - "7075:7075"
     - "127.0.0.1:7076:7076"
     - "127.0.0.1:7078:7078"
    volumes:
     - "~:/root"
```

#### Standalone

Besides the default RPC port, it uses nano's websocket for live events so make sure the port is accessible.
If you'd like to run it stand alone, it is easiest to run it on the "host" network otherwise you would need to configure a docker network.
We recommend to use docker compose, because that solves the network problems.
 

    sudo docker run -d --network=host -p 80:80 -v ~:/opt --restart=unless-stopped --name=nanoMonitor thecryptoumbrella/nano-node-monitor:v1.0.0


## Config

By default a folder named "nanoMonitor" will be created in your home directory and it will contain a file "env.production" and this is where you configure the monitor.
For the most simple usage you would only need to set the "NODE_ADDRESS", which is your representatives nano address.

```
##### React app settings #####

#OPTIONAL Websocket api used by react app, if not set the app will connect a websocket to the domain it is running on.
#eg: wss://mydomain.com/ws
REACT_APP_WS_API_ADDRESS=


##### Server settings #####

#REQUIRED Port the server listens on
SERVER_PORT=80

#REQUIRED representative address
NODE_ADDRESS=

#REQUIRED ip and port info for the nano node
NANO_NODE_IP=127.0.0.1
NANO_NODE_RPC_PORT=7076
NANO_NODE_WEBSOCKET_PORT=7078


#OPTIONAL: WARNING, please read the readme
#Wallet id & speedtest address are used to receive / send back speedtest transactions
#You can leave these fields blank if you dont want the speedtest functionality
WALLET=
SPEEDTEST_ADDRESS=

```
#### Loadbalancers

If you have nginx or any other loadbalancer in front of the server you could use the following setup:

```
server {
		listen 80;
		server_name mydomain.com	

		location / {
			proxy_pass  http://127.0.0.1:8888;
		}

		location /ws {
			proxy_pass http://127.0.0.1:8888;
			proxy_http_version 1.1;
			proxy_set_header Upgrade $http_upgrade;
			proxy_set_header Connection "Upgrade";
			proxy_set_header Host $host;
		}
}

```
And in the env.production use
 
	REACT_APP_WS_API_ADDRESS=ws://mydomain.com/ws


## Speedtest (BETA)

WARNING this is only for advances users. If you don't fully understand the following text, don't enable the speedtest functionality.


#### prerequisites
- RPC Control has to be enabled on the node (make sure it is not accessible from outside)
- Fresh wallet id and nano account have to be created


RPC control has to be enabled otherwise the server is not able to send back any incoming transactions.

A fresh wallet / account is needed, because the server will monitor the given account and make sure all nano is send back to the correct accounts.
Meaning, if someone aborts a speedtest by accident the server will see it and return the funds anyways.
This also means, that if you setup an account which it not fresh the server will start sending back nano (you don't want this).


#### How to enable

1. Enable nodes RPC control
2. Create new wallet id & nano account
3. Add wallet id & nano account to env.production
4. Send 1 transaction to the nano server and make sure it is received (this will be automatically send back), this is needed because we need the previous block hash to calculate PoW.   
5. restart server

 

