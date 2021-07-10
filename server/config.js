const env = process.env.NODE_ENV || 'local';
const packageJson = require('../package');
const dotenv = require('dotenv');
const dotFile = 'env.'+env;
const configResult = dotenv.config({path: process.cwd() +'/' + dotFile});

if (configResult.error) {
    console.error(configResult);
    exit(1);
}

//All the constants we use
const MONITOR_VERSION = packageJson.version;
const WALLET = process.env.WALLET;
const ADDRESS = process.env.NODE_ADDRESS;
const SPEEDTEST_ADDRESS = process.env.SPEEDTEST_ADDRESS;
const NANO_HOST = process.env.NANO_NODE_IP;
const RPC_PORT = parseInt(process.env.NANO_NODE_RPC_PORT);
const WEBSOCKET_PORT = parseInt(process.env.NANO_NODE_WEBSOCKET_PORT);
const SERVER_LISTEN_PORT = parseInt(process.env.SERVER_PORT);
const SPEEDTEST_ENABLED = !!(WALLET && SPEEDTEST_ADDRESS && NANO_HOST && RPC_PORT && WEBSOCKET_PORT);

const RECEIVE_THRESHOLD = 'fffffe0000000000';
const SEND_THRESHOLD = 'FFFFFFF800000000';


if (!SERVER_LISTEN_PORT || !ADDRESS || !NANO_HOST || !ADDRESS || !RPC_PORT || !WEBSOCKET_PORT) {
    console.error('One ore more settings are not set please check your ' + dotFile);
    process.exit(1)
}

const NanoConnection = require('./nanoNodeConnection');
const nodeConnection = new NanoConnection({host: NANO_HOST,rpcPort:RPC_PORT, socketPort: WEBSOCKET_PORT});

if (SPEEDTEST_ENABLED) {
    nodeConnection.subscribe('confirmation', {
        "all_local_accounts": true
    });
}




module.exports = {
    MONITOR_VERSION,
    WALLET,
    ADDRESS,
    SPEEDTEST_ADDRESS,
    NANO_HOST,
    RPC_PORT,
    WEBSOCKET_PORT,
    SERVER_LISTEN_PORT,
    SPEEDTEST_ENABLED,
    RECEIVE_THRESHOLD,
    SEND_THRESHOLD,
    nodeConnection
};
