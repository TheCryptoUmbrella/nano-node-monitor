const https = require('https')
const config = require('./config')
const cacheData = require('./cache')

const CHECK_PENDING_TRANSACTIONS_INTERVAL_SECONDS = 60 * 60;

let transactionHistory = [];

async function checkPendingTransactions(){
    const pending = await config.nodeConnection.pending(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching version', e)});
    cacheData.latestTransactions = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching history', e)});


    if (cacheData.latestTransactions && pending && pending.blocks && pending.blocks[config.SPEEDTEST_ADDRESS]) {
        const hashes = pending.blocks[config.SPEEDTEST_ADDRESS];
        for (let i in hashes) {
            console.log('speedtestFallback: sending back hash: ',hashes[i]);
            await sendBlockBack(hashes[i]);
        }
    }

}

async function sendBlockBack(hash) {
    let block = await config.nodeConnection.block(hash).catch((e)=> {console.error('error fetching block', e)});
    let previousHash = cacheData.latestTransactions.history[0].hash;
    if (block.subtype === 'send') {
        let work = await generateWork(cacheData.latestTransactions.history[0].hash, config.RECEIVE_THRESHOLD).catch((e)=>{console.error('error DPoW', e)});
        if (!work) {
            return false
        }
        const result = await config.nodeConnection.receive(config.WALLET, config.SPEEDTEST_ADDRESS,hash, work).catch((e)=>{console.error('error receiving', e)});
        if (!result) {
            return false
        }
        previousHash = result.block;
    } else {
        block = await config.nodeConnection.block(block.contents.link).catch((e)=> {console.error('error fetching block', e)});
    }
    let work = await generateWork(previousHash, config.SEND_THRESHOLD).catch((e) => {
        console.error('speedtestFallback: error DPoW', e)
    })
    if (!work) {
        return
    }
    await config.nodeConnection.send(config.WALLET, config.SPEEDTEST_ADDRESS, block.block_account, block.amount, work).catch((e) => {
        console.error('speedtestFallback: error send back', e)
    });

    return true;
}




async function check(){
    const speedtestActive = JSON.parse(cacheData.cache.speedtestActive).speedtestActive;
    if (speedtestActive) {
        //check again in 5 mins
        setTimeout(check, 60 * 5 * 1000);
    }

   // const pending = await config.nodeConnection.pending(config.SPEEDTEST_ADDRESS).catch((e) => {console.error('error fetching balance',e )});

    //check balance should be 0, if not traverse transactions to find who needs nano back;
    const balance = await config.nodeConnection.balance(config.SPEEDTEST_ADDRESS).catch((e) => {console.error('error fetching balance',e )});

    if (!balance) return console.error('speedtestFallback: error fetching balance:', config.SPEEDTEST_ADDRESS);

    if (balance.error) {
        return console.error('speedtestFallback: error fetching balance, ' , balance.error, config.SPEEDTEST_ADDRESS);
    }

    if (balance.pending !== "0"){
        console.log('speedtestFallback: found pending transactions, handle them');
        //handle pending transactions
        await checkPendingTransactions();
    }

    if (balance.balance !== "0") {

        await generateHistory(0);
        let cache ={};

        for (var i in transactionHistory) {

            if (!cache[transactionHistory[i].account]) cache[transactionHistory[i].account] = BigInt(0);

            if (transactionHistory[i].type === 'send')
                cache[transactionHistory[i].account] += BigInt(transactionHistory[i].amount)
            else
                cache[transactionHistory[i].account] -= BigInt(transactionHistory[i].amount)
        }

        for (var i in cache){

            if (cache[i] !== 0 && cache[i] < 0) {
                const amount = cache[i].toString().replace('-', '');
                cacheData.latestTransactions = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS).catch((e)=> {console.error('error fetching history', e)});
                let work = await generateWork(cacheData.latestTransactions.history[0].hash, config.SEND_THRESHOLD).catch((e) => {
                    console.error('speedtestFallback: error DPoW', e)
                })
                if (!work) {
                    return
                }
                const result = await config.nodeConnection.send(config.WALLET, config.SPEEDTEST_ADDRESS, i, amount, work).catch((e) => {
                    console.error('speedtestFallback: error send back', e)
                });

            }

        }
    }
}


async function generateHistory(offset = 0) {
    const count = 100;

    const temp = await config.nodeConnection.history(config.SPEEDTEST_ADDRESS, count, offset);

    if (temp.history) {
        transactionHistory = transactionHistory.concat(temp.history);
        await generateHistory(offset + count);
    }


}






let initialized = false;
async function init() {

    if (initialized) return;
    await check();
    setInterval(check, CHECK_PENDING_TRANSACTIONS_INTERVAL_SECONDS * 1000);

    //check if there is a balance on the account (should be 0), if there is a balance traverse the transactions to send it back.
}


module.exports = {
    init
}

async function generateWork(hash, threshhold){

    return new Promise((resolve, rej) => {
        const options = {
            hostname: 'mynano.ninja',
            port: 443,
            path: '/api/node',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };


        const data = JSON.stringify({"action": "work_generate", "hash": hash, 'difficulty': threshhold});
        const req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`)

            if (res.statusCode !== 200) return rej();
            let data = '';
            res.on('data', d => {
                data += d;
            });
            res.on('end',() => {
                const json = JSON.parse(data);
                resolve(json.work);
            })
        })

        req.on('error', error => {
            rej();
        })

        req.write(data)
        req.end()
    })

}
