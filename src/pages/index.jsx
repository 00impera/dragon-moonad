import { useState, useEffect } from "react";
import {
  ConnectButton,
  useActiveAccount,
  useReadContract,
  useSendTransaction,
  ThirdwebProvider,
  BuyWidget,
} from "thirdweb/react";
import {
  createThirdwebClient,
  defineChain,
  getContract,
  prepareContractCall,
  toWei,
} from "thirdweb";
import { createWallet, walletConnect } from "thirdweb/wallets";

// ── CONFIG ──────────────────────────────────────────────────────
const CLIENT_ID     = "821819db832d1a313ae3b1a62fbeafb7";
const NEAR_JWT      = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjUtMDEtMTItdjEifQ.eyJ2IjoxLCJrZXlfdHlwZSI6ImRpc3RyaWJ1dGlvbl9jaGFubmVsIiwicGFydG5lcl9pZCI6ImNyeXB0b2Nhc2gtbmZ0IiwiaWF0IjoxNzczMDc3MzExLCJleHAiOjE4MDQ2MTMzMTF9.Wi55S8cwVmAXPtOG0ymr7ldX-5CXVygzuanbjAAJHP-Am14_52C6i4cQG5FvjcAorw0KD8k8JD_YX5AM4QKhNqYtU5gsI4-KKe0KavO5_69NowzUKc_ubtjYn85eFjWskzZQvICMqSZkdGOSnMT_hNEePA8qYi_wSov4a4bQh4zIfNA0znEdDIV3rGI_bDM9dgOk0PnJRIpwi_aXOQ8Q4e50IO2UMrZEDtBVmUhK5-Mno3S_iS7tZl4QSui_4_bNCapQolFwUPB9Zqyxay_6rPVEr7j-8Ez5-htwkR5ZYvTb1mJaj3DVPpWPL9QTxhjvhbJ7nKrWpibcWX3AVoXZ6g";
const TOKEN_ADDRESS = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81";
const LP_MINING     = "0x28840f3e117345A5FBF08b7F67503D2F47B28023";
const COIN_LOGO     = "https://files.catbox.moe/byzt1g.png";

const MONAD_MAINNET = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpc: "https://rpc.monad.xyz",
  blockExplorers: [{ name: "Monadscan", url: "https://monadscan.com" }],
});

const client = createThirdwebClient({ clientId: CLIENT_ID });

const WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  walletConnect(),
  createWallet("io.rabby"),
  createWallet("com.trustwallet.app"),
  createWallet("app.phantom"),
];

const ERC20_ABI = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf",   outputs: [{ name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "name",        outputs: [{ name: "", type: "string"  }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "symbol",      outputs: [{ name: "", type: "string"  }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "decimals",    outputs: [{ name: "", type: "uint8"   }], stateMutability: "view",        type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
];

// ── UTILS ────────────────────────────────────────────────────────
function fmt(val, dec, digits) {
  var d  = dec    === undefined ? 18 : dec;
  var dg = digits === undefined ? 4  : digits;
  if (!val) return "0";
  try {
    var n = Number(BigInt(val.toString()) * 10000n / BigInt(Math.pow(10, d))) / 10000;
    return n.toLocaleString("en-US", { maximumFractionDigits: dg });
  } catch { return "0"; }
}

function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function vibrate() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([40, 15, 40, 15, 20]);
  }
}

// ── API HELPERS ──────────────────────────────────────────────────
async function getNearIntentsTokens() {
  const res = await fetch("https://1click.chaindefuser.com/v0/tokens", {
    headers: { Authorization: "Bearer " + NEAR_JWT },
  });
  return res.json();
}

async function getNearIntentsQuote({ originAsset, destinationAsset, amount, recipient }) {
  const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const res = await fetch("https://1click.chaindefuser.com/v0/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + NEAR_JWT },
    body: JSON.stringify({
      dry: false, swapType: "EXACT_INPUT", slippageTolerance: 100,
      originAsset, depositType: "ORIGIN_CHAIN", destinationAsset, amount,
      recipient, recipientType: "DESTINATION_CHAIN",
      refundTo: recipient, refundType: "ORIGIN_CHAIN", deadline,
    }),
  });
  return res.json();
}

