const TelegramBot = require("node-telegram-bot-api");
const { ethers } = require("ethers");

// ── CONFIG ──────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const TOKEN_ADDRESS = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81";
const LP_MINING     = "0x28840f3e117345A5FBF08b7F67503D2F47B28023";
const MONAD_RPC     = "https://rpc.monad.xyz";
const DAPP_URL      = "https://1bd70abb.dragon-moonad.pages.dev";
const EXPLORER      = "https://monadscan.com";
const VISION        = "https://monadvision.com";
const COIN_LOGO     = "https://files.catbox.moe/byzt1g.png";
const NEAR_JWT      = process.env.NEAR_JWT || "YOUR_NEAR_JWT_HERE";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// ── INIT ─────────────────────────────────────────────────────────
const bot      = new TelegramBot(BOT_TOKEN, { polling: true });
const provider = new ethers.JsonRpcProvider(MONAD_RPC);
const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

// Price alert subscriptions: { chatId: { address, threshold, above } }
const priceAlerts = new Map();
// Wallet watchers: { chatId: address }
const walletWatchers = new Map();

// ── UTILS ─────────────────────────────────────────────────────────
function fmt(val, decimals = 18) {
  try {
    const n = Number(ethers.formatUnits(val, decimals));
    return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  } catch { return "0"; }
}

function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function isAddress(str) {
  return /^0x[0-9a-fA-F]{40}$/.test(str);
}

async function getTokenInfo() {
  const [name, symbol, supply, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.totalSupply(),
    contract.decimals(),
  ]);
  return { name, symbol, supply, decimals };
}

async function getBalance(address) {
  const [balance, decimals] = await Promise.all([
    contract.balanceOf(address),
    contract.decimals(),
  ]);
  return { balance, decimals };
}

async function getNearTokens() {
  const res = await fetch("https://1click.chaindefuser.com/v0/tokens", {
    headers: { Authorization: "Bearer " + NEAR_JWT },
  });
  const data = await res.json();
  return data.filter(t =>
    ["eth","btc","sol","usdc","usdt","near"].some(s => t.symbol?.toLowerCase().includes(s))
  );
}

async function getNearQuote({ originAsset, destinationAsset, amount, recipient }) {
  const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const res = await fetch("https://1click.chaindefuser.com/v0/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + NEAR_JWT },
    body: JSON.stringify({
      dry: false, swapType: "EXACT_INPUT", slippageTolerance: 100,
      originAsset, depositType: "ORIGIN_CHAIN",
      destinationAsset, amount, recipient,
      recipientType: "DESTINATION_CHAIN",
      refundTo: recipient, refundType: "ORIGIN_CHAIN", deadline,
    }),
  });
  return res.json();
}

// ── KEYBOARDS ─────────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "💰 Balance",     callback_data: "balance"  },
        { text: "📊 Token Info",  callback_data: "info"     },
      ],
      [
        { text: "🔥 Swap",        callback_data: "swap"     },
        { text: "⛏️ Mining",      callback_data: "mining"   },
      ],
      [
        { text: "🔔 Price Alert", callback_data: "alert"    },
        { text: "👁️ Watch Wallet",callback_data: "watch"    },
      ],
      [
        { text: "🌐 Open dApp",   url: DAPP_URL             },
        { text: "📈 MonadVision", url: `${VISION}/token/${TOKEN_ADDRESS}` },
      ],
      [
        { text: "🔍 Explorer",    url: `${EXPLORER}/token/${TOKEN_ADDRESS}` },
      ],
    ],
  },
};

// ── USER SESSION STATE ────────────────────────────────────────────
const sessions = new Map(); // chatId -> { step, data }

function setSession(chatId, step, data = {}) {
  sessions.set(chatId, { step, data });
}
function getSession(chatId) {
  return sessions.get(chatId) || { step: null, data: {} };
}
function clearSession(chatId) {
  sessions.delete(chatId);
}

// ── WELCOME ───────────────────────────────────────────────────────
async function sendWelcome(chatId) {
  const text = `🐉 *DRAGON MONAD BOT*

Welcome to the official Dragon Monad Token bot\\!

*Contract:* \`${TOKEN_ADDRESS}\`
*Network:* Monad Mainnet \\(Chain 143\\)
*Standard:* ERC\\-20

Choose an option below:`;

  await bot.sendPhoto(chatId, COIN_LOGO, {
    caption: text,
    parse_mode: "MarkdownV2",
    ...mainMenu,
  });
}

// ── /start ────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  clearSession(msg.chat.id);
  await sendWelcome(msg.chat.id);
});

