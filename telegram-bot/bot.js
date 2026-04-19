const TelegramBot = require("node-telegram-bot-api");
const { ethers } = require("ethers");
const http = require("http");

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
const BUY_URL       = `${DAPP_URL}/#buy`;
const TRADE_URL     = `${DAPP_URL}/#swap`;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// ── KEEP-ALIVE HTTP SERVER ────────────────────────────────────────
http.createServer((req, res) => res.end("OK")).listen(process.env.PORT || 3000);

// ── INIT ─────────────────────────────────────────────────────────
const bot      = new TelegramBot(BOT_TOKEN, { polling: true });
const provider = new ethers.JsonRpcProvider(MONAD_RPC);
const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

// ── STATE MAPS ────────────────────────────────────────────────────
const priceAlerts     = new Map(); // chatId -> { threshold, triggered }
const walletWatchers  = new Map(); // chatId -> address
const watchedBalances = new Map(); // `chatId:address` -> balance string
const sessions        = new Map(); // chatId -> { step, data }
const referrals       = new Map(); // referrerId -> Set of referred chatIds
const userLangs       = new Map(); // chatId -> lang code

// ── i18n DICTIONARY ──────────────────────────────────────────────
const I18N = {
  en: {
    welcome_fire:      "🔥 *The Dragon has awakened on Monad Mainnet\\!*",
    how_to_buy:        "🟢 *How to Buy DRAGON:*\n1️⃣ Add Monad Mainnet to your wallet\n2️⃣ Get MON for gas fees\n3️⃣ Tap *Buy DRAGON* below \\& swap\\!",
    quick_start:       "🚀 *Quick Start Guide*\n\n1\\. Add Monad Mainnet to MetaMask or any EVM wallet\n2\\. Bridge or buy MON for gas fees\n3\\. Tap *Buy DRAGON* to get your tokens\n4\\. Use /balance to check your holdings\n5\\. Use /watch to track any wallet\n\nType /help for all commands\\.",
    choose_action:     "Choose an action below 👇",
    rpc_error:         "❌ RPC is slow or unavailable. Try again in a moment, or check MonadScan directly:",
    invalid_address:   "❌ Invalid address. Please provide a valid 0x... Ethereum address.",
    invalid_amount:    "❌ Invalid amount. Enter a positive number (e.g. 1.5):",
    fetching_balance:  "⏳ Fetching balance...",
    fetching_info:     "⏳ Fetching token info...",
    fetching_tokens:   "⏳ Loading available tokens...",
    fetching_quote:    "⏳ Fetching best quote...",
    referral_msg:      "🔗 *Your Referral Link:*\n`{link}`\n\nShare this link to invite friends and earn rewards\\!\n\n👥 *Your referrals so far:* {count}",
  },
  es: {
    welcome_fire:      "🔥 *¡El Dragón ha despertado en Monad Mainnet\\!*",
    how_to_buy:        "🟢 *Cómo comprar DRAGON:*\n1️⃣ Añade Monad Mainnet a tu wallet\n2️⃣ Consigue MON para gas\n3️⃣ Pulsa *Comprar DRAGON* abajo \\& haz swap\\!",
    quick_start:       "🚀 *Guía de Inicio Rápido*\n\n1\\. Añade Monad Mainnet a MetaMask\n2\\. Consigue MON para gas\n3\\. Toca *Comprar DRAGON* para obtener tus tokens\n4\\. Usa /balance para ver tu saldo\n5\\. Usa /watch para monitorear una wallet\n\nEscribe /help para todos los comandos\\.",
    choose_action:     "Elige una acción 👇",
    rpc_error:         "❌ El RPC está lento. Inténtalo de nuevo o consulta MonadScan:",
    invalid_address:   "❌ Dirección inválida. Proporciona una dirección 0x... válida.",
    invalid_amount:    "❌ Cantidad inválida. Introduce un número positivo (ej. 1.5):",
    fetching_balance:  "⏳ Obteniendo saldo...",
    fetching_info:     "⏳ Obteniendo info del token...",
    fetching_tokens:   "⏳ Cargando tokens disponibles...",
    fetching_quote:    "⏳ Buscando la mejor cotización...",
    referral_msg:      "🔗 *Tu Enlace de Referido:*\n`{link}`\n\n¡Compártelo para invitar amigos y ganar recompensas\\!\n\n👥 *Tus referidos hasta ahora:* {count}",
  },
  fr: {
    welcome_fire:      "🔥 *Le Dragon s'est éveillé sur Monad Mainnet\\!*",
    how_to_buy:        "🟢 *Comment acheter DRAGON:*\n1️⃣ Ajoutez Monad Mainnet à votre wallet\n2️⃣ Obtenez du MON pour le gas\n3️⃣ Appuyez sur *Acheter DRAGON* ci-dessous\\!",
    quick_start:       "🚀 *Guide de Démarrage Rapide*\n\n1\\. Ajoutez Monad Mainnet à MetaMask\n2\\. Obtenez du MON pour le gas\n3\\. Appuyez sur *Acheter DRAGON* pour vos tokens\n4\\. Utilisez /balance pour vérifier votre solde\n5\\. Utilisez /watch pour suivre un wallet\n\nTapez /help pour toutes les commandes\\.",
    choose_action:     "Choisissez une action 👇",
    rpc_error:         "❌ Le RPC est lent. Réessayez ou consultez MonadScan directement:",
    invalid_address:   "❌ Adresse invalide. Fournissez une adresse 0x... valide.",
    invalid_amount:    "❌ Montant invalide. Entrez un nombre positif (ex. 1.5):",
    fetching_balance:  "⏳ Récupération du solde...",
    fetching_info:     "⏳ Récupération des infos du token...",
    fetching_tokens:   "⏳ Chargement des tokens disponibles...",
    fetching_quote:    "⏳ Recherche du meilleur devis...",
    referral_msg:      "🔗 *Votre Lien de Parrainage:*\n`{link}`\n\nPartagez-le pour inviter des amis\\!\n\n👥 *Vos parrainages:* {count}",
  },
};

