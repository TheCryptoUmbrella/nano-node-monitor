import {Component} from "react";

import blue_loader from './image/nano_logo_blue.gif';
import white_loader from './image/nano_logo_white.gif';
import logo from './image/nano+full+white.svg'
import config from './config'
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';

const NR_ANIMATION_TIME_MS = 750;
export default class App extends Component {
    state = {
        fullPageLoader: true,
        blockStatsLoader: true,
        resourceLoader: true,
        cpuPercentLoader: true,
        speedTestLoader: true,
        voteLoader: true,
        node_block_count: 0,
        node_cemented_count: 0,
        node_unchecked_count: 0,
        ledger_block_count: 0,
        ledger_cemented_count: 0,
        ledger_unchecked_count: 0,
        node_resources_load: 0,
        node_resources_ram_percentage: 0,
        node_resources_uptime: 0,
        node_resources_total_ram_gb: 0,
        node_resources_cpu_model: null,
        node_resources_cpuCores: 0,
        node_resources_bandwith_bytes_in: 0,
        node_resources_bandwith_bytes_out: 0,
        node_vendor: '',
        store_vendor: '',
        account_vote_count: 0,
        network_vote_count: 0,
        node_cpu_percent: 0,
        node_realtime_bandwith_bytes_in: 0,
        node_realtime_bandwith_bytes_out: 0,
        node_realtime_bandwith_percent_in: 0,
        node_realtime_bandwith_percent_out: 0,
        speed_test_history: {},
        realtimeEnabled: false,
        speedtestIsActiveElsewhere: false,
        enableSpeedTest: false,
        speedtestStep: 1,
        speedtestReceivedAt: new Date(),
        speedtestSendAt: new Date(),
        speedtestSendConfirmedAt: new Date(),
        socketConnected: false,
        peers: 0,
        config: {
            speedtestEnabled: false
        }
    };

    RECEIVE_THRESHOLD = 'fffffe0000000000';
    SEND_THRESHOLD = 'FFFFFFF800000000';

    timers = {};
    socket = null;
    telemetryReceived = false;
    blockCountReceived = false;
    closeSocketTimer = null;
    speedtestResetTimer = null;
    reconnectTimer = null;


    async componentWillMount() {

        this._reconnect();
        const self = this;
        document.addEventListener('visibilitychange', function(){

            if (document.hidden) {
                //close socket after 5 mins inactivity
                self.closeSocketTimer = setTimeout(()=>{
                    if (self.socket) {
                        console.log('close socket');
                        self.socket.close();
                        self.socket = null;
                    }
                    self.closeSocketTimer = null;
                }, 5 * 60 * 1000)

            } else {
                if (!self.closeSocketTimer)
                    self._reconnect();
                else {
                    clearTimeout(self.closeSocketTimer);
                    self.closeSocketTimer = null;
                }

            }

        });
    }

    _reconnect() {
        const self = this;
        console.log('reconnect socket');
        if (this.socket) this.socket.close();

        let wsUrl = config.wsApi;
        if (!wsUrl) {
            const url = (new URL(window.location.href));
            const ssl  = url.protocol === 'https:'
            wsUrl = ssl ? 'wss://' : 'ws://';
            wsUrl += url.host;
        }

        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = function() {
            self.setState({socketConnected: true})
        };

        this.socket.onmessage = this._socketMessage.bind(this);
        this.socket.onclose = function() {
            self.socket = null;
            self.setState({socketConnected: false});

            if (!document.hidden) {
                if (self.reconnectTimer) clearTimeout(self.reconnectTimer);
                self.reconnectTimer = setTimeout(self._reconnect.bind(self), 5000);
            }

        }
    }

    componentWillUnmount() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    componentDidMount() {
        setTimeout(this.setState.bind(this, {fullPageLoader: false}), 1500);
    }