// ── /menu ─────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  clearSession(msg.chat.id);
  await bot.sendMessage(msg.chat.id, "🐉 *Dragon Monad Menu*", {
    parse_mode: "Markdown",
    ...mainMenu,
  });
});

// ── /balance <address> ────────────────────────────────────────────
bot.onText(/\/balance (.+)/, async (msg, match) => {
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, "❌ Invalid address. Example:\n`/balance 0x1234...abcd`", { parse_mode: "Markdown" });
  }
  await handleBalanceCheck(msg.chat.id, addr);
});

// ── /info ─────────────────────────────────────────────────────────
bot.onText(/\/info/, async (msg) => {
  await handleInfo(msg.chat.id);
});

// ── /swap ─────────────────────────────────────────────────────────
bot.onText(/\/swap/, async (msg) => {
  await startSwapFlow(msg.chat.id);
});

// ── /mining ───────────────────────────────────────────────────────
bot.onText(/\/mining/, async (msg) => {
  await handleMining(msg.chat.id);
});

// ── /alert ────────────────────────────────────────────────────────
bot.onText(/\/alert/, async (msg) => {
  await startAlertFlow(msg.chat.id);
});

// ── /watch <address> ─────────────────────────────────────────────
bot.onText(/\/watch (.+)/, async (msg, match) => {
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, "❌ Invalid address.");
  }
  walletWatchers.set(msg.chat.id, addr.toLowerCase());
  bot.sendMessage(msg.chat.id,
    `👁️ *Watching wallet:*\n\`${addr}\`\n\nYou'll receive balance updates every 5 minutes.`,
    { parse_mode: "Markdown" }
  );
});

// ── /stopwatch ────────────────────────────────────────────────────
bot.onText(/\/stopwatch/, async (msg) => {
  walletWatchers.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🛑 Wallet watch stopped.");
});

// ── /help ─────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  const text = `🐉 *Dragon Monad Bot — Commands*

/start — Welcome screen
/menu — Show main menu
/balance \`<address>\` — Check DRAGON balance
/info — Token contract info
/swap — Swap tokens via NEAR Intents
/mining — LP Mining info
/alert — Set price/supply alert
/watch \`<address>\` — Watch a wallet (5min updates)
/stopwatch — Stop wallet watching
/dapp — Open the dApp
/help — This help message

*Quick links:*
🌐 [dApp](${DAPP_URL})
📈 [MonadVision](${VISION}/token/${TOKEN_ADDRESS})
🔍 [Explorer](${EXPLORER}/token/${TOKEN_ADDRESS})`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown", disable_web_page_preview: true });
});

// ── /dapp ─────────────────────────────────────────────────────────
bot.onText(/\/dapp/, async (msg) => {
  bot.sendMessage(msg.chat.id, `🌐 *Dragon Monad dApp*\n\n[Open dApp](${DAPP_URL})`, {
    parse_mode: "Markdown",
  });
});

// ── CALLBACK HANDLERS ─────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  await bot.answerCallbackQuery(query.id);

  if (data === "balance") {
    setSession(chatId, "awaiting_balance_address");
    bot.sendMessage(chatId, "💰 Enter the wallet address to check DRAGON balance:", {
      reply_markup: { force_reply: true },
    });
  }
  else if (data === "info")   { await handleInfo(chatId); }
  else if (data === "swap")   { await startSwapFlow(chatId); }
  else if (data === "mining") { await handleMining(chatId); }
  else if (data === "alert")  { await startAlertFlow(chatId); }
  else if (data === "watch")  {
    setSession(chatId, "awaiting_watch_address");
    bot.sendMessage(chatId, "👁️ Enter the wallet address to watch:", {
      reply_markup: { force_reply: true },
    });
  }
  else if (data === "menu")   {
    clearSession(chatId);
    bot.sendMessage(chatId, "🐉 *Main Menu*", { parse_mode: "Markdown", ...mainMenu });
  }
  else if (data.startsWith("swap_token:")) {
    const assetId = data.replace("swap_token:", "");
    const session = getSession(chatId);
    setSession(chatId, "awaiting_swap_amount", { ...session.data, originAsset: assetId });
    const sym = assetId.split(":")[1]?.split(".")[0]?.toUpperCase() || "token";
    bot.sendMessage(chatId, `💱 How much *${sym}* do you want to swap for DRAGON?\n\nEnter amount:`, {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true },
    });
  }
});