function t(chatId, key, vars) {
  const lang   = userLangs.get(chatId) || "en";
  const dict   = I18N[lang] || I18N.en;
  let   str    = dict[key] || I18N.en[key] || key;
  if (vars) Object.keys(vars).forEach(k => { str = str.replace("{" + k + "}", vars[k]); });
  return str;
}

function detectLang(msg) {
  const code = (msg.from && msg.from.language_code) ? msg.from.language_code.slice(0, 2).toLowerCase() : "en";
  return I18N[code] ? code : "en";
}

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

// ── API HELPERS ───────────────────────────────────────────────────
async function getTokenInfo() {
  const [name, symbol, supply, decimals] = await Promise.all([
    contract.name(), contract.symbol(), contract.totalSupply(), contract.decimals(),
  ]);
  return { name, symbol, supply, decimals };
}

async function getBalance(address) {
  const [balance, decimals] = await Promise.all([
    contract.balanceOf(address), contract.decimals(),
  ]);
  return { balance, decimals };
}

async function getNearTokens() {
  const res  = await fetch("https://1click.chaindefuser.com/v0/tokens", {
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
      originAsset, depositType: "ORIGIN_CHAIN", destinationAsset, amount, recipient,
      recipientType: "DESTINATION_CHAIN", refundTo: recipient, refundType: "ORIGIN_CHAIN", deadline,
    }),
  });
  return res.json();
}

