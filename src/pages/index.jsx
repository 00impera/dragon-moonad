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

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CLIENT_ID     = "821819db832d1a313ae3b1a62fbeafb7";
const NEAR_JWT      = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjUtMDEtMTItdjEifQ.eyJ2IjoxLCJrZXlfdHlwZSI6ImRpc3RyaWJ1dGlvbl9jaGFubmVsIiwicGFydG5lcl9pZCI6ImNyeXB0b2Nhc2gtbmZ0IiwiaWF0IjoxNzczMDc3MzExLCJleHAiOjE4MDQ2MTMzMTF9.Wi55S8cwVmAXPtOG0ymr7ldX-5CXVygzuanbjAAJHP-Am14_52C6i4cQG5FvjcAorw0KD8k8JD_YX5AM4QKhNqYtU5gsI4-KKe0KavO5_69NowzUKc_ubtjYn85eFjWskzZQvICMqSZkdGOSnMT_hNEePA8qYi_wSov4a4bQh4zIfNA0znEdDIV3rGI_bDM9dgOk0PnJRIpwi_aXOQ8Q4e50IO2UMrZEDtBVmUhK5-Mno3S_iS7tZl4QSui_4_bNCapQolFwUPB9Zqyxay_6rPVEr7j-8Ez5-htwkR5ZYvTb1mJaj3DVPpWPL9QTxhjvhbJ7nKrWpibcWX3AVoXZ6g";
const TOKEN_ADDRESS = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81";
const LP_MINING     = "0x28840f3e117345A5FBF08b7F67503D2F47B28023";
const COIN_LOGO     = "https://raw.githubusercontent.com/00impera/dragon-moonad/763be2bdd531c914937e161f4cf47826dc098d8e/logo.png";
const MONAD_VISION  = "https://monadvision.com/token/" + TOKEN_ADDRESS;

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

// ── UTILS ────────────────────────────────────────────────────────────────────
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
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([40, 15, 40, 15, 20]);
}

// ── API ──────────────────────────────────────────────────────────────────────
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

// ── SVG FALLBACK DRAGON (gold + green glow palette) ───────────────────────────
function DragonLogo({ size }) {
  var s = size || 48;
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: "50%", flexShrink: 0,
        background: "radial-gradient(circle at 40% 35%, #050A0E, #001a00)",
        border: s > 80 ? "3px solid #39FF14" : "2px solid #39FF14",
        boxShadow: s > 80
          ? "0 0 40px rgba(57,255,20,0.7), 0 0 80px rgba(0,255,0,0.3), 0 0 120px rgba(57,255,20,0.15)"
          : "0 0 16px rgba(57,255,20,0.7), 0 0 32px rgba(0,255,0,0.3)",
      }}>
      <defs>
        <radialGradient id={"dg1"+s} cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFE566"/>
          <stop offset="30%"  stopColor="#FFD700"/>
          <stop offset="65%"  stopColor="#C8960C"/>
          <stop offset="100%" stopColor="#B8860B"/>
        </radialGradient>
        <radialGradient id={"dg2"+s} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00eaff" stopOpacity="0.9"/>
          <stop offset="40%"  stopColor="#a259ff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#ff6ec7" stopOpacity="0.2"/>
        </radialGradient>
        <radialGradient id={"bg"+s} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#050A0E"/>
          <stop offset="60%"  stopColor="#001a00"/>
          <stop offset="100%" stopColor="#003300"/>
        </radialGradient>
        <filter id={"glow"+s}>
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <circle cx="60" cy="60" r="58" fill={"url(#bg"+s+")"}/>

      {/* Dragon body — gold */}
      <ellipse cx="60" cy="74" rx="28" ry="22" fill={"url(#dg1"+s+")"}/>
      <ellipse cx="60" cy="52" rx="14" ry="18" fill={"url(#dg1"+s+")"}/>
      <ellipse cx="60" cy="36" rx="18" ry="15" fill={"url(#dg1"+s+")"}/>
      <ellipse cx="60" cy="45" rx="10" ry="7"  fill="#8B6200" opacity="0.6"/>

      {/* Eyes — iridescent cyan */}
      <ellipse cx="51" cy="31" rx="4.5" ry="5" fill="#00eaff"/>
      <ellipse cx="51" cy="31" rx="2.2" ry="2.8" fill="#050A0E"/>
      <ellipse cx="50.2" cy="30" rx="0.9" ry="0.9" fill="white"/>
      <ellipse cx="69"  cy="31" rx="4.5" ry="5"   fill="#00eaff"/>
      <ellipse cx="69"  cy="31" rx="2.2" ry="2.8"  fill="#050A0E"/>
      <ellipse cx="68.2" cy="30" rx="0.9" ry="0.9" fill="white"/>

      {/* Horns — bright gold */}
      <polygon points="46,23 41,6 51,19"  fill="#FFD700" filter={"url(#glow"+s+")"}/>
      <polygon points="74,23 79,6 69,19"  fill="#FFD700" filter={"url(#glow"+s+")"}/>

      {/* Wings — deep gold */}
      <path d="M32,60 Q8,38 12,72 Q22,66 32,74 Z"   fill="#C8960C" opacity="0.9"/>
      <path d="M88,60 Q112,38 108,72 Q98,66 88,74 Z" fill="#C8960C" opacity="0.9"/>

      {/* Iridescent shimmer belly */}
      <path d="M54,56 Q50,64 46,72 Q53,66 57,73 Q60,64 63,73 Q67,66 74,72 Q70,64 66,56 Z"
        fill={"url(#dg2"+s+")"} opacity="0.85"/>

      {/* Neon green outer ring */}
      <circle cx="60" cy="60" r="57" stroke="#39FF14" strokeWidth="1.5" fill="none" opacity="0.5" filter={"url(#glow"+s+")"}/>
      <circle cx="60" cy="60" r="55" stroke="#39FF14" strokeWidth="0.5" fill="none" opacity="0.25"/>

      {/* Purple inner accent ring */}
      <circle cx="60" cy="60" r="42" stroke="#a259ff" strokeWidth="0.8" fill="none" opacity="0.4"/>

      {/* Pink dot accents */}
      {s >= 60 && (
        <>
          <circle cx="34" cy="34" r={s*0.025} fill="#ff6ec7" opacity="0.7"/>
          <circle cx="86" cy="34" r={s*0.025} fill="#00eaff" opacity="0.7"/>
        </>
      )}
    </svg>
  );
}

