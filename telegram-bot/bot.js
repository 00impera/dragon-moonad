const TelegramBot = require("node-telegram-bot-api");
const { ethers } = require("ethers");
const http = require("http");

// ── CONFIG ──────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const NEAR_JWT      = process.env.NEAR_JWT  || "YOUR_NEAR_JWT_HERE";

// ── CONTRACTS ───────────────────────────────────────────────────
const TOKEN_ADDRESS   = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81"; // DRAGON
const GOLD_ADDRESS    = "0xb73bb15509504fB2Be64159ab0B0b38F26C6d795"; // GOLD
const STAKING_ADDRESS = "0x095a69Fe5f0B01bb68f85F18C8b74c17D3F8971F"; // LiquidStaking
const LP_MINING       = "0x28840f3e117345A5FBF08b7F67503D2F47B28023"; // LP Mining
const TREASURY        = "0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e"; // Treasury

// ── URLS ─────────────────────────────────────────────────────────
const MONAD_RPC  = "https://rpc.monad.xyz";
const DAPP_URL   = "https://dragon-moonad.pages.dev";       // ← UPDATED
const EXPLORER   = "https://monadscan.com";
const VISION     = "https://monadvision.com";
const BUY_URL    = `${DAPP_URL}/#buy`;
const TRADE_URL  = `${DAPP_URL}/#swap`;
const STAKE_URL  = `${DAPP_URL}/#stake`;

// Logo — fixed raw GitHub URL (was 3.png.png, corrected to 3.png)
const COIN_LOGO  = "https://raw.githubusercontent.com/00impera/dragon-moonad/b7e094df45b3a33ef5b310e925e1afd04ab8a5a6/3.png";

// ── ABIs ─────────────────────────────────────────────────────────
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const STAKING_ABI = [
  "function totalStaked() view returns (uint256)",
  "function pendingRewards(address) view returns (uint256)",
  "function stakeInfo(address) view returns (uint256 amount, uint256 stakedAt, uint256 pending, uint256 unstakeAmount, uint256 unstakeAt, bool canClaim)",
];

// ── KEEP-ALIVE HTTP SERVER ────────────────────────────────────────
http.createServer((req, res) => res.end("OK")).listen(process.env.PORT || 3000);

// ── INIT ─────────────────────────────────────────────────────────
const bot         = new TelegramBot(BOT_TOKEN, { polling: true });
const provider    = new ethers.JsonRpcProvider(MONAD_RPC);
const dragonC     = new ethers.Contract(TOKEN_ADDRESS,   ERC20_ABI,   provider);
const goldC       = new ethers.Contract(GOLD_ADDRESS,    ERC20_ABI,   provider);
const stakingC    = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);

// ── STATE MAPS ────────────────────────────────────────────────────
const priceAlerts     = new Map();
const walletWatchers  = new Map();
const watchedBalances = new Map();
const sessions        = new Map();
const referrals       = new Map();
const userLangs       = new Map();

