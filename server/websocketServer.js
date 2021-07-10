const config = require('./config');
const WebSocket = require('ws');
const cacheData = require('./cache');
const realtimeStats = require('./realtimeNanoStats');

//vars for speedtest
let sendBackQueue =[];
let receivePow = null;
let speedtestActive = false;

//keep track of socket with realtime stat enabled
let realtimeWsClients =[];



const wsServer = new WebSocket.Server({ noServer: true });

wsServer.on('connection', function connection(ws) {

    ws.on('message', async (message) => {
        let msg = null;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            console.error("error parsing websocket message", e);
        }

        if (msg) {
            if (msg.subscribe === 'realtimeStats') {
                ws.realtimeIndex = realtimeWsClients.push(ws) - 1;
                ws.realtimeStats = true;
                realtimeStats.enableRealtimeStats();
            } else if (msg.unsubscribe === 'realtimeStats') {
                realtimeWsClients.splice(ws.realtimeIndex, 1);
                delete ws.realtimeIndex;
                if (realtimeWsClients.length === 0)
                    realtimeStats.stopRealtimeStats();
            } else if (msg.receivePow) {
                const result = await config.nodeConnection.validateWork(msg.receivePow, msg.hash).catch((e) => {
                    console.error('error fetching block count', e)
                });

                if (result.valid_receive == '1') {

                    receivePow = msg.receivePow;
                    ws.send(JSON.stringify({receivePow: 'success'}));
                } else {
                    ws.send(JSON.stringify({receivePow: 'failed'}));
                }
            } else if (msg.sendPow) {

                const result = await config.nodeConnection.validateWork(msg.sendPow, msg.hash).catch((e) => {
                    console.error('error fetching block count', e)
                });
                if (result.valid_all == '1') {
                    const latest = sendBackQueue.pop();
                    if (!latest) return

                    config.nodeConnection.send(config.WALLET, config.SPEEDTEST_ADDRESS,latest.block_account, latest.amount,msg.sendPow);
                    speedtestActive = false;
                    sendUpdateForSpeedtestChange();

                }

            } else if (msg.requestStartSpeedtest){
                if (!speedtestActive) {
                    ws.send(JSON.stringify({allowStartSpeedtest: true}))
                    speedtestActive = true;
                    sendUpdateForSpeedtestChange();
                    ws.hasSpeedtest = true;
                } else {
                    ws.send(JSON.stringify({allowStartSpeedtest: false}));
                }
            } else if (msg.stopSpeedtest) {
                ws.hasSpeedtest = false;
                speedtestActive = false;
                sendUpdateForSpeedtestChange();
            }
        }
    });

    ws.on('close', (message)=> {
        if (ws.realtimeIndex >= 0){
            realtimeWsClients.splice(ws.realtimeIndex, 1);
            if (realtimeWsClients.length === 0)
                realtimeStats.stopRealtimeStats();
        }

        if (ws.hasSpeedtest && speedtestActive) {
            speedtestActive = false;
            sendUpdateForSpeedtestChange();
        }


    });

    //send all the latest data
    for(let key in cacheData.cache)
        if (cacheData.cache[key])
            ws.send(cacheData.cache[key]);
});


function pushRealtimStats(data) {
    realtimeWsClients.forEach((client) => {
        client.send(data);
    })
}
realtimeStats.registerForUpdates(pushRealtimStats);

function sendUpdateForSpeedtestChange(){
    cacheData.updateCacheData('speedtestActive', speedtestActive);
}

function pushData(data){
    wsServer.clients.forEach((client) => {
        client.send(data);
    })
}

cacheData.registerCacheChange(pushData);

async function nanoWebsockMessageHandler(data) {
    if (data.topic === 'confirmation') {
            if (speedtestActive && data.message.block.account === config.SPEEDTEST_ADDRESS && data.message.block.subtype === 'receive' && data.message.confirmation_type === 'active_quorum') {
                const block = await config.nodeConnection.block(data.message.block.link);
                sendBackQueue.push(block);

                cacheData.latestTransactions = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching block count', e)});
                cacheData.updateCacheData('speedtestTransactions', cacheData.latestTransactions);
            } else if (data.message.account === config.SPEEDTEST_ADDRESS && data.message.block.subtype === 'send') {
                cacheData.latestTransactions = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching block count', e)});
                cacheData.updateCacheData('speedtestTransactions', cacheData.latestTransactions);
            } else if (receivePow && data.message.block.link_as_account === config.SPEEDTEST_ADDRESS && data.message.block.subtype === 'send' && data.message.confirmation_type === 'active_quorum'){
                const block = await config.nodeConnection.receive(config.WALLET, config.SPEEDTEST_ADDRESS,data.message.hash, receivePow);
                receivePow = null;
            }
    }
}

config.nodeConnection.registerWebsocketCallback(nanoWebsockMessageHandler);

module.exports = {
    wsServer,
    realtimeStatsSubscribers: realtimeWsClients
};


