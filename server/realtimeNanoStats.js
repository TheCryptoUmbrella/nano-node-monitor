const os = require('os');
const config = require('./config');
const cacheData = require('./cache');
const NanoStats = require('./nanoStats').NanoStats;

const REALTIME_STATS_INTERVAL_SECONDS = 2;
let realtimeUpdateIntervalId = null;
let cpuStatCache = null;
let lastRealtimeCounterStats = null;
let callbacks = [];

async function realtimeStatsUpdate() {

    //Grab second Measure
    const newMeasure = cpuAverage();
    let temp = await config.nodeConnection.stats().catch((e) => {});
    let newCounterStats = new NanoStats(temp);



    //Calculate the difference in idle and total time between the measures
    var idleDifference = newMeasure.idle - cpuStatCache.idle;
    var totalDifference = newMeasure.total - cpuStatCache.total;

    //Calculate the average percentage CPU usage
    var percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
    cpuStatCache = newMeasure;

    const string = JSON.stringify({
        "cpuPercent": percentageCPU,
        "vote": {"account": cacheData.accountVotes, "network": cacheData.totalVotes},
        bandwidth: {
            in: Math.round((newCounterStats.bytesIn - lastRealtimeCounterStats.bytesIn) / REALTIME_STATS_INTERVAL_SECONDS),
            out: Math.round((newCounterStats.bytesOut - lastRealtimeCounterStats.bytesOut) / REALTIME_STATS_INTERVAL_SECONDS)
        }
    });

    callbacks.forEach((cb)=>{
        cb(string);
    });

    cacheData.totalVotes = 0;
    cacheData.accountVotes = 0;
    lastRealtimeCounterStats = newCounterStats;
}

function registerForUpdates(fn) {
    if (typeof fn === 'function')
        callbacks.push(fn);
}


function stopRealtimeStats(){
    if (realtimeUpdateIntervalId) {
        clearInterval(realtimeUpdateIntervalId);
        realtimeUpdateIntervalId = null;
        config.nodeConnection.unsubscribe('vote');
        config.nodeConnection.deregisterWebsocketCallback(voteCallback);
    }
}

async function enableRealtimeStats() {
    if (!realtimeUpdateIntervalId) {
        cpuStatCache = cpuAverage();
        lastRealtimeCounterStats = new NanoStats(await config.nodeConnection.stats());
        config.nodeConnection.subscribe('vote', {
            "include_replays": false,
            "include_indeterminate": false
        });
        config.nodeConnection.registerWebsocketCallback(voteCallback);
        realtimeUpdateIntervalId = setInterval(realtimeStatsUpdate, REALTIME_STATS_INTERVAL_SECONDS * 1000);
    }
}

function voteCallback(data) {
    if (data.topic === 'vote') {
        if (data.message.account === config.ADDRESS)
            cacheData.accountVotes++;
        else
            cacheData.totalVotes++;
    }
}


//Create function to get CPU information
function cpuAverage() {

    //Initialise sum of idle and time of cores and fetch CPU info
    var totalIdle = 0, totalTick = 0;
    var cpus = os.cpus();

    //Loop through CPU cores
    for(var i = 0, len = cpus.length; i < len; i++) {

        //Select CPU core
        var cpu = cpus[i];

        //Total up the time in the cores tick
        for(let type in cpu.times) {
            totalTick += cpu.times[type];
        }

        //Total up the idle time of the core
        totalIdle += cpu.times.idle;
    }

    //Return the average Idle and Tick times
    return {idle: totalIdle / cpus.length,  total: totalTick / cpus.length};
}


module.exports ={
    enableRealtimeStats,
    stopRealtimeStats,
    registerForUpdates
}