// ── i18n DICTIONARY ──────────────────────────────────────────────
const I18N = {
  en: {
    welcome_fire:      "🔥 *The Dragon has awakened on Monad Mainnet\\!*",
    how_to_buy:        "🟢 *How to Buy DRAGON:*\n1️⃣ Add Monad Mainnet to your wallet\n2️⃣ Get MON for gas fees\n3️⃣ Tap *Buy DRAGON* below \\& swap\\!",
    quick_start:       "🚀 *Quick Start Guide*\n\n1\\. Add Monad Mainnet to MetaMask or any EVM wallet\n2\\. Bridge or buy MON for gas fees\n3\\. Tap *Buy DRAGON* to get your tokens\n4\\. Stake MON to earn GOLD rewards\n5\\. Use /balance to check your holdings\n6\\. Use /watch to track any wallet\n\nType /help for all commands\\.",
    choose_action:     "Choose an action below 👇",
    rpc_error:         "❌ RPC is slow or unavailable. Try again in a moment, or check MonadScan directly:",
    invalid_address:   "❌ Invalid address. Please provide a valid 0x... Ethereum address.",
    invalid_amount:    "❌ Invalid amount. Enter a positive number (e.g. 1.5):",
    fetching_balance:  "⏳ Fetching balance...",
    fetching_info:     "⏳ Fetching token info...",
    fetching_tokens:   "⏳ Loading available tokens...",
    fetching_quote:    "⏳ Fetching best quote...",
    fetching_staking:  "⏳ Fetching staking info...",
    referral_msg:      "🔗 *Your Referral Link:*\n`{link}`\n\nShare this link to invite friends and earn rewards\\!\n\n👥 *Your referrals so far:* {count}",
  },
  es: {
    welcome_fire:      "🔥 *¡El Dragón ha despertado en Monad Mainnet\\!*",
    how_to_buy:        "🟢 *Cómo comprar DRAGON:*\n1️⃣ Añade Monad Mainnet a tu wallet\n2️⃣ Consigue MON para gas\n3️⃣ Pulsa *Comprar DRAGON* abajo \\& haz swap\\!",
    quick_start:       "🚀 *Guía de Inicio Rápido*\n\n1\\. Añade Monad Mainnet a MetaMask\n2\\. Consigue MON para gas\n3\\. Toca *Comprar DRAGON* para obtener tus tokens\n4\\. Haz staking de MON para ganar GOLD\n5\\. Usa /balance para ver tu saldo\n6\\. Usa /watch para monitorear una wallet\n\nEscribe /help para todos los comandos\\.",
    choose_action:     "Elige una acción 👇",
    rpc_error:         "❌ El RPC está lento. Inténtalo de nuevo o consulta MonadScan:",
    invalid_address:   "❌ Dirección inválida. Proporciona una dirección 0x... válida.",
    invalid_amount:    "❌ Cantidad inválida. Introduce un número positivo (ej. 1.5):",
    fetching_balance:  "⏳ Obteniendo saldo...",
    fetching_info:     "⏳ Obteniendo info del token...",
    fetching_tokens:   "⏳ Cargando tokens disponibles...",
    fetching_quote:    "⏳ Buscando la mejor cotización...",
    fetching_staking:  "⏳ Obteniendo info de staking...",
    referral_msg:      "🔗 *Tu Enlace de Referido:*\n`{link}`\n\n¡Compártelo para invitar amigos y ganar recompensas\\!\n\n👥 *Tus referidos hasta ahora:* {count}",
  },
  fr: {
    welcome_fire:      "🔥 *Le Dragon s'est éveillé sur Monad Mainnet\\!*",
    how_to_buy:        "🟢 *Comment acheter DRAGON:*\n1️⃣ Ajoutez Monad Mainnet à votre wallet\n2️⃣ Obtenez du MON pour le gas\n3️⃣ Appuyez sur *Acheter DRAGON* ci-dessous\\!",
    quick_start:       "🚀 *Guide de Démarrage Rapide*\n\n1\\. Ajoutez Monad Mainnet à MetaMask\n2\\. Obtenez du MON pour le gas\n3\\. Appuyez sur *Acheter DRAGON* pour vos tokens\n4\\. Stakez du MON pour gagner des GOLD\n5\\. Utilisez /balance pour vérifier votre solde\n6\\. Utilisez /watch pour suivre un wallet\n\nTapez /help pour toutes les commandes\\.",
    choose_action:     "Choisissez une action 👇",
    rpc_error:         "❌ Le RPC est lent. Réessayez ou consultez MonadScan directement:",
    invalid_address:   "❌ Adresse invalide. Fournissez une adresse 0x... valide.",
    invalid_amount:    "❌ Montant invalide. Entrez un nombre positif (ex. 1.5):",
    fetching_balance:  "⏳ Récupération du solde...",
    fetching_info:     "⏳ Récupération des infos du token...",
    fetching_tokens:   "⏳ Chargement des tokens disponibles...",
    fetching_quote:    "⏳ Recherche du meilleur devis...",
    fetching_staking:  "⏳ Récupération des infos de staking...",
    referral_msg:      "🔗 *Votre Lien de Parrainage:*\n`{link}`\n\nPartagez-le pour inviter des amis\\!\n\n👥 *Vos parrainages:* {count}",
  },
};