// ── KEYBOARDS ─────────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🟢 Buy DRAGON",   url: BUY_URL   },
        { text: "🔄 Trade",         url: TRADE_URL },
      ],
      [
        { text: "💰 Balance",       callback_data: "balance" },
        { text: "📊 Token Info",    callback_data: "info"    },
      ],
      [
        { text: "🔥 Swap",          callback_data: "swap"    },
        { text: "⛏️ Mining",        callback_data: "mining"  },
      ],
      [
        { text: "🔔 Price Alert",   callback_data: "alert"   },
        { text: "👁️ Watch Wallet",  callback_data: "watch"   },
      ],
      [
        { text: "🔗 Referral",      callback_data: "referral"},
        { text: "🌐 Open dApp",     url: DAPP_URL            },
      ],
      [
        { text: "📈 MonadVision",   url: `${VISION}/token/${TOKEN_ADDRESS}` },
        { text: "🔍 Explorer",      url: `${EXPLORER}/token/${TOKEN_ADDRESS}` },
      ],
    ],
  },
};

// ── SESSION HELPERS ───────────────────────────────────────────────
function setSession(chatId, step, data = {}) { sessions.set(chatId, { step, data }); }
function getSession(chatId) { return sessions.get(chatId) || { step: null, data: {} }; }
function clearSession(chatId) { sessions.delete(chatId); }

// ── REFERRAL HELPERS ──────────────────────────────────────────────
function getReferralCount(userId) {
  const set = referrals.get(String(userId));
  return set ? set.size : 0;
}

function recordReferral(referrerId, newUserId) {
  if (!referrerId || String(referrerId) === String(newUserId)) return;
  if (!referrals.has(String(referrerId))) referrals.set(String(referrerId), new Set());
  referrals.get(String(referrerId)).add(String(newUserId));
}

// ── WELCOME BANNER ────────────────────────────────────────────────
async function sendWelcome(chatId, lang) {
  const text =
`🐉 *DRAGON MONAD* — Official Bot

${t(chatId, "welcome_fire")}

💎 *Contract:*
\`${TOKEN_ADDRESS}\`

🌐 *Network:* Monad Mainnet · Chain 143
📐 *Standard:* ERC\\-20

━━━━━━━━━━━━━━━━━━━━
${t(chatId, "how_to_buy")}
━━━━━━━━━━━━━━━━━━━━

${t(chatId, "choose_action")}`;

  try {
    await bot.sendPhoto(chatId, COIN_LOGO, {
      caption: text,
      parse_mode: "MarkdownV2",
      ...mainMenu,
    });
  } catch {
    await bot.sendMessage(chatId, text, { parse_mode: "MarkdownV2", ...mainMenu });
  }
}

// ── QUICK START ONBOARDING ────────────────────────────────────────
async function sendOnboarding(chatId) {
  await bot.sendMessage(chatId, t(chatId, "quick_start"), {
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔗 My Referral", callback_data: "referral" }],
        [{ text: "📖 All Commands", callback_data: "help_inline" }],
      ],
    },
  });
}

// ── /start ────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
  const chatId    = msg.chat.id;
  const lang      = detectLang(msg);
  userLangs.set(chatId, lang);
  clearSession(chatId);

  // Record referral if started via ref link
  if (match && match[1]) recordReferral(match[1], chatId);

  await sendWelcome(chatId, lang);
  // Send onboarding guide 1.5s after welcome so it feels natural
  setTimeout(() => sendOnboarding(chatId), 1500);
});

// ── /menu ─────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  clearSession(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🐉 *Dragon Monad — Main Menu*", {
    parse_mode: "Markdown", ...mainMenu,
  });
});

// ── /referral ─────────────────────────────────────────────────────
bot.onText(/\/referral/, async (msg) => {
  const chatId = msg.chat.id;
  userLangs.set(chatId, detectLang(msg));
  const refLink = `https://t.me/DragonMonadBot?start=ref_${msg.from.id}`;
  const count   = getReferralCount(msg.from.id);
  bot.sendMessage(chatId, t(chatId, "referral_msg", { link: refLink, count }), {
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Join Dragon Monad — the fire rises on Monad Mainnet! 🐉")}` }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ],
    },
  });
});

