const config = require('./config');
const cacheData = require('./cache');
const os = require('os');
let initialized = false;

const RESOURCE_USAGE_INTERVAL_SECONDS = 30;
const BLOCK_DATA_INTERVAL_SECONDS = 10;
const ACCOUNT_DATA_INTERVAL_SECONDS = 60;


async function resourceUsage() {
    const obj = {
        uptime: os.uptime(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        loadAvg: os.loadavg(),
        cpuInfo: os.cpus()[0].model
    }

    const stats = await config.nodeConnection.stats().catch((e) => {
        console.error('error fetching stats')
    });
    if (stats)
        cacheData.nanoNinjaCache.stats = {counters: stats};

    if (!cacheData.nodeStatsCache) {
        cacheData.nodeStatsCache = new NanoStats(stats)
    } else {
        let newStats = new NanoStats(stats);
        obj.bandwidth = {
            in: Math.round((newStats.bytesIn - cacheData.nodeStatsCache.bytesIn) / RESOURCE_USAGE_INTERVAL_SECONDS),
            out: Math.round((newStats.bytesOut - cacheData.nodeStatsCache.bytesOut) / RESOURCE_USAGE_INTERVAL_SECONDS)
        }

        cacheData.nodeStatsCache = newStats;
    }

    cacheData.updateCacheData('resources',  obj);
}


async function updateBlockData() {
    const telemetry = await config.nodeConnection.telemetry().catch((e)=> {console.error('error fetching telemetry', e)});
    if (telemetry)
        cacheData.updateCacheData('telemetry', telemetry);

    const blockCount = await config.nodeConnection.blockCount().catch((e)=> {console.error('error fetching block count', e)});
    if (blockCount) {
        cacheData.updateCacheData('block_count', blockCount);


        const newCount  = parseInt(blockCount.count);
        const newCementedCount = parseInt(blockCount.cemented);
        if (cacheData.nanoNinjaCache.currentBlock && cacheData.nanoNinjaCache.cementedBlocks) {
            const cps = ((newCementedCount - cacheData.nanoNinjaCache.cementedBlocks) / BLOCK_DATA_INTERVAL_SECONDS).toFixed(2);
            cacheData.updateCacheData('cps', cps);

            const bps = ((newCount - cacheData.nanoNinjaCache.currentBlock) / BLOCK_DATA_INTERVAL_SECONDS).toFixed(2);
            cacheData.updateCacheData('bps',bps);
        }

        cacheData.nanoNinjaCache.currentBlock = newCount;
        cacheData.nanoNinjaCache.uncheckedBlocks = parseInt(blockCount.unchecked);
        cacheData.nanoNinjaCache.cementedBlocks = newCementedCount;

        const networkBlockCount = telemetry && parseInt(telemetry.block_count);
        cacheData.nanoNinjaCache.blockSync = cacheData.nanoNinjaCache.currentBlock > networkBlockCount ? 100 :  Math.round((100 * cacheData.nanoNinjaCache.currentBlock) / networkBlockCount);
    }
}

async function updateAccountData() {
    const delegatorCount = await config.nodeConnection.delegatorCount(config.ADDRESS).catch((e)=> {console.error('error fetching delegator_count', e)});
    if (delegatorCount)
        cacheData.updateCacheData('delegator_count', delegatorCount);

    const weight = await config.nodeConnection.weight(config.ADDRESS).catch((e)=> {console.error('error fetching block count', e)});
    if (weight)
        cacheData.updateCacheData('weight', weight);

    if (config.SPEEDTEST_ENABLED) {
        const latestTransactions = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching block count', e)});
        if (latestTransactions) {
            cacheData.latestTransactions = latestTransactions;
            cacheData.updateCacheData('speedtestTransactions', latestTransactions);
        }
    }

    const peers = await config.nodeConnection.peers().catch((e)=> {console.error('error fetching peers count', e)});
    if (peers) {
        const peerCount = Object.keys(peers.peers).length;
        cacheData.updateCacheData('peers',peerCount);
    }



}

async function updateVersion(){
    const version = await config.nodeConnection.version().catch((e)=> {console.error('error fetching version', e)});
    cacheData.nanoNinjaCache.version = version.node_vendor;
    cacheData.updateCacheData('version', version);
}



class NanoStats {

    created = null;
    bytesIn = 0;
    bytesOut = 0;
    voteGenerator = 0;
    voteAll = 0;

    constructor(data) {
        this.created = data.created;
        for (let i in data.entries) {
            if (data.entries[i].type === 'traffic_tcp') {
                if (data.entries[i].dir === 'in') {
                    this.bytesIn = parseInt(data.entries[i].value);
                } else {
                    this.bytesOut = parseInt(data.entries[i].value);
                }
            } else if (data.entries[i].type === 'vote' && data.entries[i].detail === 'vote_valid') {
                this.voteAll = parseInt(data.entries[i].value);
            } else if (data.entries[i].type === 'vote_generator' && data.entries[i].detail === 'all') {
                this.voteGenerator = parseInt(data.entries[i].value);
            }

        }

    }
}

function init() {
    if (initialized) return;
    initialized = true;

    updateBlockData();
    setInterval(updateBlockData, BLOCK_DATA_INTERVAL_SECONDS * 1000);

    resourceUsage();
    setInterval(resourceUsage, RESOURCE_USAGE_INTERVAL_SECONDS * 1000);

    updateAccountData()
    setInterval(updateAccountData, ACCOUNT_DATA_INTERVAL_SECONDS * 1000);

    updateVersion();
}

module.exports = {
    NanoStats: NanoStats,
    init
};