function t(chatId, key, vars) {
  const lang = userLangs.get(chatId) || "en";
  const dict = I18N[lang] || I18N.en;
  let   str  = dict[key] || I18N.en[key] || key;
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

function timeLeft(ts) {
  const diff = Number(ts) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "✅ Ready to claim";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `⏳ ${d}d ${h}h ${m}m remaining`;
}

// ── API HELPERS ───────────────────────────────────────────────────
async function getTokenInfo() {
  const [name, symbol, supply, decimals] = await Promise.all([
    dragonC.name(), dragonC.symbol(), dragonC.totalSupply(), dragonC.decimals(),
  ]);
  return { name, symbol, supply, decimals };
}

async function getBalance(address) {
  const [balance, decimals] = await Promise.all([
    dragonC.balanceOf(address), dragonC.decimals(),
  ]);
  return { balance, decimals };
}

async function getGoldBalance(address) {
  const [balance, decimals] = await Promise.all([
    goldC.balanceOf(address), goldC.decimals(),
  ]);
  return { balance, decimals };
}

async function getStakingGlobal() {
  const [totalStaked, decimals] = await Promise.all([
    stakingC.totalStaked(), dragonC.decimals(),
  ]);
  return { totalStaked, decimals };
}

async function getStakingInfo(address) {
  const [info, pending, decimals] = await Promise.all([
    stakingC.stakeInfo(address),
    stakingC.pendingRewards(address),
    dragonC.decimals(),
  ]);
  return {
    staked:       info[0],
    stakedAt:     info[1],
    unstakeAmt:   info[3],
    unstakeAt:    info[4],
    canClaim:     info[5],
    pendingGold:  pending,
    decimals,
  };
}

async function getNearTokens() {
  const res  = await fetch("https://1click.chaindefuser.com/v0/tokens", {
    headers: { Authorization: "Bearer " + NEAR_JWT },
  });
  const data = await res.json();
  return data.filter(tk =>
    ["eth","btc","sol","usdc","usdt","near"].some(s => tk.symbol?.toLowerCase().includes(s))
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
        { text: "🟢 Buy DRAGON",    url: BUY_URL   },
        { text: "🔄 Trade",          url: TRADE_URL },
      ],
      [
        { text: "🥩 Stake MON",      url: STAKE_URL },
        { text: "🪙 GOLD Rewards",   callback_data: "gold_info" },
      ],
      [
        { text: "💰 My Balance",     callback_data: "balance"  },
        { text: "📊 Token Info",     callback_data: "info"     },
      ],
      [
        { text: "🔥 Swap",           callback_data: "swap"     },
        { text: "⛏️ LP Mining",      callback_data: "mining"   },
      ],
      [
        { text: "🔔 Supply Alert",   callback_data: "alert"    },
        { text: "👁️ Watch Wallet",   callback_data: "watch"    },
      ],
      [
        { text: "🔗 Referral",       callback_data: "referral" },
        { text: "🌐 Open dApp",      url: DAPP_URL              },
      ],
      [
        { text: "📈 MonadVision",    url: `${VISION}/token/${TOKEN_ADDRESS}` },
        { text: "🔍 Explorer",       url: `${EXPLORER}/token/${TOKEN_ADDRESS}` },
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

💎 *DRAGON Contract:*
\`${TOKEN_ADDRESS}\`

🪙 *GOLD Contract:*
\`${GOLD_ADDRESS}\`

🌐 *Network:* Monad Mainnet · Chain 143
📐 *Standard:* ERC\\-20

━━━━━━━━━━━━━━━━━━━━
${t(chatId, "how_to_buy")}
━━━━━━━━━━━━━━━━━━━━

🥩 *Stake MON → Earn 1 GOLD per MON per day*

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
        [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }],
        [{ text: "🔗 My Referral", callback_data: "referral" }, { text: "📖 All Commands", callback_data: "help_inline" }],
      ],
    },
  });
}

// ── /start ────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const lang   = detectLang(msg);
  userLangs.set(chatId, lang);
  clearSession(chatId);
  if (match && match[1]) recordReferral(match[1], chatId);
  await sendWelcome(chatId, lang);
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
  const chatId  = msg.chat.id;
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
bot.onText(/\/buy/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🟢 *Buy DRAGON*\n\nGet DRAGON tokens on Monad Mainnet\\!\n\n[👉 Open Buy Page](${BUY_URL})`,
    { parse_mode: "MarkdownV2" }
  );
});

