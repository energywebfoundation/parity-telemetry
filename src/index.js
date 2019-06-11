const axios = require('axios');
const fs = require('fs');
const WebSocketClient = require('websocket').client;

// Configuration
const wsUrl = process.env.WSURL ? process.env.WSURL : 'ws://127.0.0.1:8546/';
const httpUrl = process.env.HTTPURL ? process.env.HTTPURL : 'http://127.0.0.1:8545/';
const pipeName = process.env.PIPENAME ? process.env.PIPENAME : './output.pipe';

const log = (lvl, msg) => {
    console.log("[" + lvl.toUpperCase() + "] " + msg);
}

// print config
log('info','Parity telemetry starting');
log('info','Using Websocket at ' + wsUrl);
log('info','Using JSON RPC at ' + httpUrl);
log('info','Writing to ' + pipeName);

// Websocket
const ws = new WebSocketClient();
ws.on('connectFailed', function(error) {
    log('error','Error during websocket connect: ' + error.toString());
});
ws.on('connect', function(connection) {

    log('info','WebSocket Client Connected');
    connection.on('error', function(error) {
        log('error',"Websocket Connection Error: " + error.toString());
    });

    connection.on('close', function() {
        log('warning', 'Websocket Connection Closed. Exiting...');
    });

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            const wsData = JSON.parse(message.utf8Data);
            
            if(wsData.params && wsData.params.result) {
                processNewBlock(wsData.params.result);
            }
        }
    });
    
    function subscribeToNewBlocks() {
        if (connection.connected) {
            log('info', 'Websocket connected. Subscribing to new blocks.');
            connection.sendUTF("{\"method\":\"parity_subscribe\",\"params\":[\"eth_getBlockByNumber\",[\"latest\",true]],\"id\":1,\"jsonrpc\":\"2.0\"}");
        }
    }
    
    subscribeToNewBlocks();
});
 
log('info', 'Connecting to parity...');
ws.connect(wsUrl);

const queryHttp = async (method) => {
    try {
        const httpResponse = await axios.post(httpUrl, 
            "{\"method\":\""+method+"\",\"params\":[],\"id\":1,\"jsonrpc\":\"2.0\"}",
            {headers:  {'Content-Type': 'application/json'}});
        if(httpResponse.data && httpResponse.data.result) {
            return httpResponse.data.result;
        } else {
            log('error', 'Unable to query over HTTP for ' + method);
            return null;
        }
    } catch (error) {
        log('error', 'Unable to query over HTTP for ' + method + ':' + error.toString());
        return null;
    }
}

// Parse Block
const processNewBlock = async (blockData) => {
    log('info',"Got new Block: " + parseInt(blockData.number, 16));

    // Query extra data
    const clientVersion = await queryHttp('web3_clientVersion');
    const numPeers = await queryHttp('net_peerCount');

    // Build realtime telemetry data package
    // If you touch this you'll need to adjust telegraf settings also
    const telemetry = {
        client: clientVersion ? clientVersion : 'N/A',
        blockNum: parseInt(blockData.number, 16),
        blockHash: blockData.hash,
        blockTs: parseInt(blockData.timestamp, 16),
        blockReceived: Date.now(),
        numPeers: numPeers ? parseInt(numPeers, 16) : -1,
        numTxInBlock: blockData.transactions.length,
        gasLimit: parseInt(blockData.gasLimit,16),
        gasUsed: parseInt(blockData.gasUsed,16)
    }

    // Write to named pipe
    fs.appendFileSync(pipeName, JSON.stringify(telemetry) + '\n');
}