    _socketMessage(data) {
        let incomingdata = {};
        try {
            incomingdata = JSON.parse(data.data);
        } catch (e) {
        }


        for (let i in incomingdata)
            switch (i) {
                case 'telemetry':
                    if (this.state.blockStatsLoader && this.blockCountReceived) {
                        this.setState({blockStatsLoader: false});
                    }
                    this.animateNumber('ledger_block_count', this.state.ledger_block_count, incomingdata.telemetry.block_count, NR_ANIMATION_TIME_MS);
                    this.animateNumber('ledger_cemented_count', this.state.ledger_cemented_count, incomingdata.telemetry.cemented_count, NR_ANIMATION_TIME_MS);
                    this.animateNumber('ledger_unchecked_count', this.state.ledger_unchecked_count, incomingdata.telemetry.unchecked_count, NR_ANIMATION_TIME_MS);
                    this.telemetryReceived = true;
                    break;

                case 'block_count':
                    if (this.state.blockStatsLoader && this.telemetryReceived) {
                        this.setState({blockStatsLoader: false});
                    }
                    this.animateNumber('node_block_count', this.state.node_block_count, incomingdata.block_count.count, NR_ANIMATION_TIME_MS);
                    this.animateNumber('node_cemented_count', this.state.node_cemented_count, incomingdata.block_count.cemented, NR_ANIMATION_TIME_MS);
                    this.animateNumber('node_unchecked_count', this.state.node_unchecked_count, incomingdata.block_count.unchecked, NR_ANIMATION_TIME_MS);
                    this.blockCountReceived = true;
                    break;
                case 'resources':
                    if (this.state.resourceLoader) {
                        this.setState({resourceLoader: false});
                    }

                    if (incomingdata.resources.loadAvg)
                        this.setState({node_resources_load: incomingdata.resources.loadAvg[0].toFixed(2)});

                    if (incomingdata.resources.uptime)
                        this.animateNumber('node_resources_uptime', this.state.node_resources_uptime, incomingdata.resources.uptime, NR_ANIMATION_TIME_MS);

                    if (incomingdata.resources.totalMem && incomingdata.resources.freeMem) {
                        if (!this.state.node_resources_total_ram_gb) {
                            const gb = (incomingdata.resources.totalMem / 1024 / 1024 / 1024).toFixed(0);
                            this.setState({node_resources_total_ram_gb: gb});
                        }
                        this.animateNumber('node_resources_ram_percentage', this.state.node_resources_ram_percentage, (100 - ((incomingdata.resources.freeMem / incomingdata.resources.totalMem) * 100).toFixed(0)), NR_ANIMATION_TIME_MS);
                    }


                    if (incomingdata.resources.cpuInfo && !this.state.node_resources_cpu_model) {
                        this.setState({
                            node_resources_cpu_model: incomingdata.resources.cpuInfo
                        })
                    }

                    if (incomingdata.resources.bandwidth && incomingdata.resources.bandwidth.in){
                        this.setState({node_resources_bandwith_bytes_in: incomingdata.resources.bandwidth.in})
                    }

                    if (incomingdata.resources.bandwidth && incomingdata.resources.bandwidth.out){
                        this.setState({node_resources_bandwith_bytes_out: incomingdata.resources.bandwidth.out})
                    }
                    break;
                case 'version':
                    this.setState({
                        store_vendor: incomingdata.version.store_vendor,
                        node_vendor: incomingdata.version.node_vendor
                    })
                    break;
                case 'delegator_count':
                    this.setState({
                        node_delegator_count: incomingdata.delegator_count.count
                    })
                    break;
                case 'weight':
                    this.setState({
                        node_voting_weight: this.rawToNano(incomingdata.weight.weight)
                    })
                    break;
                case 'vote':
                    if (this.state.voteLoader) this.setState({voteLoader: false});
                    this.animateNumber('network_vote_count', this.state.network_vote_count,  this.state.network_vote_count + incomingdata.vote.network, NR_ANIMATION_TIME_MS);
                    this.animateNumber('account_vote_count', this.state.account_vote_count,  this.state.account_vote_count + incomingdata.vote.account, NR_ANIMATION_TIME_MS);
                    break;
                case 'cpuPercent':
                    if (this.state.cpuPercentLoader) this.setState({cpuPercentLoader: false});
                    this.animateNumber('node_cpu_percent', this.state.node_cpu_percent,  incomingdata.cpuPercent, NR_ANIMATION_TIME_MS);
                    break;

                case 'bandwidth':
                    //we do as 50Mbit is 100%, just for the graphs :)
                    const mbitIn = ((Math.round(incomingdata.bandwidth.in / 125000) * 100) / 50);
                    const mbitOut = ((Math.round(incomingdata.bandwidth.out / 125000) * 100) / 50);

                    console.log(Math.round(incomingdata.bandwidth.in / 125000), mbitOut)
                    this.animateNumber('node_realtime_bandwith_bytes_in', this.state.node_realtime_bandwith_bytes_in,  incomingdata.bandwidth.in, NR_ANIMATION_TIME_MS);
                    this.animateNumber('node_realtime_bandwith_bytes_out', this.state.node_realtime_bandwith_bytes_out,  incomingdata.bandwidth.out, NR_ANIMATION_TIME_MS);
                    this.animateNumber('node_realtime_bandwith_percent_in', this.state.node_realtime_bandwith_percent_in,  mbitIn, NR_ANIMATION_TIME_MS);
                    this.animateNumber('node_realtime_bandwith_percent_out', this.state.node_realtime_bandwith_percent_out,  mbitOut, NR_ANIMATION_TIME_MS);
                    break;

                case 'speedtestTransactions':
                    if (this.state.speedTestLoader) {
                        this.setState({speedTestLoader: false});
                    }

                    //we need to start generating send PoW
                    if (this.state.speedtestStep === 2) {
                        this.setState({speedtestStep: 3, speedtestReceivedAt: new Date()});
                        let self = this;

                        //remove the timeout
                        clearTimeout(this.speedtestResetTimer);

                        this._generateWork(incomingdata.speedtestTransactions.history[0].hash,this.SEND_THRESHOLD, (work) => {
                            this.setState({speedtestStep: 4, speedtestSendAt: new Date()});
                            self.socket.send(JSON.stringify({sendPow: work, hash: incomingdata.speedtestTransactions.history[0].hash}))
                        });
                    } else if (this.state.speedtestStep === 4) {
                        this.setState({speedtestStep: 5, speedtestSendConfirmedAt: new Date()});
                    }
                    this.setState({
                        speed_test_history: incomingdata.speedtestTransactions
                    })
                    break;
                case 'receivePow':
                    if (incomingdata.receivePow ==='success') {
                        this.setState({speedtestStep: 2});
                    }
                    break;

                case 'speedtestActive':
                    this.setState({speedtestIsActiveElsewhere: incomingdata.speedtestActive});
                    break;

                case 'allowStartSpeedtest':
                    let self = this;
                    this.setState({enableSpeedTest: true});
                    this.speedtestResetTimer = setTimeout(this.resetSpeedtest.bind(this), 60 * 2 * 1000);
                    this._generateWork(this.state.speed_test_history.history[0].hash,this.RECEIVE_THRESHOLD, (work) => {
                        self.socket.send(JSON.stringify({receivePow: work, hash: this.state.speed_test_history.history[0].hash}))
                    });
                    break;
                case 'peers':
                    this.setState({peers: incomingdata.peers});
                    break
                case 'config':
                    this.setState({config: incomingdata.config});
            }
    }