// ── /trade ────────────────────────────────────────────────────────
bot.onText(/\/trade/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🔄 *Trade DRAGON*\n\nSwap tokens on the Dragon Monad dApp\\!\n\n[👉 Open Trade Page](${TRADE_URL})`,
    { parse_mode: "MarkdownV2" }
  );
});

// ── /stake ────────────────────────────────────────────────────────
bot.onText(/\/stake/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleStakingGlobal(msg.chat.id);
});

// ── /mystake <address> ────────────────────────────────────────────
bot.onText(/\/mystake (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"), {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
    });
  }
  await handleMyStake(msg.chat.id, addr);
});

// ── /gold <address> ───────────────────────────────────────────────
bot.onText(/\/gold (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) {
    return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"), {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
    });
  }
  await handleGoldBalance(msg.chat.id, addr);
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

// ── /contracts ────────────────────────────────────────────────────
bot.onText(/\/contracts/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleContracts(msg.chat.id);
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
  if (!isAddress(addr)) return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"));
  walletWatchers.set(msg.chat.id, addr.toLowerCase());
  bot.sendMessage(msg.chat.id,
    `👁️ *Watching wallet:*\n\`${addr}\`\n\nYou'll receive balance updates every 5 minutes.\nUse /stopwatch to stop.`,
    { parse_mode: "Markdown" }
  );
});

// ── /stopwatch ────────────────────────────────────────────────────
bot.onText(/\/stopwatch/, (msg) => {
  walletWatchers.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🛑 Wallet watch stopped.");
});