// ── /buy ─────────────────────────────────────────────────────────
bot.onText(/\/buy/, async (msg) => {
  bot.sendMessage(msg.chat.id,
    `🟢 *Buy DRAGON*\n\nGet DRAGON tokens on Monad Mainnet\\!\n\n[👉 Open Buy Page](${BUY_URL})`,
    { parse_mode: "MarkdownV2" }
  );
});

// ── /trade ────────────────────────────────────────────────────────
bot.onText(/\/trade/, async (msg) => {
  bot.sendMessage(msg.chat.id,
    `🔄 *Trade DRAGON*\n\nSwap tokens on the Dragon Monad dApp\\!\n\n[👉 Open Trade Page](${TRADE_URL})`,
    { parse_mode: "MarkdownV2" }
  );
});

// ── /balance <address> ────────────────────────────────────────────
bot.onText(/\/balance (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"), {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
    });
  }
  await handleBalanceCheck(msg.chat.id, addr);
});

// ── /info ─────────────────────────────────────────────────────────
bot.onText(/\/info/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleInfo(msg.chat.id);
});

// ── /swap ─────────────────────────────────────────────────────────
bot.onText(/\/swap/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await startSwapFlow(msg.chat.id);
});

// ── /mining ───────────────────────────────────────────────────────
bot.onText(/\/mining/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleMining(msg.chat.id);
});

// ── /alert ────────────────────────────────────────────────────────
bot.onText(/\/alert/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await startAlertFlow(msg.chat.id);
});

// ── /watch <address> ─────────────────────────────────────────────
bot.onText(/\/watch (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"));
  }
  walletWatchers.set(msg.chat.id, addr.toLowerCase());
  bot.sendMessage(msg.chat.id,
    `👁️ *Watching wallet:*\n\`${addr}\`\n\nYou'll receive balance updates every 5 minutes.\nUse /stopwatch to stop.`,
    { parse_mode: "Markdown" }
  );
});

// ── /stopwatch ────────────────────────────────────────────────────
bot.onText(/\/stopwatch/, async (msg) => {
  walletWatchers.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🛑 Wallet watch stopped.");
});

// ── /dapp ─────────────────────────────────────────────────────────
bot.onText(/\/dapp/, async (msg) => {
  bot.sendMessage(msg.chat.id, `🌐 *Dragon Monad dApp*\n\n[Open dApp](${DAPP_URL})`, { parse_mode: "Markdown" });
});

// ── /help ─────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  sendHelpMessage(msg.chat.id);
});

function sendHelpMessage(chatId) {
  const text = `🐉 *Dragon Monad Bot — Commands*

/start — Welcome screen & onboarding
/menu — Main menu
/buy — Buy DRAGON tokens
/trade — Trade on dApp
/referral — Get your referral link
/balance \`<address>\` — Check DRAGON balance
/info — Token contract info
/swap — Swap tokens via NEAR Intents
/mining — LP Mining info
/alert — Set supply alert
/watch \`<address>\` — Watch a wallet (5min updates)
/stopwatch — Stop wallet watching
/dapp — Open the dApp
/help — This help message

*Quick links:*
🟢 [Buy DRAGON](${BUY_URL})
🔄 [Trade](${TRADE_URL})
🌐 [dApp](${DAPP_URL})
📈 [MonadVision](${VISION}/token/${TOKEN_ADDRESS})
🔍 [Explorer](${EXPLORER}/token/${TOKEN_ADDRESS})

💡 *Tip:* Use @DragonMonadBot in any chat to share token balances inline\\!`;

  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔗 My Referral", callback_data: "referral" }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ],
    },
  });
}