// ── INLINE SVG DRAGON LOGO ────────────────────────────────────────
function DragonLogo({ size }) {
  var s = size || 48;
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: "50%", flexShrink: 0,
        background: "radial-gradient(circle at 40% 35%, #001a3a, #000d1a)",
        border: s > 80 ? "3px solid #00c8ff" : "2px solid #00c8ff",
        boxShadow: s > 80
          ? "0 0 40px rgba(0,200,255,0.7), 0 0 80px rgba(0,100,255,0.3)"
          : "0 0 16px rgba(0,200,255,0.7)",
      }}>
      <defs>
        <radialGradient id={"dg1" + s} cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#00eaff" />
          <stop offset="50%"  stopColor="#0066ff" />
          <stop offset="100%" stopColor="#003080" />
        </radialGradient>
        <radialGradient id={"dg2" + s} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00ffea" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0066ff" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="74" rx="28" ry="22" fill={"url(#dg1" + s + ")"} />
      <ellipse cx="60" cy="52" rx="14" ry="18" fill={"url(#dg1" + s + ")"} />
      <ellipse cx="60" cy="36" rx="18" ry="15" fill={"url(#dg1" + s + ")"} />
      <ellipse cx="60" cy="45" rx="10" ry="7" fill="#0044aa" />
      <ellipse cx="51" cy="31" rx="4.5" ry="5" fill="#00eaff" />
      <ellipse cx="51" cy="31" rx="2.2" ry="2.8" fill="#000d1a" />
      <ellipse cx="50.2" cy="30" rx="0.9" ry="0.9" fill="white" />
      <ellipse cx="69" cy="31" rx="4.5" ry="5" fill="#00eaff" />
      <ellipse cx="69" cy="31" rx="2.2" ry="2.8" fill="#000d1a" />
      <ellipse cx="68.2" cy="30" rx="0.9" ry="0.9" fill="white" />
      <polygon points="46,23 41,6 51,19" fill="#00c8ff" />
      <polygon points="74,23 79,6 69,19" fill="#00c8ff" />
      <path d="M32,60 Q8,38 12,72 Q22,66 32,74 Z" fill="#003080" opacity="0.85" />
      <path d="M32,60 Q16,44 12,72" stroke="#00c8ff" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M88,60 Q112,38 108,72 Q98,66 88,74 Z" fill="#003080" opacity="0.85" />
      <path d="M88,60 Q104,44 108,72" stroke="#00c8ff" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M60,95 Q46,108 40,115 Q49,110 54,117 Q57,107 60,100" fill="#0066ff" opacity="0.75" />
      <ellipse cx="60" cy="70" rx="16" ry="10" fill="#00aaff" opacity="0.3" />
      <path d="M54,56 Q50,64 46,72 Q53,66 57,73 Q60,64 63,73 Q67,66 74,72 Q70,64 66,56 Z" fill={"url(#dg2" + s + ")"} opacity="0.9" />
      <ellipse cx="55" cy="44" rx="1.5" ry="1" fill="#000d1a" opacity="0.6" />
      <ellipse cx="65" cy="44" rx="1.5" ry="1" fill="#000d1a" opacity="0.6" />
      <circle cx="60" cy="60" r="57" stroke="#00c8ff" strokeWidth="1.5" fill="none" opacity="0.2" />
      <circle cx="60" cy="60" r="53" stroke="#00eaff" strokeWidth="0.5" fill="none" opacity="0.12" />
    </svg>
  );
}

// ── LOGO WITH FALLBACK ────────────────────────────────────────────
function LogoImage({ size }) {
  const [broken, setBroken] = useState(false);
  var s = size || 48;
  if (broken) return <DragonLogo size={s} />;
  return (
    <img src={COIN_LOGO} alt="Dragon" width={s} height={s}
      style={{ borderRadius: "50%", flexShrink: 0, display: "block", objectFit: "cover",
        border: s > 80 ? "3px solid #00c8ff" : "2px solid #00c8ff",
        boxShadow: s > 80
          ? "0 0 40px rgba(0,200,255,0.7), 0 0 80px rgba(0,100,255,0.3)"
          : "0 0 16px rgba(0,200,255,0.6)",
      }}
      onError={function() { setBroken(true); }}
    />
  );
}

// ── OCEAN PARTICLES ───────────────────────────────────────────────
function OceanParticles() {
  var items = [];
  for (var i = 0; i < 35; i++) {
    items.push(
      <div key={i} className={"op op" + (i % 4)} style={{
        left: ((i * 31 + 3) % 100) + "%",
        animationDelay:    ((i * 0.35) % 9) + "s",
        animationDuration: (5 + (i * 0.28) % 7) + "s",
      }} />
    );
  }
  return <div className="ocean-particles">{items}</div>;
}

// ── BUY WITH CARD ─────────────────────────────────────────────────
function BuyWithCard({ account, sym }) {
  const [show, setShow] = useState(false);
  if (!account) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {!show ? (
        <button className="btn-neon" onClick={function() { vibrate(); setShow(true); }}>
          💳 BUY {sym} WITH CARD
        </button>
      ) : (
        <>
          <button className="btn-outline" style={{ marginBottom: 12, fontSize: 10 }} onClick={function() { setShow(false); }}>✕ CLOSE</button>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,200,255,0.4)" }}>
            <BuyWidget client={client} chain={MONAD_MAINNET} tokenAddress={TOKEN_ADDRESS} theme="dark" />
          </div>
        </>
      )}
    </div>
  );
}

// ── CONNECT BUTTON ────────────────────────────────────────────────
function DragonConnectButton({ title }) {
  return (
    <ConnectButton
      client={client}
      chain={MONAD_MAINNET}
      wallets={WALLETS}
      showAllWallets={true}
      theme="dark"
      btnTitle={title || "🔥 Connect"}
      connectModal={{
        title: "🐉 Connect Your Wallet",
        titleIcon: "",
        welcomeScreen: {
          title: "Dragon Monad",
          subtitle: "Choose your wallet to connect to Monad Mainnet and access DRAGON tokens",
        },
        showThirdwebBranding: false,
      }}
    />
  );
}

