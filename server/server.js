const http = require('http');
const static = require('node-static');

const config = require('./config');
const cacheData = require('./cache');
const wsServer = require('./websocketServer').wsServer;
const speedtestFallback = require('./speedtestTransactionFallback');
const stats = require('./nanoStats')


stats.init();

if (config.SPEEDTEST_ENABLED)
    speedtestFallback.init();





//HTTP server, used for react app and api used by nano ninja
const staticServer = new(static.Server)(__dirname + '/../build');
const server = http.createServer(function (req, res) {

    //this is only used by nano ninja, but we want to support that ❤️
    if(req.url === '/api.php') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write(JSON.stringify(cacheData.nanoNinjaCache));
        res.end()
        return;
    }

    staticServer.serve(req, res);
});

//handle incoming upgrade requests, and hand them over to websocket server
server.on('upgrade', (request, socket, head)=>{
    wsServer.handleUpgrade(request, socket, head, function done(ws) {
        wsServer.emit('connection', ws, request);
    });
});

server.listen(config.SERVER_LISTEN_PORT);
console.log('server is listening on', config.SERVER_LISTEN_PORT);