// ── INLINE QUERY — share balance in any chat ───────────────────────
bot.on("inline_query", async (query) => {
  const addr = query.query.trim();

  if (!addr) {
    return bot.answerInlineQuery(query.id, [{
      type: "article",
      id: "help",
      title: "🐉 Dragon Monad",
      description: "Type a 0x wallet address to look up DRAGON balance",
      input_message_content: {
        message_text: `🐉 *Dragon Monad Bot*\n\nType a wallet address after @DragonMonadBot to look up DRAGON balances\\!\n\nExample: \`@DragonMonadBot 0x1234...abcd\``,
        parse_mode: "MarkdownV2",
      },
    }], { cache_time: 0 });
  }

  if (!isAddress(addr)) {
    return bot.answerInlineQuery(query.id, [{
      type: "article",
      id: "invalid",
      title: "❌ Invalid address",
      description: "Please type a valid 0x... Ethereum address",
      input_message_content: {
        message_text: "❌ Invalid address. Provide a valid 0x... Ethereum address.",
      },
    }], { cache_time: 0 });
  }

  try {
    const { balance, decimals } = await getBalance(addr);
    const formatted = fmt(balance, decimals);
    bot.answerInlineQuery(query.id, [
      {
        type: "article",
        id: "balance",
        title: `💰 ${formatted} DRAGON`,
        description: `Balance for ${shortAddr(addr)}`,
        input_message_content: {
          message_text:
`💰 *DRAGON Balance*

*Address:* \`${addr}\`
*Balance:* \`${formatted} DRAGON\`

[View on Explorer](${EXPLORER}/address/${addr}) | [MonadVision](${VISION}/token/${TOKEN_ADDRESS})`,
          parse_mode: "Markdown",
        },
        reply_markup: {
          inline_keyboard: [[
            { text: "🟢 Buy DRAGON", url: BUY_URL },
            { text: "🔍 Explorer", url: `${EXPLORER}/address/${addr}` },
          ]],
        },
      },
    ], { cache_time: 30 });
  } catch {
    bot.answerInlineQuery(query.id, [{
      type: "article",
      id: "error",
      title: "❌ RPC Error",
      description: "Could not fetch balance. Try again.",
      input_message_content: {
        message_text: `❌ Could not fetch balance for \`${shortAddr(addr)}\`\\. RPC may be slow — try again or check [MonadScan](${EXPLORER}/address/${addr})`,
        parse_mode: "MarkdownV2",
      },
    }], { cache_time: 0 });
  }
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
  else if (data === "info")     { await handleInfo(chatId); }
  else if (data === "swap")     { await startSwapFlow(chatId); }
  else if (data === "mining")   { await handleMining(chatId); }
  else if (data === "alert")    { await startAlertFlow(chatId); }
  else if (data === "referral") {
    const refLink = `https://t.me/DragonMonadBot?start=ref_${query.from.id}`;
    const count   = getReferralCount(query.from.id);
    bot.sendMessage(chatId, t(chatId, "referral_msg", { link: refLink, count }), {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Join Dragon Monad! 🐉🔥")}` }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
  }
  else if (data === "help_inline") { sendHelpMessage(chatId); }
  else if (data === "watch")  {
    setSession(chatId, "awaiting_watch_address");
    bot.sendMessage(chatId, "👁️ Enter the wallet address to watch:", {
      reply_markup: { force_reply: true },
    });
  }
  else if (data === "menu") {
    clearSession(chatId);
    bot.sendMessage(chatId, "🐉 *Main Menu*", { parse_mode: "Markdown", ...mainMenu });
  }
  else if (data.startsWith("swap_token:")) {
    const assetId = data.replace("swap_token:", "");
    const session = getSession(chatId);
    setSession(chatId, "awaiting_swap_amount", { ...session.data, originAsset: assetId });
    const sym = assetId.split(":")[1]?.split(".")[0]?.toUpperCase() || "token";
    bot.sendMessage(chatId,
      `💱 How much *${sym}* do you want to swap for DRAGON?\n\nEnter amount:`,
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
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
      return bot.sendMessage(chatId, t(chatId, "invalid_address"), {
        reply_markup: { inline_keyboard: [[{ text: "🔄 Try Again", callback_data: "balance" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      });
    }
    await handleBalanceCheck(chatId, text);
  }
  else if (session.step === "awaiting_watch_address") {
    clearSession(chatId);
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    walletWatchers.set(chatId, text.toLowerCase());
    bot.sendMessage(chatId,
      `👁️ *Now watching:*\n\`${text}\`\n\nBalance updates every 5 minutes.\nUse /stopwatch to stop.`,
      { parse_mode: "Markdown" }
    );
  }
  else if (session.step === "awaiting_swap_recipient") {
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    const data = { ...session.data, recipient: text };
    setSession(chatId, "fetching_quote", data);
    await handleSwapQuote(chatId, data);
  }
  else if (session.step === "awaiting_swap_amount") {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, t(chatId, "invalid_amount"));
    setSession(chatId, "awaiting_swap_recipient", { ...session.data, amount: text });
    bot.sendMessage(chatId,
      "📬 Enter your *Monad wallet address* to receive DRAGON:",
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
  }
  else if (session.step === "awaiting_alert_threshold") {
    const val = parseFloat(text);
    if (isNaN(val) || val <= 0) return bot.sendMessage(chatId, t(chatId, "invalid_amount"));
    priceAlerts.set(chatId, { threshold: val, triggered: false });
    clearSession(chatId);
    bot.sendMessage(chatId,
      `🔔 *Alert set\\!*\n\nYou'll be notified when total supply exceeds *${val.toLocaleString()}* DRAGON\\.`,
      { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] } }
    );
  }
});

// ── HANDLER FUNCTIONS ─────────────────────────────────────────────
async function handleBalanceCheck(chatId, address) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_balance"));
  try {
    const { balance, decimals } = await getBalance(address);
    const formatted = fmt(balance, decimals);
    await bot.editMessageText(
`💰 *DRAGON Balance*

*Address:* \`${shortAddr(address)}\`
*Balance:* \`${formatted} DRAGON\`

[View on Explorer](${EXPLORER}/address/${address}) | [MonadVision](${VISION}/token/${TOKEN_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown", disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 Trade", url: TRADE_URL }],
            [{ text: "🔄 Check Again", callback_data: "balance" }, { text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch (e) {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/address/${address}](${EXPLORER}/address/${address})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "balance" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleInfo(chatId) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_info"));
  try {
    const { name, symbol, supply, decimals } = await getTokenInfo();
    await bot.editMessageText(
`📊 *Token Information*

*Name:* ${name}
*Symbol:* ${symbol}
*Total Supply:* \`${fmt(supply, decimals)}\`
*Decimals:* ${decimals}
*Standard:* ERC-20
*Network:* Monad Mainnet · Chain 143

*Token Contract:*
\`${TOKEN_ADDRESS}\`

*LP Mining Contract:*
\`${LP_MINING}\``,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 Trade", url: TRADE_URL }],
            [{ text: "🔍 Explorer", url: `${EXPLORER}/token/${TOKEN_ADDRESS}` }, { text: "📈 MonadVision", url: `${VISION}/token/${TOKEN_ADDRESS}` }],
            [{ text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/token/${TOKEN_ADDRESS}](${EXPLORER}/token/${TOKEN_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "info" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function startSwapFlow(chatId) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_tokens"));
  try {
    const tokens  = await getNearTokens();
    const buttons = tokens.slice(0, 8).map(t => [{
      text: `${t.symbol}${t.price ? ` ($${Number(t.price).toFixed(2)})` : ""}`,
      callback_data: `swap_token:${t.assetId}`,
    }]);
    buttons.push([{ text: "🏠 Menu", callback_data: "menu" }]);
    await bot.editMessageText(
      `🔥 *Swap to DRAGON*\n\nPowered by *NEAR Intents*\nSelect the token you want to swap:`,
      { chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
    );
  } catch {
    bot.editMessageText(
      "❌ Could not load tokens. NEAR Intents may be temporarily unavailable — try again in a moment.",
      {
        chat_id: chatId, message_id: loading.message_id,
        reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "swap" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleSwapQuote(chatId, { originAsset, amount, recipient }) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_quote"));
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
      text += `📬 *Send your tokens to:*\n\`${quote.depositAddress}\`\n\nNEAR Intents will complete the swap and deliver DRAGON to your wallet.`;
    }

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 New Swap", callback_data: "swap" }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
    clearSession(chatId);
  } catch {
    bot.editMessageText(
      "❌ Could not fetch quote\\. Try a different token or amount, or check your connection\\.",
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: [[{ text: "🔄 Try Again", callback_data: "swap" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
    clearSession(chatId);
  }
}

async function handleMining(chatId) {
  bot.sendMessage(chatId,
`⛏️ *LP Mining*

Provide liquidity and earn DRAGON rewards\\!

*Mining Contract:*
\`${LP_MINING}\`

*Token Contract:*
\`${TOKEN_ADDRESS}\`

*Network:* Monad Mainnet · Chain 143`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 Trade", url: TRADE_URL }],
          [{ text: "🔍 View Mining Contract", url: `${EXPLORER}/address/${LP_MINING}` }],
          [{ text: "📊 MonadVision Analytics", url: `${VISION}/token/${TOKEN_ADDRESS}` }],
          [{ text: "🌐 Open dApp", url: DAPP_URL }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    }
  );
}

async function startAlertFlow(chatId) {
  setSession(chatId, "awaiting_alert_threshold");
  bot.sendMessage(chatId,
    `🔔 *Set Supply Alert*\n\nEnter a total supply threshold\\.\nYou'll be notified when DRAGON total supply exceeds that number\\.\n\nExample: \`1000000\``,
    { parse_mode: "MarkdownV2", reply_markup: { force_reply: true } }
  );
}

// ── WALLET WATCHER (every 5 min) ──────────────────────────────────
setInterval(async () => {
  for (const [chatId, address] of walletWatchers.entries()) {
    try {
      const { balance, decimals } = await getBalance(address);
      const current  = balance.toString();
      const previous = watchedBalances.get(`${chatId}:${address}`);

      if (previous !== undefined && previous !== current) {
        const oldFmt = fmt(BigInt(previous), decimals);
        const newFmt = fmt(balance, decimals);
        const change = Number(ethers.formatUnits(balance - BigInt(previous), decimals));
        const sign   = change > 0 ? "📈 +" : "📉 ";

        bot.sendMessage(chatId,
          `👁️ *Wallet Update*\n\n\`${shortAddr(address)}\`\n\n*Previous:* ${oldFmt} DRAGON\n*Current:* ${newFmt} DRAGON\n*Change:* ${sign}${Math.abs(change).toFixed(4)} DRAGON`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 Trade", url: TRADE_URL }]] },
          }
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
    const supply    = await contract.totalSupply();
    const decimals  = await contract.decimals();
    const supplyNum = Number(ethers.formatUnits(supply, decimals));

    for (const [chatId, alert] of priceAlerts.entries()) {
      if (!alert.triggered && supplyNum >= alert.threshold) {
        alert.triggered = true;
        bot.sendMessage(chatId,
          `🔔 *Supply Alert Triggered\\!*\n\nTotal supply has reached *${supplyNum.toLocaleString()}* DRAGON\n\\(Your threshold: ${alert.threshold.toLocaleString()}\\)`,
          {
            parse_mode: "MarkdownV2",
            reply_markup: { inline_keyboard: [[{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🔄 Trade", url: TRADE_URL }]] },
          }
        );
      }
    }
  } catch {}
}, 10 * 60 * 1000);

// ── ERROR HANDLING ────────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("🐉 Dragon Monad Bot is running...");