// ── BOTTOM BANNER ─────────────────────────────────────────────────
function BottomBanner() {
  const links = [
    {
      href: "https://t.me/DragonMonadBot",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M21.8 2.15L1.5 9.9c-1.3.5-1.3 1.2-.2 1.5l5.2 1.6 12-7.6c.6-.4 1.1-.2.7.2L8.3 15.5v3.7c0 .8.4 1 .9.5l2.5-2.4 5.1 3.8c.9.5 1.6.2 1.8-.9L22.8 3.4c.3-1.3-.5-1.9-1-1.25z" fill="#00c8ff"/>
        </svg>
      ),
      label: "TELEGRAM BOT",
      sub: "t.me/DragonMonadBot",
      color: "#00c8ff",
      glow: "rgba(0,200,255,0.25)",
    },
    {
      href: "https://x.com/bnbgold277983",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#a78bfa">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      label: "TWITTER",
      sub: "@bnbgold277983",
      color: "#a78bfa",
      glow: "rgba(167,139,250,0.25)",
    },
    {
      href: "https://discord.com/channels/1316093079090106472",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#7289da">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.055a19.99 19.99 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.201 13.201 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
      ),
      label: "DISCORD",
      sub: "Join Community",
      color: "#7289da",
      glow: "rgba(114,137,218,0.25)",
    },
    {
      href: "https://monadvision.com/token/" + TOKEN_ADDRESS,
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M2 12C2 12 6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12z" stroke="#00ffcc" strokeWidth="1.8"/>
          <circle cx="12" cy="12" r="3" fill="#00ffcc" opacity="0.6"/>
        </svg>
      ),
      label: "MONADVISION",
      sub: "Token Analytics",
      color: "#00ffcc",
      glow: "rgba(0,255,204,0.25)",
    },
    {
      href: "https://thirdweb.com",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: "THIRDWEB",
      sub: "Powered by",
      color: "#f59e0b",
      glow: "rgba(245,158,11,0.25)",
    },
  ];

  return (
    <div className="bottom-banner">
      <div className="bb-inner">
        <div className="bb-top-bar" />
        <div className="bb-links">
          {links.map(function(l, i) {
            return (
              <a key={i} href={l.href} target="_blank" rel="noopener noreferrer"
                className="bb-link"
                style={{ "--link-color": l.color, "--link-glow": l.glow }}>
                <span className="bb-icon">{l.icon}</span>
                <span className="bb-label" style={{ color: l.color }}>{l.label}</span>
                <span className="bb-sub">{l.sub}</span>
              </a>
            );
          })}
        </div>
        <div className="bb-footer">
          🐉 DRAGON TOKEN · MONAD MAINNET · CHAIN 143 · © 2026
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────
function DragonApp() {
  const account = useActiveAccount();
  const [tab,         setTab        ] = useState("wallet");
  const [transferTo,  setTransferTo ] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [txStatus,    setTxStatus   ] = useState(null);
  const [swapTokens,  setSwapTokens ] = useState([]);
  const [swapOrigin,  setSwapOrigin ] = useState("");
  const [swapAmount,  setSwapAmount ] = useState("");
  const [swapQuote,   setSwapQuote  ] = useState(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError,   setSwapError  ] = useState(null);

  const contract = getContract({ client, chain: MONAD_MAINNET, address: TOKEN_ADDRESS, abi: ERC20_ABI });
  const { data: balance     } = useReadContract({ contract, method: "balanceOf",   params: [account ? account.address : "0x0000000000000000000000000000000000000000"] });
  const { data: totalSupply } = useReadContract({ contract, method: "totalSupply", params: [] });
  const { data: tokenName   } = useReadContract({ contract, method: "name",        params: [] });
  const { data: tokenSymbol } = useReadContract({ contract, method: "symbol",      params: [] });
  const { mutate: sendTx    } = useSendTransaction();

  useEffect(function() {
    getNearIntentsTokens()
      .then(function(tokens) {
        setSwapTokens(tokens.filter(function(t) {
          return ["eth","btc","sol","usdc","usdt","near"].some(function(s) {
            return t.symbol && t.symbol.toLowerCase().includes(s);
          });
        }));
      })
      .catch(function() {});
  }, []);

  function handleTransfer() {
    if (!transferTo || !transferAmt) return;
    vibrate();
    setTxStatus("pending");
    var tx = prepareContractCall({ contract, method: "transfer", params: [transferTo, toWei(transferAmt)] });
    sendTx(tx, {
      onSuccess: function() { setTxStatus("success"); },
      onError:   function() { setTxStatus("error");   },
    });
  }

  async function handleGetQuote() {
    if (!swapOrigin || !swapAmount || !account) return;
    vibrate();
    setSwapLoading(true); setSwapError(null); setSwapQuote(null);
    try {
      var destAsset   = "nep141:monad-" + TOKEN_ADDRESS.toLowerCase() + ".omft.near";
      var originToken = swapTokens.find(function(t) { return t.assetId === swapOrigin; });
      var decimals    = originToken && originToken.decimals ? originToken.decimals : 18;
      var amountRaw   = (BigInt(Math.round(parseFloat(swapAmount) * Math.pow(10, decimals)))).toString();
      var quote       = await getNearIntentsQuote({ originAsset: swapOrigin, destinationAsset: destAsset, amount: amountRaw, recipient: account.address });
      setSwapQuote(quote);
    } catch { setSwapError("Could not fetch quote. Try a different token or amount."); }
    setSwapLoading(false);
  }

  var sym = tokenSymbol || "DRAGON";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --neon:      #00c8ff;
          --neon2:     #0066ff;
          --neon3:     #00eaff;
          --neon4:     #00ffcc;
          --accent:    #a78bfa;
          --gold:      #f59e0b;
          --deep:      #00060f;
          --navy:      #000d1f;
          --navy2:     #001230;
          --border:    rgba(0,200,255,0.25);
          --border2:   rgba(0,200,255,0.5);
          --text:      #e0f4ff;
          --text-dim:  rgba(224,244,255,0.55);
          --text-faint:rgba(224,244,255,0.25);
        }

        body { background: var(--deep); color: var(--text); font-family: 'Rajdhani', sans-serif; }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%,   rgba(0,50,120,0.5)  0%, transparent 65%),
            radial-gradient(ellipse 45% 35% at 10% 80%,  rgba(0,100,200,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 45% 35% at 90% 80%,  rgba(0,200,255,0.1) 0%, transparent 55%),
            var(--deep);
          position: relative; overflow-x: hidden;
        }
        .app::before {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,200,255,0.018) 3px, rgba(0,200,255,0.018) 4px);
        }

        /* ── PARTICLES ── */
        .ocean-particles { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
        .op  { position: absolute; bottom: -20px; border-radius: 50%; animation: oceanRise linear infinite; }
        .op0 { width: 5px;  height: 12px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: radial-gradient(#00c8ff, transparent); opacity: 0.6; }
        .op1 { width: 3px;  height: 8px;  border-radius: 50%; background: radial-gradient(#00eaff, transparent); opacity: 0.4; }
        .op2 { width: 6px;  height: 6px;  border-radius: 50%; background: radial-gradient(#0066ff, transparent); opacity: 0.25; }
        .op3 { width: 2px;  height: 10px; border-radius: 50%; background: radial-gradient(#00ffcc, transparent); opacity: 0.3; }
        @keyframes oceanRise {
          0%   { transform: translateY(0) scaleX(1);       opacity: 0; }
          8%   { opacity: 1; }
          85%  { opacity: 0.2; }
          100% { transform: translateY(-100vh) scaleX(0.6); opacity: 0; }
        }

        /* ── HEADER ── */
        .header {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 40px;
          border-bottom: 1px solid var(--border);
          background: rgba(0,6,15,0.92);
          backdrop-filter: blur(20px);
          box-shadow: 0 1px 0 rgba(0,200,255,0.15), 0 4px 32px rgba(0,0,0,0.8);
        }
        .logo { display: flex; align-items: center; gap: 14px; }
        .logo-text {
          font-family: 'Cinzel', serif; font-size: 22px; font-weight: 900;
          background: linear-gradient(135deg, #00eaff, #0066ff, #00ffcc);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          letter-spacing: 4px;
          filter: drop-shadow(0 0 10px rgba(0,200,255,0.6));
        }
        .logo-sub { font-size: 9px; color: var(--text-faint); letter-spacing: 4px; text-transform: uppercase; margin-top: 3px; font-family: 'Cinzel', serif; }
        .chain-badge {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 16px; border-radius: 20px;
          background: rgba(0,200,255,0.08); border: 1px solid var(--border);
          font-size: 10px; color: var(--neon); letter-spacing: 2px; font-family: 'Cinzel', serif;
          box-shadow: 0 0 12px rgba(0,200,255,0.12);
        }
        .neon-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--neon); box-shadow: 0 0 8px var(--neon); display: inline-block; animation: pulse 2s infinite alternate; }
        @keyframes pulse { 0% { opacity: 1; box-shadow: 0 0 8px var(--neon); } 100% { opacity: 0.3; box-shadow: none; } }

        /* ── HERO ── */
        .hero { position: relative; z-index: 5; text-align: center; padding: 56px 20px 32px; }
        .hero-logo { display: flex; justify-content: center; margin-bottom: 24px; }
        .hero-logo > * { animation: dragonFloat 5s ease-in-out infinite; }
        @keyframes dragonFloat {
          0%,100% { transform: translateY(0) rotate(-1deg); filter: drop-shadow(0 0 20px rgba(0,200,255,0.6)); }
          50%      { transform: translateY(-14px) rotate(1deg); filter: drop-shadow(0 0 35px rgba(0,200,255,0.9)); }
        }
        .hero-title {
          font-family: 'Cinzel', serif; font-size: clamp(36px, 8vw, 72px); font-weight: 900; letter-spacing: 10px;
          background: linear-gradient(135deg, #00eaff 0%, #0066ff 40%, #00ffcc 70%, #a78bfa 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: titleGlow 3s ease-in-out infinite alternate;
        }
        @keyframes titleGlow {
          0%   { filter: drop-shadow(0 0 20px rgba(0,200,255,0.5)); }
          100% { filter: drop-shadow(0 0 35px rgba(0,234,255,0.8)); }
        }
        .hero-sub { margin-top: 10px; font-size: 12px; letter-spacing: 5px; text-transform: uppercase; color: var(--text-dim); font-family: 'Cinzel', serif; }
        .hero-divider {
          margin: 28px auto; width: 220px; height: 1px;
          background: linear-gradient(90deg, transparent, #00c8ff, #00ffcc, #0066ff, transparent);
          box-shadow: 0 0 14px rgba(0,200,255,0.5);
        }

        /* ── SOCIAL LINKS ── */
        .social-links { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
        .social-link {
          display: inline-flex; align-items: center; gap: 7px; padding: 8px 18px; border-radius: 20px;
          background: rgba(0,200,255,0.06); border: 1px solid var(--border);
          color: var(--text-dim); text-decoration: none; font-size: 12px;
          font-family: 'Cinzel', serif; letter-spacing: 1px; transition: all .2s;
        }
        .social-link:hover { background: rgba(0,200,255,0.14); border-color: var(--neon); color: var(--neon); box-shadow: 0 0 16px rgba(0,200,255,0.25); }

        /* ── STATS ── */
        .stats { position: relative; z-index: 5; display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 0 40px 36px; }
        .stat-card {
          background: linear-gradient(135deg, rgba(0,18,48,0.9), rgba(0,6,15,0.95));
          border: 1px solid var(--border); border-radius: 12px; padding: 18px 28px; min-width: 160px; text-align: center;
          transition: all .3s; position: relative; overflow: hidden;
        }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #00c8ff, #00ffcc, transparent); }
        .stat-card:hover { border-color: var(--neon); box-shadow: 0 0 24px rgba(0,200,255,0.2); transform: translateY(-3px); }
        .stat-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-faint); font-family: 'Cinzel', serif; }
        .stat-value { font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; margin-top: 6px; background: linear-gradient(135deg, #00eaff, #00ffcc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        /* ── TABS ── */
        .tabs { position: relative; z-index: 5; display: flex; justify-content: center; gap: 6px; padding: 0 20px 24px; flex-wrap: wrap; }
        .tab-btn {
          padding: 10px 28px; border-radius: 6px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim);
          font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all .2s;
          -webkit-tap-highlight-color: transparent;
        }
        .tab-btn.active { background: rgba(0,200,255,0.1); color: var(--neon3); border-color: var(--neon); box-shadow: 0 0 16px rgba(0,200,255,0.2), inset 0 0 12px rgba(0,200,255,0.05); }
        .tab-btn:not(.active):hover { border-color: rgba(0,200,255,0.5); color: var(--text); background: rgba(0,200,255,0.05); }

        /* ── PANEL & CARD ── */
        .panel { position: relative; z-index: 5; max-width: 560px; margin: 0 auto; padding: 0 20px 40px; }
        .card {
          background: linear-gradient(135deg, rgba(0,14,36,0.97), rgba(0,6,15,0.99));
          border: 1px solid var(--border); border-radius: 16px; padding: 30px;
          box-shadow: 0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(0,200,255,0.1);
          animation: fadeUp .35s ease; position: relative; overflow: hidden;
        }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #00c8ff, #00ffcc, #0066ff, transparent); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

        .card-title { font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700; background: linear-gradient(135deg, #00eaff, #00ffcc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 22px; display: flex; align-items: center; gap: 10px; letter-spacing: 3px; }
        .card-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(0,200,255,0.5), transparent); }

        /* balance */
        .balance-display { text-align: center; padding: 32px 20px; background: radial-gradient(ellipse at center, rgba(0,200,255,0.07) 0%, transparent 70%); border-radius: 12px; border: 1px solid rgba(0,200,255,0.2); margin-bottom: 24px; }
        .balance-amount { font-family: 'Cinzel', serif; font-size: 42px; font-weight: 900; background: linear-gradient(135deg, #00eaff, #0066ff, #00ffcc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .balance-symbol { font-size: 18px; color: var(--neon); margin-left: 8px; font-family: 'Cinzel', serif; }
        .balance-addr   { font-size: 11px; color: var(--text-faint); margin-top: 8px; font-family: monospace; }

        /* fields */
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-faint); margin-bottom: 6px; font-family: 'Cinzel', serif; }
        .field input, .field select { width: 100%; padding: 11px 14px; border-radius: 8px; background: rgba(0,6,15,0.9); border: 1px solid var(--border); color: var(--text); font-family: 'Rajdhani', sans-serif; font-size: 15px; outline: none; transition: border-color .2s, box-shadow .2s; }
        .field input:focus, .field select:focus { border-color: var(--neon); box-shadow: 0 0 0 2px rgba(0,200,255,0.12); }
        .field select option { background: #000d1f; color: var(--text); }

        /* buttons */
        @keyframes neonShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .btn-neon {
          width: 100%; padding: 14px; border-radius: 8px; border: 1px solid rgba(0,200,255,0.5); cursor: pointer;
          background: linear-gradient(135deg, rgba(0,200,255,0.15), rgba(0,100,255,0.15), rgba(0,255,204,0.12));
          background-size: 200% 200%; animation: neonShift 4s ease infinite;
          color: var(--neon3); font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
          letter-spacing: 3px; text-transform: uppercase;
          box-shadow: 0 0 20px rgba(0,200,255,0.3), 0 0 40px rgba(0,100,255,0.15);
          transition: box-shadow .2s, transform .15s; -webkit-tap-highlight-color: transparent;
        }
        .btn-neon:hover:not(:disabled) { box-shadow: 0 0 35px rgba(0,200,255,0.6), 0 0 60px rgba(0,200,255,0.3); transform: scale(1.02); color: #fff; }
        .btn-neon:active:not(:disabled) { transform: scale(0.97); }
        .btn-neon:disabled { opacity: 0.3; cursor: not-allowed; animation: none; }

        .btn-outline { width: 100%; padding: 11px; border-radius: 8px; margin-top: 10px; border: 1px solid rgba(0,200,255,0.3); background: transparent; color: var(--text-dim); font-family: 'Cinzel', serif; font-size: 10px; cursor: pointer; transition: all .2s; letter-spacing: 2px; -webkit-tap-highlight-color: transparent; }
        .btn-outline:hover { border-color: var(--neon); color: var(--neon3); background: rgba(0,200,255,0.06); }

        /* status */
        .status { margin-top: 12px; padding: 11px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; text-align: center; font-family: 'Cinzel', serif; letter-spacing: 2px; }
        .status.pending { background: rgba(255,165,0,.08); color: #ffa500; border: 1px solid rgba(255,165,0,.25); }
        .status.success { background: rgba(0,200,255,.08); color: var(--neon3); border: 1px solid rgba(0,200,255,.3); }
        .status.error   { background: rgba(200,0,0,.08);   color: #ff5050;    border: 1px solid rgba(200,0,0,.3); }

        /* quote */
        .quote-box { margin-top: 14px; padding: 14px; border-radius: 10px; background: rgba(0,200,255,0.04); border: 1px solid var(--border); }
        .quote-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid rgba(0,200,255,0.08); font-size: 13px; }
        .quote-row:last-child { border-bottom: none; }
        .quote-row span:first-child { color: var(--text-dim); }
        .quote-row span:last-child  { color: var(--neon3); font-weight: 700; font-family: 'Cinzel', serif; font-size: 11px; }
        .deposit-box { margin-top: 14px; padding: 14px; border-radius: 8px; background: rgba(0,200,255,0.05); border: 1px solid rgba(0,200,255,0.3); word-break: break-all; font-size: 11px; color: var(--neon3); font-family: monospace; line-height: 1.7; }

        /* info rows */
        .info-row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid rgba(0,200,255,0.08); font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
        .info-row .k { color: var(--text-faint); font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
        .info-row .v { color: var(--neon3); font-weight: 600; font-family: monospace; word-break: break-all; text-align: right; max-width: 62%; }

        /* connect prompt */
        .connect-prompt { text-align: center; padding: 40px 20px; }
        .connect-icon { display: flex; justify-content: center; margin-bottom: 20px; }
        .connect-msg  { color: var(--text-dim); font-size: 15px; margin-bottom: 28px; line-height: 1.8; }

        /* ── BOTTOM BANNER ── */
        .bottom-banner {
          position: relative; z-index: 5;
          padding: 0 16px 16px;
        }
        .bb-inner {
          border: 1px solid rgba(0,200,255,0.3);
          border-radius: 16px; overflow: hidden;
          background: linear-gradient(135deg, rgba(0,12,32,0.98), rgba(0,6,15,0.99));
          box-shadow: 0 0 40px rgba(0,200,255,0.1), 0 0 80px rgba(0,100,255,0.05);
          position: relative;
        }
        .bb-top-bar {
          height: 2px;
          background: linear-gradient(90deg, #0066ff, #00c8ff, #00ffcc, #a78bfa, #f59e0b, #00c8ff, #0066ff);
          background-size: 200% 100%;
          animation: bbScroll 4s linear infinite;
        }
        @keyframes bbScroll { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        .bb-links {
          display: flex; align-items: stretch; justify-content: center;
          flex-wrap: wrap;
        }
        .bb-link {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 5px; padding: 18px 22px; text-decoration: none;
          flex: 1; min-width: 120px;
          transition: background .2s;
          border-right: 1px solid rgba(0,200,255,0.1);
          position: relative;
        }
        .bb-link:last-child { border-right: none; }
        .bb-link:hover {
          background: rgba(0,200,255,0.07);
          box-shadow: inset 0 0 30px var(--link-glow, rgba(0,200,255,0.08));
        }
        .bb-icon { line-height: 1; }
        .bb-label {
          font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700; letter-spacing: 2px;
          transition: filter .2s;
        }
        .bb-link:hover .bb-label { filter: brightness(1.3); text-shadow: 0 0 10px currentColor; }
        .bb-sub {
          font-size: 9px; color: var(--text-faint); letter-spacing: 1px;
          font-family: 'Rajdhani', sans-serif;
        }
        .bb-footer {
          text-align: center; padding: 10px 20px 14px;
          font-size: 8px; color: var(--text-faint); letter-spacing: 4px;
          font-family: 'Cinzel', serif;
          border-top: 1px solid rgba(0,200,255,0.08);
        }

        @media (max-width: 600px) {
          .header { padding: 14px 16px; }
          .stats  { padding: 0 12px 28px; }
          .hero   { padding: 36px 16px 20px; }
          .bb-link { padding: 14px 12px; min-width: 100px; }
          .chain-badge { display: none; }
        }
      `}</style>

      <div className="app">
        <OceanParticles />

        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <LogoImage size={48} />
            <div>
              <div className="logo-text">{tokenName || "DRAGON"}</div>
              <div className="logo-sub">Monad Network · Ocean Neon</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="chain-badge">
              <span className="neon-dot" />{" "}Monad · 143
            </div>
            <DragonConnectButton title="🔥 Connect" />
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-logo"><LogoImage size={130} /></div>
          <div className="hero-title">{sym}</div>
          <div className="hero-sub">🐉 Dragon of the Monad Chain · Ocean Neon Power</div>
          <div className="hero-divider" />
          <div className="social-links">
            <a className="social-link" href="https://t.me/DragonMonadBot"                        target="_blank" rel="noopener noreferrer">💬 Telegram Bot</a>
            <a className="social-link" href="https://x.com/bnbgold277983"                        target="_blank" rel="noopener noreferrer">𝕏 Twitter</a>
            <a className="social-link" href="https://discord.com/channels/1316093079090106472"    target="_blank" rel="noopener noreferrer">🎮 Discord</a>
            <a className="social-link" href={"https://monadvision.com/token/" + TOKEN_ADDRESS}    target="_blank" rel="noopener noreferrer">📊 MonadVision</a>
          </div>
        </section>

        {/* STATS */}
        <div className="stats">
          {[
            { label: "Total Supply", value: fmt(totalSupply) },
            { label: "Your Balance", value: account ? fmt(balance) : "—" },
            { label: "Network",      value: "Monad" },
            { label: "Chain ID",     value: "143" },
          ].map(function(s) {
            return (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* TABS */}
        <div className="tabs">
          {[
            { id: "wallet", label: "🐉 Wallet" },
            { id: "swap",   label: "🔥 Swap"   },
            { id: "mining", label: "⛏️ Mining" },
            { id: "info",   label: "📜 Info"   },
          ].map(function(t) {
            return (
              <button key={t.id} className={"tab-btn" + (tab === t.id ? " active" : "")} onClick={function(){ vibrate(); setTab(t.id); }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* PANEL */}
        <div className="panel">

          {/* WALLET */}
          {tab === "wallet" && (
            <div className="card">
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon"><DragonLogo size={80} /></div>
                  <div className="connect-msg">Connect your wallet to view your {sym} balance and send tokens on Monad Mainnet.</div>
                  <DragonConnectButton title="🔥 Connect Wallet" />
                </div>
              ) : (
                <>
                  <div className="balance-display">
                    <span className="balance-amount">{fmt(balance || 0)}</span>
                    <span className="balance-symbol">{sym}</span>
                    <div className="balance-addr">{shortAddr(account.address)}</div>
                  </div>
                  <div className="card-title">SEND {sym}</div>
                  <div className="field">
                    <label>Recipient Address</label>
                    <input placeholder="0x..." value={transferTo} onChange={function(e){ setTransferTo(e.target.value); }} />
                  </div>
                  <div className="field">
                    <label>Amount</label>
                    <input type="number" placeholder="0.00" value={transferAmt} onChange={function(e){ setTransferAmt(e.target.value); }} />
                  </div>
                  <button className="btn-neon" onClick={handleTransfer} disabled={!transferTo || !transferAmt || txStatus === "pending"}>
                    {txStatus === "pending" ? "⏳ SENDING..." : "🐉 SEND " + sym}
                  </button>
                  {txStatus && (
                    <div className={"status " + txStatus}>
                      {txStatus === "pending" && "⏳ TRANSACTION PENDING..."}
                      {txStatus === "success" && "✅ TRANSFER CONFIRMED"}
                      {txStatus === "error"   && "❌ TRANSACTION FAILED"}
                    </div>
                  )}
                  <BuyWithCard account={account} sym={sym} />
                  <a href={"https://monadscan.com/address/" + account.address} target="_blank" rel="noopener noreferrer">
                    <button className="btn-outline">🔍 VIEW ON MONADSCAN</button>
                  </a>
                  <a href={"https://monadvision.com/token/" + TOKEN_ADDRESS} target="_blank" rel="noopener noreferrer">
                    <button className="btn-outline">📊 VIEW ON MONADVISION</button>
                  </a>
                </>
              )}
            </div>
          )}

          {/* SWAP */}
          {tab === "swap" && (
            <div className="card">
              <div className="card-title">SWAP → {sym}</div>
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon"><DragonLogo size={72} /></div>
                  <div className="connect-msg">Connect your wallet to swap any token for {sym} via NEAR Intents.</div>
                  <DragonConnectButton title="🔥 Connect Wallet" />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.8 }}>
                    Powered by <strong style={{ color: "var(--neon3)" }}>NEAR Intents</strong> — swap ETH, BTC, SOL, USDC and more into {sym}.
                  </div>
                  <div className="field">
                    <label>From Token</label>
                    <select value={swapOrigin} onChange={function(e){ setSwapOrigin(e.target.value); }}>
                      <option value="">Select token...</option>
                      {swapTokens.map(function(t) {
                        return (
                          <option key={t.assetId} value={t.assetId}>
                            {t.symbol} — {t.blockchain ? t.blockchain.toUpperCase() : ""}{t.price ? " ($" + Number(t.price).toFixed(2) + ")" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="field">
                    <label>Amount to Swap</label>
                    <input type="number" placeholder="0.00" value={swapAmount} onChange={function(e){ setSwapAmount(e.target.value); }} />
                  </div>
                  <button className="btn-neon" onClick={handleGetQuote} disabled={!swapOrigin || !swapAmount || swapLoading}>
                    {swapLoading ? "⏳ FETCHING QUOTE..." : "🐉 GET BEST QUOTE"}
                  </button>
                  {swapError && <div className="status error">{swapError}</div>}
                  {swapQuote && !swapError && (
                    <>
                      <div className="quote-box">
                        <div className="quote-row"><span>You Send</span><span>{swapAmount} {swapTokens.find(function(t){ return t.assetId === swapOrigin; })?.symbol}</span></div>
                        <div className="quote-row"><span>You Receive (est.)</span><span>{swapQuote.amountOutFormatted || "—"} {sym}</span></div>
                        <div className="quote-row"><span>Deadline</span><span>{swapQuote.deadline ? new Date(swapQuote.deadline).toLocaleTimeString() : "10 min"}</span></div>
                      </div>
                      {swapQuote.depositAddress && (
                        <div className="deposit-box">
                          <div style={{ color: "var(--neon3)", marginBottom: 6, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>DEPOSIT ADDRESS:</div>
                          {swapQuote.depositAddress}
                          <div style={{ marginTop: 8, color: "var(--text-dim)", fontSize: 12 }}>Send your tokens here. NEAR Intents will complete the swap and deliver {sym} to your wallet.</div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* MINING */}
          {tab === "mining" && (
            <div className="card">
              <div className="card-title">⛏️ LP MINING</div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.8, marginBottom: 20 }}>
                Provide liquidity and earn {sym} rewards through the LP Mining contract.
              </div>
              <div className="info-row"><span className="k">Mining Contract</span><span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Token Contract</span> <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">Network</span>         <span className="v">Monad Mainnet · 143</span></div>
              <div style={{ marginTop: 22 }}>
                <a href={"https://monadscan.com/address/" + LP_MINING} target="_blank" rel="noopener noreferrer">
                  <button className="btn-neon">🐉 VIEW MINING CONTRACT</button>
                </a>
                <a href={"https://monadvision.com/token/" + TOKEN_ADDRESS} target="_blank" rel="noopener noreferrer">
                  <button className="btn-outline">📊 MONADVISION ANALYTICS</button>
                </a>
              </div>
            </div>
          )}

          {/* INFO */}
          {tab === "info" && (
            <div className="card">
              <div className="card-title">📜 CONTRACT INFO</div>
              <div className="info-row"><span className="k">Token Name</span>    <span className="v">{tokenName || "—"}</span></div>
              <div className="info-row"><span className="k">Symbol</span>        <span className="v">{sym}</span></div>
              <div className="info-row"><span className="k">Network</span>       <span className="v">Monad Mainnet</span></div>
              <div className="info-row"><span className="k">Chain ID</span>      <span className="v">143</span></div>
              <div className="info-row"><span className="k">Token Address</span> <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">LP Mining</span>     <span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Total Supply</span>  <span className="v">{fmt(totalSupply)}</span></div>
              <div className="info-row"><span className="k">Standard</span>      <span className="v">ERC-20</span></div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                <a href={"https://monadscan.com/token/" + TOKEN_ADDRESS} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-neon" style={{ fontSize: 10 }}>MONADSCAN</button>
                </a>
                <a href={"https://monadvision.com/token/" + TOKEN_ADDRESS} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-outline" style={{ marginTop: 0, fontSize: 10 }}>MONADVISION</button>
                </a>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM BANNER */}
        <BottomBanner />

      </div>
    </>
  );
}

export default function DragonTokenPage() {
  return (
    <ThirdwebProvider>
      <DragonApp />
    </ThirdwebProvider>
  );
}
