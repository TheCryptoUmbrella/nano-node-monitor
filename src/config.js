
//this should be filled by .env or .env.production
let config = {
    wsApi: null
};

if (process.env.REACT_APP_WS_API_ADDRESS) {
    config.wsApi = process.env.REACT_APP_WS_API_ADDRESS;
}

export default config