// ── MESSAGE HANDLER (session steps) ──────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const text    = msg.text.trim();
  const session = getSession(chatId);

  if (session.step === "awaiting_balance_address") {
    clearSession(chatId);
    if (!isAddress(text)) {
      return bot.sendMessage(chatId, "❌ Invalid Ethereum address. Try again with `/balance 0x...`", { parse_mode: "Markdown" });
    }
    await handleBalanceCheck(chatId, text);
  }
  else if (session.step === "awaiting_watch_address") {
    clearSession(chatId);
    if (!isAddress(text)) {
      return bot.sendMessage(chatId, "❌ Invalid address.");
    }
    walletWatchers.set(chatId, text.toLowerCase());
    bot.sendMessage(chatId,
      `👁️ *Now watching:*\n\`${text}\`\n\nBalance updates every 5 minutes.\nUse /stopwatch to stop.`,
      { parse_mode: "Markdown" }
    );
  }
  else if (session.step === "awaiting_swap_recipient") {
    if (!isAddress(text)) {
      return bot.sendMessage(chatId, "❌ Invalid address. Enter your Monad wallet address:");
    }
    const data = { ...session.data, recipient: text };
    setSession(chatId, "fetching_quote", data);
    await handleSwapQuote(chatId, data);
  }
  else if (session.step === "awaiting_swap_amount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount. Enter a positive number:");
    }
    setSession(chatId, "awaiting_swap_recipient", { ...session.data, amount: text });
    bot.sendMessage(chatId, "📬 Enter your *Monad wallet address* to receive DRAGON:", {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true },
    });
  }
  else if (session.step === "awaiting_alert_threshold") {
    const val = parseFloat(text);
    if (isNaN(val) || val <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid value. Enter a positive number:");
    }
    priceAlerts.set(chatId, { threshold: val, triggered: false });
    clearSession(chatId);
    bot.sendMessage(chatId,
      `🔔 *Alert set!*\n\nYou'll be notified when total supply exceeds *${val.toLocaleString()}* DRAGON.\n\nUse /menu to go back.`,
      { parse_mode: "Markdown" }
    );
  }
});

// ── HANDLER FUNCTIONS ─────────────────────────────────────────────
async function handleBalanceCheck(chatId, address) {
  const loading = await bot.sendMessage(chatId, "⏳ Fetching balance...");
  try {
    const { balance, decimals } = await getBalance(address);
    const formatted = fmt(balance, decimals);
    const text = `💰 *DRAGON Balance*

*Address:* \`${shortAddr(address)}\`
*Balance:* \`${formatted} DRAGON\`

[View on Explorer](${EXPLORER}/address/${address}) | [MonadVision](${VISION}/token/${TOKEN_ADDRESS})`;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Check Again", callback_data: "balance" },
          { text: "🏠 Menu",        callback_data: "menu"    },
        ]],
      },
    });
  } catch (e) {
    bot.editMessageText("❌ Failed to fetch balance. The RPC may be slow — try again.", {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }
}

async function handleInfo(chatId) {
  const loading = await bot.sendMessage(chatId, "⏳ Fetching token info...");
  try {
    const { name, symbol, supply, decimals } = await getTokenInfo();
    const text = `📊 *Token Information*

*Name:* ${name}
*Symbol:* ${symbol}
*Total Supply:* \`${fmt(supply, decimals)}\`
*Decimals:* ${decimals}
*Standard:* ERC-20
*Network:* Monad Mainnet
*Chain ID:* 143

*Token Contract:*
\`${TOKEN_ADDRESS}\`

*LP Mining Contract:*
\`${LP_MINING}\``;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔍 Explorer",    url: `${EXPLORER}/token/${TOKEN_ADDRESS}` },
            { text: "📈 MonadVision", url: `${VISION}/token/${TOKEN_ADDRESS}`   },
          ],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
  } catch (e) {
    bot.editMessageText("❌ Failed to fetch token info. Try again.", {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }
}

async function startSwapFlow(chatId) {
  const loading = await bot.sendMessage(chatId, "⏳ Loading available tokens...");
  try {
    const tokens = await getNearTokens();
    const buttons = tokens.slice(0, 8).map(t => [{
      text: `${t.symbol}${t.price ? ` ($${Number(t.price).toFixed(2)})` : ""}`,
      callback_data: `swap_token:${t.assetId}`,
    }]);
    buttons.push([{ text: "🏠 Menu", callback_data: "menu" }]);

    await bot.editMessageText(`🔥 *Swap to DRAGON*\n\nPowered by *NEAR Intents*\nSelect the token you want to swap:`, {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e) {
    bot.editMessageText("❌ Could not load tokens. Try again later.", {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }
}

async function handleSwapQuote(chatId, { originAsset, amount, recipient }) {
  const loading = await bot.sendMessage(chatId, "⏳ Fetching best quote...");
  try {
    const tokens    = await getNearTokens();
    const origin    = tokens.find(t => t.assetId === originAsset);
    const decimals  = origin?.decimals ?? 18;
    const amountRaw = (BigInt(Math.round(parseFloat(amount) * Math.pow(10, decimals)))).toString();
    const destAsset = `nep141:monad-${TOKEN_ADDRESS.toLowerCase()}.omft.near`;
    const quote     = await getNearQuote({ originAsset, destinationAsset: destAsset, amount: amountRaw, recipient });

    let text = `✅ *Swap Quote*\n\n`;
    text += `*You Send:* ${amount} ${origin?.symbol || "?"}\n`;
    text += `*You Receive:* ${quote.amountOutFormatted || "—"} DRAGON\n`;
    text += `*Deadline:* ${quote.deadline ? new Date(quote.deadline).toLocaleTimeString() : "10 min"}\n\n`;

    if (quote.depositAddress) {
      text += `📬 *Send your tokens to this address:*\n\`${quote.depositAddress}\`\n\n`;
      text += `NEAR Intents will complete the swap and deliver DRAGON to your wallet.`;
    }

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 New Swap", callback_data: "swap" }],
          [{ text: "🏠 Menu",     callback_data: "menu" }],
        ],
      },
    });
    clearSession(chatId);
  } catch (e) {
    bot.editMessageText("❌ Could not fetch quote. Try a different token or amount.", {
      chat_id: chatId,
      message_id: loading.message_id,
    });
    clearSession(chatId);
  }
}

async function handleMining(chatId) {
  const text = `⛏️ *LP Mining*

Provide liquidity and earn DRAGON rewards\\!

*Mining Contract:*
\`${LP_MINING}\`

*Token Contract:*
\`${TOKEN_ADDRESS}\`

*Network:* Monad Mainnet · Chain 143`;

  bot.sendMessage(chatId, text, {
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔍 View Mining Contract", url: `${EXPLORER}/address/${LP_MINING}` },
        ],
        [
          { text: "📊 MonadVision Analytics", url: `${VISION}/token/${TOKEN_ADDRESS}` },
        ],
        [{ text: "🌐 Open dApp", url: DAPP_URL }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ],
    },
  });
}

