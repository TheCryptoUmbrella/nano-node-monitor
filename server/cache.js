const config = require('./config');

//used to report back to nanoNinja
const nanoNinjaCache = {
    nanoNodeAccount: config.ADDRESS,
    version: '',
    currentBlock: 0,
    cementedBlocks: 0,
    uncheckedBlocks:0,
    blockSync: 100,
    stats: null
};


//These values are cached in string, so they can be send directly when a new websocket connection comes inn
const cache = {
    config: JSON.stringify({config: {speedtestEnabled: config.SPEEDTEST_ENABLED, speedtestAddress: config.SPEEDTEST_ADDRESS, version: config.MONITOR_VERSION, repAddress: config.ADDRESS}}),
    version: '',
    block_count: '',
    telemetry: '',
    resources: '',
    delegator_count: '',
    weight: '',
    speedtest: '',
    speedtestActive: JSON.stringify({speedtestActive: false}),
    peers: ''
};

let latestTransactions = [];
let totalVotes = 0;
let accountVotes = 0;
let nodeStatsCache = {};

let callbacks = [];

function registerCacheChange(fn) {
    if (typeof fn === 'function')
        callbacks.push(fn);
}

function updateCacheData(key, data) {
    if (cache[key] === data) return;

    cache[key] = data;

    callbacks.forEach((fn) => {
        fn(data);
    })
}


module.exports = {
    nanoNinjaCache,
    cache,
    latestTransactions,
    totalVotes,
    accountVotes,
    nodeStatsCache,
    registerCacheChange,
    updateCacheData
};