// ── LOGO WITH FALLBACK ────────────────────────────────────────────────────────
function LogoImage({ size }) {
  const [broken, setBroken] = useState(false);
  var s = size || 48;
  if (broken) return <DragonLogo size={s}/>;
  return (
    <img src={COIN_LOGO} alt="Dragon" width={s} height={s}
      style={{
        borderRadius: "50%", flexShrink: 0, display: "block", objectFit: "cover",
        border: s > 80 ? "3px solid #39FF14" : "2px solid #39FF14",
        boxShadow: s > 80
          ? "0 0 40px rgba(57,255,20,0.7), 0 0 80px rgba(0,255,0,0.3), 0 0 120px rgba(57,255,20,0.15)"
          : "0 0 16px rgba(57,255,20,0.7), 0 0 32px rgba(0,255,0,0.3)",
      }}
      onError={function(){ setBroken(true); }}
    />
  );
}

// ── PARTICLES (gold + green) ──────────────────────────────────────────────────
function DragonParticles() {
  var items = [];
  for (var i = 0; i < 35; i++) {
    items.push(
      <div key={i} className={"dp dp"+(i%5)} style={{
        left: ((i*31+3)%100)+"%",
        animationDelay:    ((i*0.35)%9)+"s",
        animationDuration: (5+(i*0.28)%7)+"s",
      }}/>
    );
  }
  return <div className="dragon-particles">{items}</div>;
}

// ── BUY WITH CARD ─────────────────────────────────────────────────────────────
function BuyWithCard({ account, sym }) {
  const [show, setShow] = useState(false);
  if (!account) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {!show
        ? <button className="btn-gold" onClick={function(){ vibrate(); setShow(true); }}>💳 BUY {sym} WITH CARD</button>
        : <>
            <button className="btn-outline" style={{ marginBottom: 12, fontSize: 10 }} onClick={function(){ setShow(false); }}>✕ CLOSE</button>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(57,255,20,0.4)" }}>
              <BuyWidget client={client} chain={MONAD_MAINNET} tokenAddress={TOKEN_ADDRESS} theme="dark"/>
            </div>
          </>
      }
    </div>
  );
}

// ── CONNECT BUTTON ────────────────────────────────────────────────────────────
function DragonConnectButton({ title }) {
  return (
    <ConnectButton client={client} chain={MONAD_MAINNET} wallets={WALLETS} showAllWallets={true} theme="dark"
      btnTitle={title || "🔥 Connect"}
      connectModal={{
        title: "🐉 Connect Your Wallet", titleIcon: "",
        welcomeScreen: { title: "Dragon Monad", subtitle: "Connect your wallet to Monad Mainnet and access DRAGON tokens" },
        showThirdwebBranding: false,
      }}
    />
  );
}