async function startAlertFlow(chatId) {
  setSession(chatId, "awaiting_alert_threshold");
  bot.sendMessage(chatId,
    `🔔 *Set Supply Alert*\n\nEnter a total supply threshold.\nYou'll be notified when DRAGON total supply exceeds that number.\n\nExample: \`1000000\``,
    {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true },
    }
  );
}

// ── WALLET WATCHER (every 5 min) ──────────────────────────────────
const watchedBalances = new Map();

setInterval(async () => {
  for (const [chatId, address] of walletWatchers.entries()) {
    try {
      const { balance, decimals } = await getBalance(address);
      const current = balance.toString();
      const previous = watchedBalances.get(`${chatId}:${address}`);

      if (previous !== undefined && previous !== current) {
        const oldFmt = fmt(BigInt(previous), decimals);
        const newFmt = fmt(balance, decimals);
        const change = Number(ethers.formatUnits(balance - BigInt(previous), decimals));
        const sign   = change > 0 ? "📈 +" : "📉 ";

        bot.sendMessage(chatId,
          `👁️ *Wallet Update*\n\n\`${shortAddr(address)}\`\n\n*Previous:* ${oldFmt} DRAGON\n*Current:* ${newFmt} DRAGON\n*Change:* ${sign}${Math.abs(change).toFixed(4)} DRAGON`,
          { parse_mode: "Markdown" }
        );
      }
      watchedBalances.set(`${chatId}:${address}`, current);
    } catch {}
  }
}, 5 * 60 * 1000);

// ── SUPPLY ALERT CHECKER (every 10 min) ──────────────────────────
setInterval(async () => {
  if (priceAlerts.size === 0) return;
  try {
    const supply   = await contract.totalSupply();
    const decimals = await contract.decimals();
    const supplyNum = Number(ethers.formatUnits(supply, decimals));

    for (const [chatId, alert] of priceAlerts.entries()) {
      if (!alert.triggered && supplyNum >= alert.threshold) {
        alert.triggered = true;
        bot.sendMessage(chatId,
          `🔔 *Supply Alert Triggered!*\n\nTotal supply has reached *${supplyNum.toLocaleString()}* DRAGON\n(Your threshold: ${alert.threshold.toLocaleString()})`,
          { parse_mode: "Markdown" }
        );
      }
    }
  } catch {}
}, 10 * 60 * 1000);

// ── ERROR HANDLING ────────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("🐉 Dragon Monad Bot is running...");
