import { BOT_TYPES, COMMAND_TYPES, ParticlBot } from "particl-bot-core";

import * as got from "got";

const API = 'https://api.stealthex.io/api/v2';
const API_KEY = '<API-KEY>';
const WIF = '<WIF>';
const NETWORK = 'mainnet';
const SUPPORTED_CURRENCIES = [{
    symbol: 'BTC',
    name: 'Bitcoin'
}, {
  symbol: 'DAI',
  name: 'MakerDAO (DAI)'
}, {
    symbol: 'ZEN',
    name: 'Horizen'
}];

const bot = new ParticlBot({
  logger: console,
  name: "StealthEX Exchange Bot",
  description: "Exchanges BTC, DAI for PART",
  version: "0.0.1",
  type: BOT_TYPES.EXCHANGE,
  network: NETWORK,
  author: {
    name: 'Robert Edwards',
    email: 'rob@particl.io',
    chat_ids: [
      {type: 'riot', id: 'spazzymoto'}
    ]
  },
  privKeys: {
    mainnet: WIF
  },
  particlClient: {
    username: 'test',
    password: 'test',
    port: '36760',
    zmq: {
      zmqpubsmsg: 'tcp://127.0.0.1:36761'
    }
  }
});

bot.on(COMMAND_TYPES.GET_SUPPORTED_CURRENCIES, async (req, resp) => {
  resp.send(SUPPORTED_CURRENCIES);
});

bot.on(COMMAND_TYPES.GET_OFFER, async (req, resp) => {
  let from: string, to: string, amount: number;
  try {
    [from, to, amount] = req;
  } catch (e) {
    return resp.error('Unsupported request version');
  }

  if (to.toLowerCase() !== 'part') {
    return resp.error('Bot only supports converting to Particl');
  }
  console.log('SUPPORTED_CURRENCIES', SUPPORTED_CURRENCIES)
  console.log('from.toLowerCase()', from.toLowerCase())
  if (!SUPPORTED_CURRENCIES.find((c) => c.symbol.toLowerCase() ===  from.toLowerCase())) {
    return resp.error(`Bot does not support converting from ${from} to Particl`);
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return resp.error('Invalid amount specified');
  }

  if (amount > 100) {
    return resp.error('Request exceeds maximum of 100 PART');
  }

  try {
    console.log(`${API}/min/${from.toLowerCase()}/${to.toLowerCase()}?api_key=${API_KEY}`);
    const min_from_amount = await got.get(`${API}/min/${from.toLowerCase()}/${to.toLowerCase()}?api_key=${API_KEY}`).then((response) => JSON.parse(response.body).min_amount);
    console.log('min_from_amount', min_from_amount);
    const min_to_amount = await got.get(`${API}/estimate/${from.toLowerCase()}/${to.toLowerCase()}?api_key=${API_KEY}&amount=${min_from_amount}`).then((response) => parseFloat(JSON.parse(response.body).estimated_amount));

    const estimated_rate = min_from_amount / min_to_amount;

    if (min_to_amount >= amount) {
      return resp.send({
        currency_from: from,
        currency_to: to,  
        amount_from: min_from_amount,
        amount_to: min_to_amount
      });
    }

    const required_from = (amount * estimated_rate).toPrecision(8);
    const required_to = await got.get(`${API}/estimate/${from.toLowerCase()}/${to.toLowerCase()}?api_key=${API_KEY}&amount=${required_from}`).then((response) => parseFloat(JSON.parse(response.body).estimated_amount));

    resp.send({
      currency_from: from,
      currency_to: to,  
      amount_from: required_from,
      amount_to: required_to
    });
  } catch (e) {
    resp.error(e.message);
  }
});

bot.on(COMMAND_TYPES.EXCHANGE, async (req, resp) => {
  let address: string, from: string, to: string, amount: number | string;
  try {
    [address, from, to, amount] = req;

    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }
  } catch (e) {
    return resp.error('Unsupported request version');
  }

  if (to.toLowerCase() !== 'part') {
    return resp.error('Bot only supports converting to Particl');
  }

  if (!SUPPORTED_CURRENCIES.find((c) => c.symbol.toLowerCase() ===  from.toLowerCase())) {
    return resp.error(`Bot does not support converting from ${from} to Particl`);
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return resp.error('Invalid amount specified');
  }

  if (amount > 100) {
    return resp.error('Request exceeds maximum of 100 PART');
  }

  console.log(`New Exchange ${from} -> ${to} for ${amount}`);

  try {
    const exchange = await got(`${API}/exchange?api_key=${API_KEY}`, {
      method: 'POST',
      json: true,
      body: {
        currency_from: from.toLowerCase(),
        currency_to: to.toLowerCase(),
        address_to: address,
        amount_from: `${amount}`
      }
    }).then((resp) => resp.body);
    console.log(exchange)
    resp.send({
      track_id: exchange.id,
      currency_from: exchange.currency_from,
      currency_to: exchange.currency_to,  
      amount_from: exchange.amount_from,
      amount_to: exchange.amount_to,
      address_from: exchange.address_from,
      address_to: exchange.address_to,
      status: exchange.status,
      tx_from: exchange.tx_from || '',
      tx_to: exchange.tx_to || ''
    });
  } catch (e) {
    resp.error(e.message);
  }
});

bot.on(COMMAND_TYPES.EXCHANGE_STATUS, async (req, resp) => {
  const [track_id] = req;

  if (!track_id) {
    return resp.error('Invalid track id.');
  }

  try {
    const status = await got.get(`${API}/exchange/${track_id}?api_key=${API_KEY}`).then((response) =>  JSON.parse(response.body));

    resp.send({
      track_id: status.id,
      currency_from: status.currency_from,
      currency_to: status.currency_to,  
      amount_from: status.amount_from,
      amount_to: status.amount_to,
      address_from: status.address_from,
      address_to: status.address_to,
      status: status.status,
      tx_from: status.tx_from || '',
      tx_to: status.tx_to || '',
    });
  } catch (e) {
    resp.error(e.message);
  }
});

bot.start();