    resetSpeedtest() {
        this.setState({enableSpeedTest: false, speedtestStep:1});
        this.socket.send(JSON.stringify({stopSpeedtest: true}));
    }

    rawToNano(i, fixed = 2){
        return (parseInt(i) / 1000000000000000000000000000000).toFixed(fixed);
    }

    animateNumber(id, start, end, duration) {
        const self = this;
        const range = end - start;
        let minTimer = 50;
        let stepTime = Math.abs(Math.floor(duration / range));

        stepTime = Math.max(stepTime, minTimer);

        const startTime = new Date().getTime();
        const endTime = startTime + duration;

        function run() {
            const now = new Date().getTime();
            const remaining = Math.max((endTime - now) / duration, 0);
            const value = Math.round(end - (remaining * range));
            self.state[id] = value;
            self.setState(self.state);
            if (value == end) {
                clearInterval(self.timers[id]);
            }
        }

        if (this.timers[id]) clearInterval(this.timers[id]);
        this.timers[id] = setInterval(run, stepTime);
        run();
    }

    toggleRealtime(e) {

        if (!this.state.realtimeEnabled) {
            this.socket.send(JSON.stringify({subscribe: "realtimeStats"}))
        } else {
            this.socket.send(JSON.stringify({unsubscribe: "realtimeStats"}))
        }

        this.setState({
            realtimeEnabled: !this.state.realtimeEnabled
        });

    }

