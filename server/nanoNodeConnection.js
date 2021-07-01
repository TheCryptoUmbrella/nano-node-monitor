const WebSocket = require('ws');
const http = require('http');

class NanoConnection {

    socket = null;
    host = null;
    port = null;
    subscriptions = {};
    realtimeCallbacks = [];
    reconnectTimer = null;

    constructor({host = '127.0.0.1', rpcPort = 7076,socketPort = 7078}) {
        this.host = host;
        this.rpcPort = rpcPort;
        this.socketPort = socketPort;
    }

    connect() {
        //make sure there is not already a connection
        this.disconnect();
        this.socket = new WebSocket(`ws://${this.host}:${this.socketPort}`);
        const self = this;
        this.socket.onopen = function(){
            //if for some reason we disconnecten and we already were subscribed, re-subscribe
            for (let topic in self.subscriptions)
                self.subscribe(topic, self.subscriptions[topic]);
        };
        this.socket.onmessage = this._onMessage.bind(this)
        this.socket.onclose = this._onClose.bind(this)
        this.socket.onerror = function(e) {
            console.log('nano socket error somehow', e);
        }
    }

    subscribe(topic, options) {
        //cache subscriptions for when connection drops and we reconnect, or if we try to subscribe before opening
        this.subscriptions[topic] = options;

        if (!this.socket) {
            this.connect();
        }
        else if (this.socket.readyState === 1) {
            this.socket.send(JSON.stringify({
                action: "subscribe",
                topic: topic,
                options: options
            }))
        }
    }

    unsubscribe(topic) {
        if (this.socket.readyState === 1) {
            delete this.subscriptions[topic];
            this.socket.send(JSON.stringify({
                action: "unsubscribe",
                topic: topic
            }))
        }
    }

    registerWebsocketCallback(fn) {
        if (typeof fn === 'function')
            this.realtimeCallbacks.push(fn);
    }

    deregisterWebsocketCallback(fn) {
        const i = this.realtimeCallbacks.indexOf(fn);
        if(i !== -1)
            this.realtimeCallbacks.splice(i,1);
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    async telemetry() {
        return this._rpcRequest({action: 'telemetry'});
    }

    async blockCount() {
        return this._rpcRequest({action: 'block_count'});
    }

    async delegatorCount(address) {
        return this._rpcRequest({action: 'delegators_count', account: address});
    }

    async weight(address) {
        return this._rpcRequest({action: 'account_weight',account: address});
    }

    async version() {
        return this._rpcRequest({action: 'version'});
    }

    async peers() {
        return this._rpcRequest({action: 'peers'});
    }

    async balance(addr) {
        return this._rpcRequest({
            "action": "account_balance",
            "account": addr
        });

    }

    async send(wallet, source, dest, amount, work) {
        return this._rpcRequest({
            "action": "send",
            "wallet": wallet,
            "destination": dest,
            "source": source,
            "amount": amount,
            "work": work
        });
    }

    async block(hash) {
        return this._rpcRequest({
            "action": "block_info",
            "json_block": "true",
            "hash": hash
        });
    }

    async validateWork(work, hash) {
        return this._rpcRequest({
            "action": "work_validate",
            "work": work,
            "hash": hash
        });
    }

    async setWork(wallet, address, work) {
        return this._rpcRequest({
            "action": "work_set",
            "wallet": wallet,
            "account": address,
            "work": work
        });
    }

    async receive(wallet, account, hash, work) {
        return this._rpcRequest({
            "action": "receive",
            "wallet": wallet,
            "account": account,
            "block": hash,
            "work": work
        });


    }

    async pending(address) {
        return this._rpcRequest({
            "action": "accounts_pending",
            "accounts": [address],
            "count": 10
        })
    }

    async history(account, count = 4, offset) {

        const obj = {
            "action": "account_history",
            "account": account,
            "count": count
        }

        if (offset) {
            obj.offset = offset;
        }

        return this._rpcRequest(obj);
    }

    async stats(){
        return this._rpcRequest({
            "action": "stats",
            "type": "counters"
        });
    }

    _onMessage(e) {
        let data = null;
        try{
            data = JSON.parse(e.data)
        }catch (e) {
            console.error('failed to parse json message from nano node', e);
        }
        if (data) {
            this.realtimeCallbacks.forEach((fn) =>{
                fn(data);
            })
        }


    }

    _onClose() {
        console.log('nano socket close')
        this.socket = null;
        //reconnect in 5 seconds.
        this.reconnectTimer = setTimeout(this.connect.bind(this), 10000);
    }


    async _rpcRequest(obj) {
        return new Promise((resolve, rej) => {
            const data = JSON.stringify(obj)

            const options = {
                hostname: this.host,
                port: this.rpcPort,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }

            const req = http.request(options, res => {
                let data= '';

                res.on('data', d => {
                    data += d;
                });
                res.on('end', () =>{
                    try{
                        data = JSON.parse(data);
                    }catch (e) {
                        rej(e)
                    }
                    resolve(data);
                })
            });

            req.on('error', error => {
                rej(error)
            });

            req.write(data)
            req.end()
        })
    }
}

module.exports = NanoConnection