// ── BOTTOM BANNER ─────────────────────────────────────────────────────────────
function BottomBanner() {
  const [copied, setCopied] = useState(false);

  function copyAddr() {
    navigator.clipboard.writeText(TOKEN_ADDRESS).then(function(){
      setCopied(true);
      setTimeout(function(){ setCopied(false); }, 2000);
    });
  }

  const socialLinks = [
    {
      href:  "https://t.me/DragonMonadBot",
      icon:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21.8 2.15L1.5 9.9c-1.3.5-1.3 1.2-.2 1.5l5.2 1.6 12-7.6c.6-.4 1.1-.2.7.2L8.3 15.5v3.7c0 .8.4 1 .9.5l2.5-2.4 5.1 3.8c.9.5 1.6.2 1.8-.9L22.8 3.4c.3-1.3-.5-1.9-1-1.25z" fill="#39FF14"/></svg>,
      label: "TELEGRAM",
      sub:   "DragonMonadBot",
      color: "#39FF14",
    },
    {
      href:  "https://x.com/bnbgold277983",
      icon:  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a259ff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      label: "TWITTER",
      sub:   "@bnbgold277983",
      color: "#a259ff",
    },
    {
      href:  "https://discord.com/channels/1316093079090106472",
      icon:  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff6ec7"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.055a19.99 19.99 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.201 13.201 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>,
      label: "DISCORD",
      sub:   "Join Community",
      color: "#ff6ec7",
    },
    {
      href:  MONAD_VISION,
      icon:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M2 12C2 12 6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12z" stroke="#FFD700" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" fill="#FFD700" opacity="0.7"/></svg>,
      label: "ANALYTICS",
      sub:   "MonadVision",
      color: "#FFD700",
    },
  ];

  return (
    <div style={{ position: "relative", zIndex: 5, padding: "0 16px 28px" }}>

      {/* Animated top bar */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg,#39FF14,#FFD700,#00eaff,#a259ff,#ff6ec7,#FFD700,#39FF14)",
        backgroundSize: "200% 100%",
        animation: "bbScroll 4s linear infinite",
        borderRadius: "2px 2px 0 0",
      }}/>

      <div style={{
        border: "1px solid rgba(57,255,20,0.28)", borderTop: "none",
        borderRadius: "0 0 16px 16px", overflow: "hidden",
        background: "linear-gradient(160deg,#050A0E 0%,#000d00 60%,#001a00 100%)",
        boxShadow: "0 0 48px rgba(57,255,20,0.1), 0 0 80px rgba(0,255,0,0.05)",
      }}>

        {/* Donate banner */}
        <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 16, padding: "16px 20px", textDecoration: "none", flexWrap: "wrap",
            background: "linear-gradient(90deg,rgba(57,255,20,0.06) 0%,rgba(200,150,12,0.09) 50%,rgba(162,89,255,0.06) 100%)",
            borderBottom: "1px solid rgba(57,255,20,0.15)",
            cursor: "pointer", transition: "background 0.2s",
          }}
          onMouseOver={function(e){ e.currentTarget.style.background="linear-gradient(90deg,rgba(57,255,20,0.14) 0%,rgba(200,150,12,0.18) 50%,rgba(162,89,255,0.14) 100%)"; }}
          onMouseOut= {function(e){ e.currentTarget.style.background="linear-gradient(90deg,rgba(57,255,20,0.06) 0%,rgba(200,150,12,0.09) 50%,rgba(162,89,255,0.06) 100%)"; }}
        >
          {/* Logo with pulse ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img src={COIN_LOGO} alt="DRAGON"
              style={{
                width: 52, height: 52, borderRadius: "50%", objectFit: "cover", display: "block",
                border: "2px solid #39FF14",
                boxShadow: "0 0 18px rgba(57,255,20,0.7), 0 0 36px rgba(57,255,20,0.3)",
              }}
              onError={function(e){ e.target.style.display="none"; }}
            />
            <div style={{
              position: "absolute", inset: -4, borderRadius: "50%",
              border: "1px solid rgba(57,255,20,0.5)",
              animation: "pingRing 2s ease-out infinite",
            }}/>
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 900, letterSpacing: 3,
              background: "linear-gradient(90deg,#39FF14,#FFD700,#a259ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              ❤ SUPPORT · DRAGON MONAD
            </div>
            <div style={{ fontSize: 10, color: "rgba(200,255,150,0.45)", letterSpacing: 2, fontFamily: "'Cinzel',serif" }}>
              DONATE TO KEEP THE DRAGON ALIVE · CLICK TO VIEW ON MONADVISION
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(57,255,20,0.55)", letterSpacing: 1, marginTop: 1 }}>
              {TOKEN_ADDRESS.slice(0,12)}…{TOKEN_ADDRESS.slice(-10)}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 18px", borderRadius: 20, flexShrink: 0,
            border: "1px solid rgba(57,255,20,0.5)",
            background: "linear-gradient(135deg,rgba(57,255,20,0.15),rgba(200,150,12,0.1))",
            fontFamily: "'Cinzel',serif", fontSize: 10, color: "#39FF14",
            letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap",
            boxShadow: "0 0 20px rgba(57,255,20,0.2)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 21C12 21 3 14.5 3 8.5A5.5 5.5 0 0 1 12 5.1 5.5 5.5 0 0 1 21 8.5C21 14.5 12 21 12 21Z"
                fill="url(#hg2)" stroke="#39FF14" strokeWidth="1.2"/>
              <defs>
                <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#39FF14"/><stop offset="100%" stopColor="#FFD700"/>
                </linearGradient>
              </defs>
            </svg>
            DONATE
          </div>
        </a>

        {/* Copy address bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "10px 20px",
          borderBottom: "1px solid rgba(57,255,20,0.1)",
          background: "rgba(57,255,20,0.03)",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(57,255,20,0.5)", letterSpacing: 1 }}>
            CONTRACT: {TOKEN_ADDRESS}
          </span>
          <button onClick={copyAddr} style={{
            padding: "3px 12px", borderRadius: 6, cursor: "pointer",
            border: "1px solid rgba(57,255,20,0.35)",
            background: copied ? "rgba(57,255,20,0.2)" : "rgba(57,255,20,0.06)",
            color: copied ? "#39FF14" : "rgba(57,255,20,0.6)",
            fontFamily: "'Cinzel',serif", fontSize: 8, letterSpacing: 2, transition: "all 0.2s",
          }}>
            {copied ? "✓ COPIED" : "COPY"}
          </button>
        </div>

        {/* Social links */}
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", flexWrap: "wrap" }}>
          {socialLinks.map(function(l, i) {
            return (
              <a key={i} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "18px 22px", textDecoration: "none",
                  flex: 1, minWidth: 110,
                  borderRight: i < socialLinks.length-1 ? "1px solid rgba(57,255,20,0.08)" : "none",
                  transition: "background 0.2s",
                }}
                onMouseOver={function(e){ e.currentTarget.style.background="rgba(57,255,20,0.06)"; }}
                onMouseOut= {function(e){ e.currentTarget.style.background="transparent"; }}
              >
                <span style={{ lineHeight: 1 }}>{l.icon}</span>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: l.color }}>
                  {l.label}
                </span>
                <span style={{ fontSize: 8, color: "rgba(200,255,150,0.25)", letterSpacing: 1, fontFamily: "'Rajdhani',sans-serif" }}>
                  {l.sub}
                </span>
              </a>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", padding: "10px 20px 14px",
          fontSize: 8, color: "rgba(57,255,20,0.2)", letterSpacing: 4,
          fontFamily: "'Cinzel',serif",
          borderTop: "1px solid rgba(57,255,20,0.07)",
        }}>
          🐉 DRAGON TOKEN · MONAD MAINNET · CHAIN 143 · © 2026
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
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
    vibrate(); setTxStatus("pending");
    var tx = prepareContractCall({ contract, method: "transfer", params: [transferTo, toWei(transferAmt)] });
    sendTx(tx, {
      onSuccess: function(){ setTxStatus("success"); },
      onError:   function(){ setTxStatus("error");   },
    });
  }

  async function handleGetQuote() {
    if (!swapOrigin || !swapAmount || !account) return;
    vibrate(); setSwapLoading(true); setSwapError(null); setSwapQuote(null);
    try {
      var destAsset   = "nep141:monad-" + TOKEN_ADDRESS.toLowerCase() + ".omft.near";
      var originToken = swapTokens.find(function(t){ return t.assetId === swapOrigin; });
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
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }

        :root {
          --neon:        #39FF14;
          --neon2:       #00FF00;
          --neon3:       #6FFF45;
          --gold:        #FFD700;
          --gold-deep:   #C8960C;
          --gold-dark:   #B8860B;
          --gold-light:  #FFE566;
          --purple:      #a259ff;
          --cyan:        #00eaff;
          --pink:        #ff6ec7;
          --black:       #050A0E;
          --dark-green:  #001a00;
          --deep-green:  #003300;
          --border:      rgba(57,255,20,0.28);
          --border2:     rgba(57,255,20,0.55);
          --text:        #e8ffe0;
          --text-dim:    rgba(200,255,150,0.55);
          --text-faint:  rgba(200,255,150,0.28);
          --grad-main:   linear-gradient(135deg,#39FF14 0%,#FFD700 40%,#00eaff 70%,#a259ff 100%);
          --grad-gold:   linear-gradient(135deg,#FFE566,#FFD700,#C8960C,#B8860B);
          --glow-neon:   0 0 20px rgba(57,255,20,0.6), 0 0 40px rgba(0,255,0,0.3);
          --glow-gold:   0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(200,150,12,0.3);
        }

        body { background:var(--black); color:var(--text); font-family:'Rajdhani',sans-serif; }

        .app {
          min-height:100vh;
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%,  rgba(0,40,0,0.7)   0%,transparent 65%),
            radial-gradient(ellipse 45% 35% at 10% 80%, rgba(0,80,0,0.3)   0%,transparent 55%),
            radial-gradient(ellipse 45% 35% at 90% 80%, rgba(57,255,20,0.08) 0%,transparent 55%),
            var(--black);
          position:relative; overflow-x:hidden;
        }
        .app::before {
          content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(57,255,20,0.018) 3px,rgba(57,255,20,0.018) 4px);
        }

        /* PARTICLES */
        .dragon-particles { position:fixed; inset:0; pointer-events:none; z-index:1; }
        .dp  { position:absolute; bottom:-20px; border-radius:50%; animation:dpRise linear infinite; }
        .dp0 { width:5px;  height:12px; border-radius:50% 50% 50% 50%/60% 60% 40% 40%; background:radial-gradient(#39FF14,transparent); opacity:0.6; }
        .dp1 { width:3px;  height:8px;  border-radius:50%; background:radial-gradient(#FFD700,transparent); opacity:0.45; }
        .dp2 { width:6px;  height:6px;  border-radius:50%; background:radial-gradient(#00eaff,transparent); opacity:0.25; }
        .dp3 { width:2px;  height:10px; border-radius:50%; background:radial-gradient(#a259ff,transparent); opacity:0.3; }
        .dp4 { width:4px;  height:7px;  border-radius:50%; background:radial-gradient(#ff6ec7,transparent); opacity:0.2; }
        @keyframes dpRise {
          0%   { transform:translateY(0) scaleX(1);        opacity:0; }
          8%   { opacity:1; }
          85%  { opacity:0.2; }
          100% { transform:translateY(-100vh) scaleX(0.6); opacity:0; }
        }
        @keyframes bbScroll { 0% { background-position:0% 0%; } 100% { background-position:200% 0%; } }
        @keyframes pingRing { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.6); opacity:0; } }

        /* HEADER */
        .header {
          position:relative; z-index:10;
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 40px;
          border-bottom:1px solid var(--border);
          background:rgba(2,6,2,0.95);
          backdrop-filter:blur(20px);
          box-shadow:0 1px 0 rgba(57,255,20,0.15),0 4px 32px rgba(0,0,0,0.9);
        }
        .logo { display:flex; align-items:center; gap:14px; }
        .logo-text {
          font-family:'Cinzel',serif; font-size:22px; font-weight:900;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          letter-spacing:4px; filter:drop-shadow(0 0 10px rgba(57,255,20,0.6));
        }
        .logo-sub { font-size:9px; color:var(--text-faint); letter-spacing:4px; text-transform:uppercase; margin-top:3px; font-family:'Cinzel',serif; }
        .chain-badge {
          display:inline-flex; align-items:center; gap:7px; padding:5px 16px; border-radius:20px;
          background:rgba(57,255,20,0.08); border:1px solid var(--border);
          font-size:10px; color:var(--neon); letter-spacing:2px; font-family:'Cinzel',serif;
          box-shadow:0 0 12px rgba(57,255,20,0.12);
        }
        .neon-dot { width:6px; height:6px; border-radius:50%; background:var(--neon); box-shadow:0 0 8px var(--neon); display:inline-block; animation:dotPulse 2s infinite alternate; }
        @keyframes dotPulse { 0% { opacity:1; box-shadow:0 0 8px var(--neon); } 100% { opacity:0.3; box-shadow:none; } }

        /* HERO */
        .hero { position:relative; z-index:5; text-align:center; padding:56px 20px 32px; }
        .hero-logo { display:flex; justify-content:center; margin-bottom:24px; }
        .hero-logo > * { animation:dragonFloat 5s ease-in-out infinite; }
        @keyframes dragonFloat {
          0%,100% { transform:translateY(0) rotate(-1deg);   filter:drop-shadow(0 0 22px rgba(57,255,20,0.7)) drop-shadow(0 0 8px rgba(255,215,0,0.4)); }
          50%      { transform:translateY(-14px) rotate(1deg); filter:drop-shadow(0 0 38px rgba(57,255,20,0.95)) drop-shadow(0 0 16px rgba(255,215,0,0.6)); }
        }
        .hero-title {
          font-family:'Cinzel',serif; font-size:clamp(36px,8vw,72px); font-weight:900; letter-spacing:10px;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          animation:titleGlow 3s ease-in-out infinite alternate;
        }
        @keyframes titleGlow {
          0%   { filter:drop-shadow(0 0 20px rgba(57,255,20,0.5)); }
          100% { filter:drop-shadow(0 0 35px rgba(255,215,0,0.6)); }
        }
        .hero-sub { margin-top:10px; font-size:12px; letter-spacing:5px; text-transform:uppercase; color:var(--text-dim); font-family:'Cinzel',serif; }
        .hero-divider {
          margin:28px auto; width:220px; height:1px;
          background:linear-gradient(90deg,transparent,#39FF14,#FFD700,#00eaff,transparent);
          box-shadow:0 0 14px rgba(57,255,20,0.5), 0 0 28px rgba(255,215,0,0.3);
        }

        /* SOCIAL LINKS */
        .social-links { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:4px; }
        .social-link {
          display:inline-flex; align-items:center; gap:7px; padding:8px 18px; border-radius:20px;
          background:rgba(57,255,20,0.06); border:1px solid var(--border);
          color:var(--text-dim); text-decoration:none; font-size:12px;
          font-family:'Cinzel',serif; letter-spacing:1px; transition:all .2s;
        }
        .social-link:hover { background:rgba(57,255,20,0.14); border-color:var(--neon); color:var(--neon); box-shadow:var(--glow-neon); }

        /* STATS */
        .stats { position:relative; z-index:5; display:flex; justify-content:center; flex-wrap:wrap; gap:12px; padding:0 40px 36px; }
        .stat-card {
          background:linear-gradient(135deg,rgba(0,20,0,0.9),rgba(5,10,14,0.95));
          border:1px solid var(--border); border-radius:12px; padding:18px 28px; min-width:160px; text-align:center;
          transition:all .3s; position:relative; overflow:hidden;
        }
        .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#39FF14,#FFD700,transparent); }
        .stat-card:hover { border-color:var(--neon); box-shadow:var(--glow-neon); transform:translateY(-3px); }
        .stat-label { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--text-faint); font-family:'Cinzel',serif; }
        .stat-value {
          font-family:'Cinzel',serif; font-size:18px; font-weight:700; margin-top:6px;
          background:linear-gradient(135deg,#39FF14,#FFD700);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }

        /* TABS */
        .tabs { position:relative; z-index:5; display:flex; justify-content:center; gap:6px; padding:0 20px 24px; flex-wrap:wrap; }
        .tab-btn {
          padding:10px 28px; border-radius:6px; border:1px solid var(--border);
          background:transparent; color:var(--text-dim);
          font-family:'Cinzel',serif; font-size:10px; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .2s;
          -webkit-tap-highlight-color:transparent;
        }
        .tab-btn.active {
          background:rgba(57,255,20,0.1); color:var(--neon3); border-color:var(--neon);
          box-shadow:0 0 16px rgba(57,255,20,0.25),inset 0 0 12px rgba(57,255,20,0.06);
        }
        .tab-btn:not(.active):hover { border-color:rgba(57,255,20,0.5); color:var(--text); background:rgba(57,255,20,0.05); }

        /* PANEL */
        .panel { position:relative; z-index:5; max-width:560px; margin:0 auto; padding:0 20px 40px; }
        .card {
          background:linear-gradient(135deg,rgba(0,10,2,0.97),rgba(5,10,14,0.99));
          border:1px solid var(--border); border-radius:16px; padding:30px;
          box-shadow:0 8px 48px rgba(0,0,0,0.8),inset 0 1px 0 rgba(57,255,20,0.1);
          animation:fadeUp .35s ease; position:relative; overflow:hidden;
        }
        .card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#39FF14,#FFD700,#00eaff,transparent); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }

        .card-title {
          font-family:'Cinzel',serif; font-size:11px; font-weight:700;
          background:linear-gradient(135deg,#39FF14,#FFD700);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          margin-bottom:22px; display:flex; align-items:center; gap:10px; letter-spacing:3px;
        }
        .card-title::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(57,255,20,0.5),transparent); }

        /* BALANCE */
        .balance-display {
          text-align:center; padding:32px 20px;
          background:radial-gradient(ellipse at center,rgba(57,255,20,0.07) 0%,transparent 70%);
          border-radius:12px; border:1px solid rgba(57,255,20,0.2); margin-bottom:24px;
        }
        .balance-amount {
          font-family:'Cinzel',serif; font-size:42px; font-weight:900;
          background:linear-gradient(135deg,#39FF14,#FFD700,#00eaff);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .balance-symbol { font-size:18px; color:var(--neon); margin-left:8px; font-family:'Cinzel',serif; }
        .balance-addr   { font-size:11px; color:var(--text-faint); margin-top:8px; font-family:monospace; }

        /* FIELDS */
        .field { margin-bottom:14px; }
        .field label { display:block; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--text-faint); margin-bottom:6px; font-family:'Cinzel',serif; }
        .field input,.field select {
          width:100%; padding:11px 14px; border-radius:8px;
          background:rgba(0,8,0,0.9); border:1px solid var(--border);
          color:var(--text); font-family:'Rajdhani',sans-serif; font-size:15px;
          outline:none; transition:border-color .2s,box-shadow .2s;
        }
        .field input:focus,.field select:focus { border-color:var(--neon); box-shadow:0 0 0 2px rgba(57,255,20,0.12); }
        .field select option { background:#000d00; color:var(--text); }

        /* BUTTONS */
        @keyframes neonPulse { 0%,100%{ box-shadow:0 0 20px rgba(57,255,20,0.4); } 50%{ box-shadow:0 0 35px rgba(57,255,20,0.7),0 0 60px rgba(0,255,0,0.3); } }
        .btn-neon {
          width:100%; padding:14px; border-radius:8px;
          border:1px solid rgba(57,255,20,0.5); cursor:pointer;
          background:linear-gradient(135deg,rgba(57,255,20,0.15),rgba(0,255,0,0.1),rgba(57,255,20,0.12));
          color:var(--neon3); font-family:'Cinzel',serif; font-size:11px; font-weight:700;
          letter-spacing:3px; text-transform:uppercase;
          animation:neonPulse 3s ease infinite;
          transition:transform .15s; -webkit-tap-highlight-color:transparent;
        }
        .btn-neon:hover:not(:disabled) { box-shadow:0 0 35px rgba(57,255,20,0.7),0 0 60px rgba(0,255,0,0.3); transform:scale(1.02); color:#fff; }
        .btn-neon:active:not(:disabled) { transform:scale(0.97); }
        .btn-neon:disabled { opacity:0.3; cursor:not-allowed; animation:none; }

        .btn-gold {
          width:100%; padding:14px; border-radius:8px;
          border:1px solid rgba(255,215,0,0.5); cursor:pointer;
          background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(200,150,12,0.12));
          color:var(--gold); font-family:'Cinzel',serif; font-size:11px; font-weight:700;
          letter-spacing:3px; text-transform:uppercase;
          box-shadow:var(--glow-gold);
          transition:all .2s; -webkit-tap-highlight-color:transparent;
        }
        .btn-gold:hover:not(:disabled) { box-shadow:0 0 35px rgba(255,215,0,0.7),0 0 60px rgba(200,150,12,0.4); transform:scale(1.02); color:#fff; }
        .btn-gold:active:not(:disabled) { transform:scale(0.97); }
        .btn-gold:disabled { opacity:0.3; cursor:not-allowed; }

        .btn-outline {
          width:100%; padding:11px; border-radius:8px; margin-top:10px;
          border:1px solid rgba(57,255,20,0.3); background:transparent; color:var(--text-dim);
          font-family:'Cinzel',serif; font-size:10px; cursor:pointer; transition:all .2s; letter-spacing:2px;
          -webkit-tap-highlight-color:transparent;
        }
        .btn-outline:hover { border-color:var(--neon); color:var(--neon3); background:rgba(57,255,20,0.06); }

        /* STATUS */
        .status { margin-top:12px; padding:11px 14px; border-radius:8px; font-size:11px; font-weight:700; text-align:center; font-family:'Cinzel',serif; letter-spacing:2px; }
        .status.pending { background:rgba(255,215,0,.08);  color:var(--gold);  border:1px solid rgba(255,215,0,.3); }
        .status.success { background:rgba(57,255,20,.08);  color:var(--neon3); border:1px solid rgba(57,255,20,.3); }
        .status.error   { background:rgba(200,0,0,.08);    color:#ff5050;      border:1px solid rgba(200,0,0,.3); }

        /* QUOTE */
        .quote-box { margin-top:14px; padding:14px; border-radius:10px; background:rgba(57,255,20,0.04); border:1px solid var(--border); }
        .quote-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid rgba(57,255,20,0.08); font-size:13px; }
        .quote-row:last-child { border-bottom:none; }
        .quote-row span:first-child { color:var(--text-dim); }
        .quote-row span:last-child  { color:var(--neon3); font-weight:700; font-family:'Cinzel',serif; font-size:11px; }
        .deposit-box { margin-top:14px; padding:14px; border-radius:8px; background:rgba(57,255,20,0.05); border:1px solid rgba(57,255,20,0.3); word-break:break-all; font-size:11px; color:var(--neon3); font-family:monospace; line-height:1.7; }

        /* INFO ROWS */
        .info-row { display:flex; justify-content:space-between; padding:11px 0; border-bottom:1px solid rgba(57,255,20,0.08); font-size:13px; }
        .info-row:last-child { border-bottom:none; }
        .info-row .k { color:var(--text-faint); font-family:'Cinzel',serif; font-size:9px; letter-spacing:2px; text-transform:uppercase; }
        .info-row .v { color:var(--neon3); font-weight:600; font-family:monospace; word-break:break-all; text-align:right; max-width:62%; }

        /* CONNECT PROMPT */
        .connect-prompt { text-align:center; padding:40px 20px; }
        .connect-icon   { display:flex; justify-content:center; margin-bottom:20px; }
        .connect-msg    { color:var(--text-dim); font-size:15px; margin-bottom:28px; line-height:1.8; }

        @media (max-width:600px) {
          .header { padding:14px 16px; }
          .stats  { padding:0 12px 28px; }
          .hero   { padding:36px 16px 20px; }
          .chain-badge { display:none; }
        }
      `}</style>

      <div className="app">
        <DragonParticles/>

        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <LogoImage size={48}/>
            <div>
              <div className="logo-text">{tokenName || "DRAGON"}</div>
              <div className="logo-sub">Monad Network · Gold & Neon</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="chain-badge"><span className="neon-dot"/> Monad · 143</div>
            <DragonConnectButton title="🔥 Connect"/>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-logo"><LogoImage size={130}/></div>
          <div className="hero-title">{sym}</div>
          <div className="hero-sub">🐉 Dragon of the Monad Chain · Gold Neon Power</div>
          <div className="hero-divider"/>
          <div className="social-links">
            <a className="social-link" href="https://t.me/DragonMonadBot"                     target="_blank" rel="noopener noreferrer">💬 Telegram</a>
            <a className="social-link" href="https://x.com/bnbgold277983"                     target="_blank" rel="noopener noreferrer">𝕏 Twitter</a>
            <a className="social-link" href="https://discord.com/channels/1316093079090106472" target="_blank" rel="noopener noreferrer">🎮 Discord</a>
            <a className="social-link" href={MONAD_VISION}                                    target="_blank" rel="noopener noreferrer">📊 MonadVision</a>
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
              <button key={t.id} className={"tab-btn"+(tab===t.id?" active":"")} onClick={function(){ vibrate(); setTab(t.id); }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* PANEL */}
        <div className="panel">

          {/* WALLET */}
          {tab==="wallet" && (
            <div className="card">
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon"><DragonLogo size={80}/></div>
                  <div className="connect-msg">Connect your wallet to view your {sym} balance and send tokens on Monad Mainnet.</div>
                  <DragonConnectButton title="🔥 Connect Wallet"/>
                </div>
              ) : (
                <>
                  <div className="balance-display">
                    <span className="balance-amount">{fmt(balance||0)}</span>
                    <span className="balance-symbol">{sym}</span>
                    <div className="balance-addr">{shortAddr(account.address)}</div>
                  </div>
                  <div className="card-title">SEND {sym}</div>
                  <div className="field"><label>Recipient Address</label><input placeholder="0x..." value={transferTo} onChange={function(e){ setTransferTo(e.target.value); }}/></div>
                  <div className="field"><label>Amount</label><input type="number" placeholder="0.00" value={transferAmt} onChange={function(e){ setTransferAmt(e.target.value); }}/></div>
                  <button className="btn-neon" onClick={handleTransfer} disabled={!transferTo||!transferAmt||txStatus==="pending"}>
                    {txStatus==="pending" ? "⏳ SENDING..." : "🐉 SEND "+sym}
                  </button>
                  {txStatus && (
                    <div className={"status "+txStatus}>
                      {txStatus==="pending" && "⏳ TRANSACTION PENDING..."}
                      {txStatus==="success" && "✅ TRANSFER CONFIRMED"}
                      {txStatus==="error"   && "❌ TRANSACTION FAILED"}
                    </div>
                  )}
                  <BuyWithCard account={account} sym={sym}/>
                  <a href={"https://monadscan.com/address/"+account.address} target="_blank" rel="noopener noreferrer">
                    <button className="btn-outline">🔍 VIEW ON MONADSCAN</button>
                  </a>
                  <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer">
                    <button className="btn-outline">📊 VIEW ON MONADVISION</button>
                  </a>
                </>
              )}
            </div>
          )}

          {/* SWAP */}
          {tab==="swap" && (
            <div className="card">
              <div className="card-title">SWAP → {sym}</div>
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon"><DragonLogo size={72}/></div>
                  <div className="connect-msg">Connect your wallet to swap any token for {sym} via NEAR Intents.</div>
                  <DragonConnectButton title="🔥 Connect Wallet"/>
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
                      {swapTokens.map(function(t){
                        return (
                          <option key={t.assetId} value={t.assetId}>
                            {t.symbol} — {t.blockchain?t.blockchain.toUpperCase():""}{t.price?" ($"+Number(t.price).toFixed(2)+")":""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="field"><label>Amount to Swap</label><input type="number" placeholder="0.00" value={swapAmount} onChange={function(e){ setSwapAmount(e.target.value); }}/></div>
                  <button className="btn-neon" onClick={handleGetQuote} disabled={!swapOrigin||!swapAmount||swapLoading}>
                    {swapLoading ? "⏳ FETCHING QUOTE..." : "🐉 GET BEST QUOTE"}
                  </button>
                  {swapError && <div className="status error">{swapError}</div>}
                  {swapQuote && !swapError && (
                    <>
                      <div className="quote-box">
                        <div className="quote-row"><span>You Send</span><span>{swapAmount} {swapTokens.find(function(t){ return t.assetId===swapOrigin; })?.symbol}</span></div>
                        <div className="quote-row"><span>You Receive (est.)</span><span>{swapQuote.amountOutFormatted||"—"} {sym}</span></div>
                        <div className="quote-row"><span>Deadline</span><span>{swapQuote.deadline?new Date(swapQuote.deadline).toLocaleTimeString():"10 min"}</span></div>
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
          {tab==="mining" && (
            <div className="card">
              <div className="card-title">⛏️ LP MINING</div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.8, marginBottom: 20 }}>
                Provide liquidity and earn {sym} rewards through the LP Mining contract.
              </div>
              <div className="info-row"><span className="k">Mining Contract</span><span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Token Contract</span> <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">Network</span>         <span className="v">Monad Mainnet · 143</span></div>
              <div style={{ marginTop: 22 }}>
                <a href={"https://monadscan.com/address/"+LP_MINING} target="_blank" rel="noopener noreferrer">
                  <button className="btn-neon">🐉 VIEW MINING CONTRACT</button>
                </a>
                <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer">
                  <button className="btn-outline">📊 MONADVISION ANALYTICS</button>
                </a>
              </div>
            </div>
          )}

          {/* INFO */}
          {tab==="info" && (
            <div className="card">
              <div className="card-title">📜 CONTRACT INFO</div>
              <div className="info-row"><span className="k">Token Name</span>    <span className="v">{tokenName||"—"}</span></div>
              <div className="info-row"><span className="k">Symbol</span>        <span className="v">{sym}</span></div>
              <div className="info-row"><span className="k">Network</span>       <span className="v">Monad Mainnet</span></div>
              <div className="info-row"><span className="k">Chain ID</span>      <span className="v">143</span></div>
              <div className="info-row"><span className="k">Token Address</span> <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">LP Mining</span>     <span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Total Supply</span>  <span className="v">{fmt(totalSupply)}</span></div>
              <div className="info-row"><span className="k">Standard</span>      <span className="v">ERC-20</span></div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                <a href={"https://monadscan.com/token/"+TOKEN_ADDRESS} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-neon" style={{ fontSize: 10 }}>MONADSCAN</button>
                </a>
                <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-outline" style={{ marginTop: 0, fontSize: 10 }}>MONADVISION</button>
                </a>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM BANNER */}
        <BottomBanner/>

      </div>
    </>
  );
}

export default function DragonTokenPage() {
  return <ThirdwebProvider><DragonApp/></ThirdwebProvider>;
}