    _formatTransactionTime(transaction){
        const d = new Date(parseInt(transaction.local_timestamp * 1000));
        return `${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
    }

    _generateWork(hash, threshhold, cb){

        let self = this;
        let xhr = new XMLHttpRequest();
        let url = "https://mynano.ninja/api/node";
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                const json = JSON.parse(xhr.responseText);
                cb(json.work);
            } else if (xhr.readyState === 4) {
                self.setState({speedtestStep: 9})
                //most likely DPOW is not working

            }
        };
        let data = JSON.stringify({"action": "work_generate", "hash": hash, 'difficulty': threshhold});
        xhr.send(data);

    }

    enableSpeedTest() {
        if (this.socket)
            this.socket.send(JSON.stringify({requestStartSpeedtest: true}))
    }

    _formatTime(date) {
        return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    }

    _formatNumber(nr){
        if (!nr) return 0;
        return nr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    _formatUptime(time){
        return (time / 3600).toFixed(2);
    }

    _formatBytes(bytes) {
        return (bytes / 125000).toFixed(2);
    }

    render() {

        if (this.state.fullPageLoader) {
            return <Container className={"d-flex flex-column min-vh-100 justify-content-center align-items-center"}>
                <img className={"loader"} src={blue_loader}/>
            </Container>
        }

        return <Container id={"mainContainer"}>
            <Row>
                <Col md={2} xs={4}>
                    <img src={logo}/>
                </Col>
                <Col md={{offset: 7, span: 3}} xs={{span: 6, offset: 2}} className={"text-right"}>
                    <label className="form-switch pt-md-4 pt-2" >
                        <span style={{position: 'absolute', marginLeft: '-153px', fontSize: '15px'}}>Realtime node stats</span>
                        <input type="checkbox" onClick={this.toggleRealtime.bind(this)} />
                            <i></i>
                    </label>
                </Col>
            </Row>
            <Row className={this.state.socketConnected ? 'd-none': ''}>
                <Col xs={12} md={{span:6, offset:3}} className={"center"}>
                    <div className="alert alert-danger text-center" role="alert">
                        API WebSocket connection could not be made, server seems down.
                    </div>
                </Col>
            </Row>
            <Row>
                    <Col xs={12} md={4}>
                    <div className={"statsContainer"}>
                        <h2>Blockcount</h2>
                        <img className={this.state.blockStatsLoader ? 'loader' : "d-none"} src={white_loader}/>
                        <div className={this.state.blockStatsLoader ? 'd-none' : ''}>
                            <table className={"table table-striped table-blocks"}>
                                <thead>
                                <tr>
                                    <th scope="col">Block type</th>
                                    <th scope="col">Node</th>
                                    <th scope="col" style={{width: '38%'}}>Network average</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <th scope="row">Total</th>
                                    <td>{this._formatNumber(this.state.node_block_count)}</td>
                                    <td>{this._formatNumber(this.state.ledger_block_count)}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Cemented</th>
                                    <td>{this._formatNumber(this.state.node_cemented_count)}</td>
                                    <td>{this._formatNumber(this.state.ledger_cemented_count)}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Unchecked</th>
                                    <td>{this._formatNumber(this.state.node_unchecked_count)}</td>
                                    <td>{this._formatNumber(this.state.ledger_unchecked_count)}</td>
                                </tr>
                                </tbody>
                            </table>
                            <p className={"stats-footer text-center"}
                               style={this.state.node_block_count > this.state.ledger_block_count ? {color: 'green'} : {color: 'red'}}>
                                Sync
                                status {Math.round((this.state.node_block_count / this.state.ledger_block_count) * 100)}%
                            </p>
                        </div>
                    </div>
                    </Col>
                    <Col xs={12} md={4}>
                        <div className={"statsContainer"}>
                            <h2>Resources</h2>
                            <img className={this.state.resourceLoader ? 'loader' : "d-none"} src={white_loader}/>
                            <div className={this.state.resourceLoader ? 'd-none' : ''}>
                                <table className={"table table-striped"}>
                                    <tbody>
                                    <tr>
                                        <th scope="row">System load</th>
                                        <td>{this.state.node_resources_load}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Memory used</th>
                                        <td>{this.state.node_resources_ram_percentage}%
                                            ({this.state.node_resources_total_ram_gb} GB)
                                        </td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Uptime</th>
                                        <td>{this._formatUptime(this.state.node_resources_uptime)} Hours</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Bandwidth</th>
                                        <td>⬇️ {this._formatBytes(this.state.node_resources_bandwith_bytes_in)} Mbit/s  ⬆️️ {this._formatBytes(this.state.node_resources_bandwith_bytes_out)}Mbit/s</td>
                                    </tr>
                                    </tbody>
                                </table>
                                <p className={"stats-footer text-center"}>
                                    {this.state.node_resources_cpu_model}
                                </p>
                            </div>
                        </div>
                    </Col>
                    <Col xs={12} md={4}>
                        <div className={"statsContainer"}>
                            <h2>Representative</h2>
                            <img className={this.state.accountLoader ? 'loader' : "d-none"} src={white_loader}/>
                            <div className={this.state.accountLoader ? 'd-none' : ''}>
                                <table className={"table table-striped table-votes"}>
                                    <tbody>
                                    <tr>
                                        <th scope="row">Delegators</th>
                                        <td>{this.state.node_delegator_count}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Voting weight</th>
                                        <td>{this._formatNumber(this.state.node_voting_weight)} Nano</td>
                                    </tr>
                                    <tr>
                                    </tr>
                                    </tbody>
                                </table>
                                <p className={"stats-footer text-center"} style={{fontSize: '8px'}}>
                                    <a href={"https://nanocrawler.cc/explorer/account/"+this.state.config.repAddress}
                                       target={"_blank"}>{this.state.config.repAddress}</a>
                                </p>
                            </div>
                        </div>
                    </Col>
            </Row>

            {this.state.realtimeEnabled && <Row>
                <Col xs={12} md={3}>
                    <div className={"statsContainer"}>
                        <h2>Voting</h2>
                        <img className={this.state.voteLoader ? 'loader' : "d-none"} src={white_loader}/>
                        <div className={this.state.voteLoader ? 'd-none' : ''}>
                            <table className={"table table-striped"}>
                                <tbody>
                                <tr>
                                    <th scope="row">Node votes</th>
                                    <td  style={{width: '38%'}}>{this.state.account_vote_count}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Network votes</th>
                                    <td  style={{width: '38%'}}>{this.state.network_vote_count} </td>
                                </tr>
                                <tr>
                                </tr>
                                </tbody>
                            </table>
                            <p className={"stats-footer text-center"} style={{fontSize: '8px'}}>
                                Node involved in {this.state.account_vote_count === 0 ? 0 : ((this.state.account_vote_count / this.state.network_vote_count) * 100).toFixed(1) }% of network votes
                            </p>
                        </div>
                    </div>
                </Col>
                <Col xs={12} md={4}>
                    <div className={"statsContainer"}>
                        <h2>CPU</h2>
                        <img className={this.state.cpuPercentLoader ? 'loader' : "d-none"} src={white_loader}/>
                        <div className={this.state.cpuPercentLoader ? 'd-none' : "single-chart"}>
                            <svg viewBox="0 0 36 36" className="circular-chart blue">
                                <path className="circle-bg"
                                      d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path className="circle"
                                      stroke-dasharray={this.state.node_cpu_percent+", 100"}
                                      d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <text x="18" y="20.35" className="percentage">{this.state.node_cpu_percent}%</text>
                            </svg>
                        </div>
                    </div>
                </Col>

                <Col xs={12} md={5}>
                    <div className={"statsContainer"}>
                        <h2>Bandwidth</h2>
                        <img className={this.state.cpuPercentLoader ? 'loader' : "d-none"} src={white_loader}/>
                        <Row>
                            <Col xs={6}>
                                <div className={this.state.cpuPercentLoader ? 'd-none' : "single-chart"}>
                                    <svg viewBox="0 0 36 36" className="circular-chart green">
                                        <path className="circle-bg"
                                              d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path className="circle"
                                              stroke-dasharray={this.state.node_realtime_bandwith_percent_in+", 100"}
                                              d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <text x="18" y="18" className="bandwidth">{this._formatBytes(this.state.node_realtime_bandwith_bytes_in)} Mbit/s</text>
                                        <text x="18" y="24" className="bandwidth">⬇️</text>
                                    </svg>
                                </div>
                            </Col>
                            <Col xs={6}>
                                <div className={this.state.cpuPercentLoader ? 'd-none' : "single-chart"}>
                                    <svg viewBox="0 0 36 36" className="circular-chart orange">
                                        <path className="circle-bg"
                                              d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path className="circle"
                                              stroke-dasharray={this.state.node_realtime_bandwith_percent_out+", 100"}
                                              d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <text x="18" y="18" className="bandwidth">{this._formatBytes(this.state.node_realtime_bandwith_bytes_out)} Mbit/s</text>
                                        <text x="18" y="24" className="bandwidth">⬆️</text>
                                    </svg>
                                </div>
                            </Col>
                        </Row>

                    </div>
                </Col>
            </Row>
            }

            {this.state.config && this.state.config.speedtestEnabled &&
            <Row>
                <Col xs={12} md={{span: 6}}>
                    <div className={"statsContainer"}>
                        <h2>Node speedtest</h2>
                        {this.state.enableSpeedTest && this.state.speedtestStep === 1 && <>
                            <img className={'loader'} src={white_loader}/>
                            <p className={"text-center"}>
                                Generating "receive" PoW with WebAssembly
                            </p>
                        </>
                        }
                        {this.state.enableSpeedTest && this.state.speedtestStep === 2 && <>
                            <p className={"text-center"}>
                                Send nano to this address:
                            </p>
                            <img className={'loader'} src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${this.state.config.speedtestAddress}`}/>
                            <p className={"text-center"} style={{fontSize: '10px'}}>
                                {this.state.config.speedtestAddress}
                            </p>
                            <p className={"text text-center"}>After 2 minutes the test will reset automatically if we did not receive any transactions</p>
                        </>
                        }
                        {this.state.enableSpeedTest && this.state.speedtestStep === 3 && <>
                            <img className={'loader'} src={white_loader}/>
                            <p className={"text-center"}>
                                Generating "send" PoW, we're using DPoW.
                            </p>
                        </>
                        }
                        {this.state.enableSpeedTest && this.state.speedtestStep === 4 && <>
                            <img className={'loader'} src={white_loader}/>
                            <p className={"text-center"}>
                                Nano send back, waiting for confirmation.
                            </p>
                        </>
                        }
                        {this.state.enableSpeedTest && this.state.speedtestStep === 5 && <>
                            <p className={"text-center"}>
                                Transaction received: {this._formatTime(this.state.speedtestReceivedAt)} <br/>
                                Transaction send: {this._formatTime(this.state.speedtestSendAt)} <br/>
                                Transaction confirmed: {this._formatTime(this.state.speedtestSendConfirmedAt)}
                            </p>
                            <p className={"text-center"}>
                                Total time
                                roundtrip: {((this.state.speedtestSendConfirmedAt.getTime() - this.state.speedtestReceivedAt.getTime()) / 1000)} seconds
                            </p>
                        </>
                        }
                        {this.state.enableSpeedTest && this.state.speedtestStep === 9 && <>
                            <p className={"text-center"}>
                                Error generating DPoW (Distributed proof of work), please try again in 1 hour.
                            </p>
                        </>
                        }
                        {!this.state.enableSpeedTest && <>
                            <p className={"betaText"}>BETA</p>
                            <p className={"text text-center pl-5 pr-5"}>
                                You can test the transaction speed of this node. Once you click start the page will show
                                you a nano address, if you send nano to this address the node will send it back to the
                                address it came from and measure the time.
                            </p>
                            <p className={"text text-center pl-5 pr-5"}>
                                To prevent spam the Proof of Work for the transactions will be generated in your browser, so keep the tab open during the process.
                            </p>
                            <p className={"text text-center pl-5 pr-5"}>
                                At the end you will see a time summary of the transactions
                            </p>
                            <div className={"text text-center"}>
                                {this.state.speedtestIsActiveElsewhere ? <>
                                    <p style={{color: 'orange'}}>The speed test is currently in use by someone else, please wait until he/she is done.</p>
                                </>
                                    :
                                    <button onClick={this.enableSpeedTest.bind(this)} type="button"
                                    className="btn btn-primary">Start speedtest
                                    </button>
                                }
                            </div>
                            <p className={"mt-3 text-center betaDetails"}>This feature is in beta, please only use small test transactions (eg. 0.00001 Nano).</p>
                        </>
                        }
                    </div>
                </Col>
                <Col xs={12} md={{span: 6}}>
                    <div className={"statsContainer"}>
                        <h2>Speedtest Transactions</h2>
                        <img className={this.state.speedTestLoader ? 'loader' : "d-none"} src={white_loader}/>
                        <div className={this.state.speedTestLoader ? 'd-none' : ''}>
                            <table className={"table table-striped table-blocks"}>
                                <thead>
                                <tr>
                                    <th scope="col" style={{width: '4%'}}>#</th>
                                    <th scope="col">Time</th>
                                    <th scope="col" style={{width: '19%'}}>From / to</th>
                                    <th scope="col" style={{width: '19%'}}>Block</th>
                                    <th scope="col">Amount</th>
                                </tr>
                                </thead>
                                <tbody>
                                {this.state.speed_test_history.history && this.state.speed_test_history.history.map((transaction) => {
                                    return <tr>
                                        <td>
                                            {transaction.height}
                                        </td>
                                        <td>
                                            {this._formatTransactionTime(transaction)}
                                        </td>
                                        <td>
                                            <a href={"https://nanocrawler.cc/explorer/account/" + transaction.account}
                                               target={"_blank"}>{transaction.account.substring(0, 8)}...</a>
                                        </td>
                                        <td>
                                            <a href={"https://nanocrawler.cc/explorer/block/" + transaction.hash}
                                               target={"_blank"}>{transaction.hash.substring(0, 8)}...</a>
                                        </td>
                                        <td>
                                            {transaction.type === 'send' ? "-" : "+"}{this.rawToNano(transaction.amount, 5)} Nano
                                        </td>
                                    </tr>
                                })}
                                </tbody>
                            </table>
                            <p className={"stats-footer text-center"} style={{fontSize: '8px'}}>
                            </p>
                        </div>
                    </div>
                </Col>

            </Row>
            }
            <Row>
                <Col xs={12} className={"text-center pt-3"}>
                    <p style={{color: '#4A90E2'}}>{this.state.node_vendor} ({this.state.store_vendor}, {this.state.peers} peers)</p>
                </Col>
            </Row>
        </Container>
    }

}