// ── /dapp ─────────────────────────────────────────────────────────
bot.onText(/\/dapp/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🌐 *Dragon Monad dApp*\n\n[👉 Open dApp](${DAPP_URL})\n\n• Wallet · Stake · Swap · Airdrop · Info`,
    { parse_mode: "Markdown" }
  );
});

// ── /help ─────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  sendHelpMessage(msg.chat.id);
});

function sendHelpMessage(chatId) {
  const text = `🐉 *Dragon Monad Bot — Commands*

/start — Welcome screen & onboarding
/menu — Main menu
/buy — Buy DRAGON tokens
/trade — Trade on dApp
/stake — Global staking stats
/mystake \`<address>\` — Your staking position & GOLD rewards
/gold \`<address>\` — Check GOLD token balance
/referral — Get your referral link
/balance \`<address>\` — Check DRAGON balance
/info — Token contract info
/contracts — All contract addresses
/swap — Swap tokens via NEAR Intents
/mining — LP Mining info
/alert — Set supply alert
/watch \`<address>\` — Watch a wallet (5min updates)
/stopwatch — Stop wallet watching
/dapp — Open the dApp
/help — This help message

*Quick links:*
🟢 [Buy DRAGON](${BUY_URL})
🥩 [Stake MON](${STAKE_URL})
🔄 [Trade](${TRADE_URL})
🌐 [dApp](${DAPP_URL})
📈 [MonadVision](${VISION}/token/${TOKEN_ADDRESS})
🔍 [Explorer](${EXPLORER}/token/${TOKEN_ADDRESS})`;

  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }],
        [{ text: "🔗 My Referral", callback_data: "referral" }],
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
      type: "article", id: "help",
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
      type: "article", id: "invalid",
      title: "❌ Invalid address",
      description: "Please type a valid 0x... Ethereum address",
      input_message_content: { message_text: "❌ Invalid address. Provide a valid 0x... Ethereum address." },
    }], { cache_time: 0 });
  }

  try {
    const [
      { balance: dBal, decimals },
      { balance: gBal },
    ] = await Promise.all([getBalance(addr), getGoldBalance(addr)]);

    bot.answerInlineQuery(query.id, [{
      type: "article", id: "balance",
      title: `💰 ${fmt(dBal, decimals)} DRAGON`,
      description: `GOLD: ${fmt(gBal, decimals)} | ${shortAddr(addr)}`,
      input_message_content: {
        message_text:
`💰 *DRAGON Balance*

*Address:* \`${addr}\`
*DRAGON:* \`${fmt(dBal, decimals)} DRAGON\`
*GOLD:* \`${fmt(gBal, decimals)} GOLD\`

[Explorer](${EXPLORER}/address/${addr}) | [MonadVision](${VISION}/token/${TOKEN_ADDRESS}) | [dApp](${DAPP_URL})`,
        parse_mode: "Markdown",
      },
      reply_markup: {
        inline_keyboard: [[
          { text: "🟢 Buy DRAGON", url: BUY_URL },
          { text: "🥩 Stake MON",  url: STAKE_URL },
        ]],
      },
    }], { cache_time: 30 });
  } catch {
    bot.answerInlineQuery(query.id, [{
      type: "article", id: "error",
      title: "❌ RPC Error",
      description: "Could not fetch balance. Try again.",
      input_message_content: {
        message_text: `❌ Could not fetch balance for \`${shortAddr(addr)}\`\\. Try again or check [MonadScan](${EXPLORER}/address/${addr})`,
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
  else if (data === "info")       { await handleInfo(chatId); }
  else if (data === "swap")       { await startSwapFlow(chatId); }
  else if (data === "mining")     { await handleMining(chatId); }
  else if (data === "alert")      { await startAlertFlow(chatId); }
  else if (data === "gold_info")  { await handleGoldInfo(chatId); }
  else if (data === "staking")    { await handleStakingGlobal(chatId); }
  else if (data === "contracts")  { await handleContracts(chatId); }
  else if (data === "mystake_prompt") {
    setSession(chatId, "awaiting_mystake_address");
    bot.sendMessage(chatId, "🥩 Enter your wallet address to view your staking position:", {
      reply_markup: { force_reply: true },
    });
  }
  else if (data === "gold_prompt") {
    setSession(chatId, "awaiting_gold_address");
    bot.sendMessage(chatId, "🪙 Enter wallet address to check GOLD balance:", {
      reply_markup: { force_reply: true },
    });
  }
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
  else if (data === "watch") {
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
      `👁️ *Now watching:*\n\`${text}\`\n\nBalance updates every 5 minutes. Use /stopwatch to stop.`,
      { parse_mode: "Markdown" }
    );
  }
  else if (session.step === "awaiting_mystake_address") {
    clearSession(chatId);
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    await handleMyStake(chatId, text);
  }
  else if (session.step === "awaiting_gold_address") {
    clearSession(chatId);
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    await handleGoldBalance(chatId, text);
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
    const [
      { balance: dBal, decimals },
      { balance: gBal },
    ] = await Promise.all([getBalance(address), getGoldBalance(address)]);

    await bot.editMessageText(
`💰 *DRAGON Balance*

*Address:* \`${shortAddr(address)}\`
*DRAGON:* \`${fmt(dBal, decimals)} DRAGON\`
*GOLD:* \`${fmt(gBal, decimals)} GOLD\`

[View on Explorer](${EXPLORER}/address/${address}) | [MonadVision](${VISION}/token/${TOKEN_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown", disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }],
            [{ text: "🔄 Check Again", callback_data: "balance" }, { text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/address/${address}](${EXPLORER}/address/${address})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "balance" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleGoldBalance(chatId, address) {
  const loading = await bot.sendMessage(chatId, "⏳ Fetching GOLD balance...");
  try {
    const [{ balance: gBal, decimals }, pendingRaw] = await Promise.all([
      getGoldBalance(address),
      stakingC.pendingRewards(address).catch(() => 0n),
    ]);
    await bot.editMessageText(
`🪙 *GOLD Balance*

*Address:* \`${shortAddr(address)}\`
*GOLD Balance:* \`${fmt(gBal, decimals)} GOLD\`
*Unclaimed Rewards:* \`${fmt(pendingRaw, decimals)} GOLD\`

GOLD is earned by staking MON at *1 GOLD per MON per day*\\. Claim from the Stake tab in the dApp\\.

[View GOLD on MonadVision](${VISION}/token/${GOLD_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown", disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥩 Stake to Earn GOLD", url: STAKE_URL }, { text: "🌐 dApp", url: DAPP_URL }],
            [{ text: "🔍 GOLD on Explorer", url: `${EXPLORER}/token/${GOLD_ADDRESS}` }],
            [{ text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/token/${GOLD_ADDRESS}](${EXPLORER}/token/${GOLD_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleGoldInfo(chatId) {
  const loading = await bot.sendMessage(chatId, "⏳ Loading GOLD info...");
  try {
    const [supply, decimals] = await Promise.all([goldC.totalSupply(), goldC.decimals()]);
    await bot.editMessageText(
`🪙 *GOLD Token Info*

*Name:* GOLD
*Contract:* \`${GOLD_ADDRESS}\`
*Total Supply:* \`${fmt(supply, decimals)} GOLD\`
*Network:* Monad Mainnet · Chain 143
*Verified:* Sourcify ✅

━━━━━━━━━━━━━━━━━━━━
💡 *How to earn GOLD:*
1\\. Stake MON in the Stake tab
2\\. Earn 1 GOLD per MON per day
3\\. Claim anytime — GOLD goes to your wallet

[View GOLD on MonadVision](${VISION}/token/${GOLD_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown", disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥩 Stake MON Now", url: STAKE_URL }, { text: "🌐 dApp", url: DAPP_URL }],
            [{ text: "📈 GOLD on MonadVision", url: `${VISION}/token/${GOLD_ADDRESS}` }],
            [{ text: "🔍 GOLD Explorer", url: `${EXPLORER}/token/${GOLD_ADDRESS}` }],
            [{ text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/token/${GOLD_ADDRESS}](${EXPLORER}/token/${GOLD_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleStakingGlobal(chatId) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_staking"));
  try {
    const { totalStaked, decimals } = await getStakingGlobal();
    await bot.editMessageText(
`🥩 *Liquid Staking — Dragon Monad*

*Total MON Staked:* \`${fmt(totalStaked, decimals)} MON\`

━━━━━━━━━━━━━━━━━━━━
📐 *Staking Rules:*
• Rate: 1 GOLD per MON per day
• Normal unstake: 7-day delay
• Instant unstake: 10% penalty to treasury
• Claim rewards anytime

📄 *Staking Contract:*
\`${STAKING_ADDRESS}\`

📄 *GOLD Contract:*
\`${GOLD_ADDRESS}\`

Use /mystake \`<address>\` to see your personal staking position.`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥩 Stake MON", url: STAKE_URL }, { text: "🌐 dApp", url: DAPP_URL }],
            [{ text: "👤 My Position", callback_data: "mystake_prompt" }],
            [{ text: "🔍 Staking Contract", url: `${EXPLORER}/address/${STAKING_ADDRESS}` }],
            [{ text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/address/${STAKING_ADDRESS}](${EXPLORER}/address/${STAKING_ADDRESS})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "staking" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      }
    );
  }
}

async function handleMyStake(chatId, address) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_staking"));
  try {
    const { staked, unstakeAmt, unstakeAt, canClaim, pendingGold, decimals } = await getStakingInfo(address);
    const unstakeLine = unstakeAmt > 0n
      ? `\n*Pending Unstake:* \`${fmt(unstakeAmt, decimals)} MON\`\n*Unlock:* ${timeLeft(unstakeAt)}`
      : "";

    await bot.editMessageText(
`🥩 *My Staking Position*

*Address:* \`${shortAddr(address)}\`
*Staked MON:* \`${fmt(staked, decimals)} MON\`
*Pending GOLD:* \`${fmt(pendingGold, decimals)} GOLD\`${unstakeLine}

💡 Claim your GOLD rewards from the Stake tab in the dApp\\. 
Earning 1 GOLD per MON per day\\.`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥩 Stake / Claim", url: STAKE_URL }, { text: "🌐 dApp", url: DAPP_URL }],
            [{ text: "🔄 Refresh", callback_data: "mystake_prompt" }, { text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch {
    bot.editMessageText(
      `${t(chatId, "rpc_error")}\n\n[${EXPLORER}/address/${address}](${EXPLORER}/address/${address})`,
      {
        chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
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
*Verified:* Sourcify ✅

*DRAGON Contract:*
\`${TOKEN_ADDRESS}\`

*GOLD Contract:*
\`${GOLD_ADDRESS}\`

*LiquidStaking Contract:*
\`${STAKING_ADDRESS}\`

*LP Mining Contract:*
\`${LP_MINING}\``,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }],
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

async function handleContracts(chatId) {
  bot.sendMessage(chatId,
`📄 *All Contract Addresses*

🐉 *DRAGON Token:*
\`${TOKEN_ADDRESS}\`

🪙 *GOLD Token (Rewards):*
\`${GOLD_ADDRESS}\`

🥩 *LiquidStaking:*
\`${STAKING_ADDRESS}\`

⛏️ *LP Mining:*
\`${LP_MINING}\`

🏦 *Treasury:*
\`${TREASURY}\`

🌐 *Network:* Monad Mainnet · Chain 143
🔗 *dApp:* ${DAPP_URL}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔍 DRAGON", url: `${EXPLORER}/token/${TOKEN_ADDRESS}` }, { text: "🔍 GOLD", url: `${EXPLORER}/token/${GOLD_ADDRESS}` }],
          [{ text: "🔍 Staking", url: `${EXPLORER}/address/${STAKING_ADDRESS}` }, { text: "🔍 LP Mining", url: `${EXPLORER}/address/${LP_MINING}` }],
          [{ text: "🌐 Open dApp", url: DAPP_URL }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    }
  );
}

async function startSwapFlow(chatId) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching_tokens"));
  try {
    const tokens  = await getNearTokens();
    const buttons = tokens.slice(0, 8).map(tk => [{
      text: `${tk.symbol}${tk.price ? ` ($${Number(tk.price).toFixed(2)})` : ""}`,
      callback_data: `swap_token:${tk.assetId}`,
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
    const origin    = tokens.find(tk => tk.assetId === originAsset);
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
      "❌ Could not fetch quote\\. Try a different token or amount\\.",
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

*DRAGON Contract:*
\`${TOKEN_ADDRESS}\`

*Network:* Monad Mainnet · Chain 143

💡 Also try *Liquid Staking* — stake MON and earn 1 GOLD per MON per day\\.`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }],
          [{ text: "🔍 Mining Contract", url: `${EXPLORER}/address/${LP_MINING}` }],
          [{ text: "📊 MonadVision", url: `${VISION}/token/${TOKEN_ADDRESS}` }],
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
            reply_markup: { inline_keyboard: [[{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }]] },
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
    const supply    = await dragonC.totalSupply();
    const decimals  = await dragonC.decimals();
    const supplyNum = Number(ethers.formatUnits(supply, decimals));

    for (const [chatId, alert] of priceAlerts.entries()) {
      if (!alert.triggered && supplyNum >= alert.threshold) {
        alert.triggered = true;
        bot.sendMessage(chatId,
          `🔔 *Supply Alert Triggered\\!*\n\nTotal supply has reached *${supplyNum.toLocaleString()}* DRAGON\n\\(Your threshold: ${alert.threshold.toLocaleString()}\\)`,
          {
            parse_mode: "MarkdownV2",
            reply_markup: { inline_keyboard: [[{ text: "🟢 Buy DRAGON", url: BUY_URL }, { text: "🥩 Stake MON", url: STAKE_URL }]] },
          }
        );
      }
    }
  } catch {}
}, 10 * 60 * 1000);

// ── ERROR HANDLING ────────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("🐉 Dragon Monad Bot is running...");
console.log(`   dApp:     ${DAPP_URL}`);
console.log(`   DRAGON:   ${TOKEN_ADDRESS}`);
console.log(`   GOLD:     ${GOLD_ADDRESS}`);
console.log(`   Staking:  ${STAKING_ADDRESS}`);
