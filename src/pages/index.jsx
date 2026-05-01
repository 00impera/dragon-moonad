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
const COIN_LOGO     = "https://raw.githubusercontent.com/00impera/dragon-moonad/1b69991aab99757ff35360042dba5e83c1bbe713/1%2Cpng.png";
const VIBRANT_LOGO  = "https://raw.githubusercontent.com/00impera/dragon-moonad/b7e094df45b3a33ef5b310e925e1afd04ab8a5a6/3.png.png";
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

// ── LOGO IMAGE WITH FALLBACK ──────────────────────────────────────────────────
function LogoImage({ size, src }) {
  const [broken, setBroken] = useState(false);
  var s = size || 48;
  var url = src || COIN_LOGO;
  if (broken) {
    return (
      <div style={{
        width: s, height: s, borderRadius: "50%", flexShrink: 0,
        background: "radial-gradient(circle at 40% 35%, #050A0E, #001a00)",
        border: s > 80 ? "3px solid #FFD700" : "2px solid #FFD700",
        boxShadow: s > 80
          ? "0 0 40px rgba(255,215,0,0.7), 0 0 80px rgba(57,255,20,0.3)"
          : "0 0 16px rgba(255,215,0,0.6), 0 0 32px rgba(57,255,20,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: s > 80 ? 48 : 24,
      }}>
        🐲
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="Dragon"
      width={s}
      height={s}
      style={{
        borderRadius: "50%",
        flexShrink: 0,
        display: "block",
        objectFit: "cover",
        border: s > 80 ? "3px solid #FFD700" : "2px solid #FFD700",
        boxShadow: s > 80
          ? "0 0 40px rgba(255,215,0,0.7), 0 0 80px rgba(57,255,20,0.3), 0 0 120px rgba(162,89,255,0.2)"
          : "0 0 16px rgba(255,215,0,0.6), 0 0 32px rgba(57,255,20,0.2)",
      }}
      onError={function() { setBroken(true); }}
    />
  );
}

// ── VIBRANT CONNECT LOGO ──────────────────────────────────────────────────────
function VibrantConnectLogo({ size }) {
  var s = size || 120;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <LogoImage size={s} src={VIBRANT_LOGO} />
      <div style={{
        position: "absolute",
        inset: -8,
        borderRadius: "50%",
        border: "2px solid rgba(255,215,0,0.6)",
        animation: "pingRing 2s ease-out infinite",
        pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute",
        inset: -16,
        borderRadius: "50%",
        border: "1px solid rgba(57,255,20,0.3)",
        animation: "pingRing 2s ease-out infinite 0.5s",
        pointerEvents: "none",
      }}/>
    </div>
  );
}

// ── PARTICLES (gold + green) ──────────────────────────────────────────────────
function DragonParticles() {
  var items = [];
  for (var i = 0; i < 35; i++) {
    items.push(
      <div key={i} className={"dp dp" + (i % 5)} style={{
        left: ((i * 31 + 3) % 100) + "%",
        animationDelay:    ((i * 0.35) % 9) + "s",
        animationDuration: (5 + (i * 0.28) % 7) + "s",
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
        ? <button className="btn-gold" onClick={function() { vibrate(); setShow(true); }}>💳 BUY {sym} WITH CARD</button>
        : <>
            <button className="btn-outline" style={{ marginBottom: 12, fontSize: 10 }} onClick={function() { setShow(false); }}>✕ CLOSE</button>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,215,0,0.4)" }}>
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
    <ConnectButton
      client={client}
      chain={MONAD_MAINNET}
      wallets={WALLETS}
      showAllWallets={true}
      theme="dark"
      btnTitle={title || "🔥 Connect"}
      connectModal={{
        title: "Connect Your Wallet", titleIcon: "",
        welcomeScreen: {
          title: "Dragon Monad",
          subtitle: "Connect your wallet to Monad Mainnet and access DRAGON tokens",
        },
        showThirdwebBranding: false,
      }}
    />
  );
}

// ── BOTTOM BANNER ─────────────────────────────────────────────────────────────
function BottomBanner() {
  const [copied, setCopied] = useState(false);

  function copyAddr() {
    navigator.clipboard.writeText(TOKEN_ADDRESS).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
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
      icon:  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      label: "TWITTER",
      sub:   "@bnbgold277983",
      color: "#FFD700",
    },
    {
      href:  "https://discord.com/channels/1316093079090106472",
      icon:  <svg width="18" height="18" viewBox="0 0 24 24" fill="#a259ff"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.055a19.99 19.99 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.201 13.201 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>,
      label: "DISCORD",
      sub:   "Join Community",
      color: "#a259ff",
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
      <div style={{
        height: 2,
        background: "linear-gradient(90deg,#FFD700,#39FF14,#00eaff,#a259ff,#ff6ec7,#FFE566,#FFD700)",
        backgroundSize: "200% 100%",
        animation: "bbScroll 4s linear infinite",
        borderRadius: "2px 2px 0 0",
      }}/>

      <div style={{
        border: "1px solid rgba(255,215,0,0.25)", borderTop: "none",
        borderRadius: "0 0 16px 16px", overflow: "hidden",
        background: "linear-gradient(160deg,#050A0E 0%,#000d00 60%,#001a00 100%)",
        boxShadow: "0 0 48px rgba(255,215,0,0.08), 0 0 80px rgba(57,255,20,0.05)",
      }}>

        <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 16, padding: "16px 20px", textDecoration: "none", flexWrap: "wrap",
            background: "linear-gradient(90deg,rgba(255,215,0,0.06) 0%,rgba(57,255,20,0.08) 50%,rgba(162,89,255,0.06) 100%)",
            borderBottom: "1px solid rgba(255,215,0,0.12)",
            cursor: "pointer", transition: "background 0.2s",
          }}
          onMouseOver={function(e){ e.currentTarget.style.background="linear-gradient(90deg,rgba(255,215,0,0.14) 0%,rgba(57,255,20,0.16) 50%,rgba(162,89,255,0.12) 100%)"; }}
          onMouseOut= {function(e){ e.currentTarget.style.background="linear-gradient(90deg,rgba(255,215,0,0.06) 0%,rgba(57,255,20,0.08) 50%,rgba(162,89,255,0.06) 100%)"; }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img src={COIN_LOGO} alt="DRAGON"
              style={{
                width: 52, height: 52, borderRadius: "50%", objectFit: "cover", display: "block",
                border: "2px solid #FFD700",
                boxShadow: "0 0 18px rgba(255,215,0,0.7), 0 0 36px rgba(57,255,20,0.3)",
              }}
              onError={function(e){ e.target.style.display="none"; }}
            />
            <div style={{
              position: "absolute", inset: -4, borderRadius: "50%",
              border: "1px solid rgba(255,215,0,0.5)",
              animation: "pingRing 2s ease-out infinite",
            }}/>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 900, letterSpacing: 3,
              background: "linear-gradient(90deg,#FFD700,#FFE566,#39FF14,#a259ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              ❤ SUPPORT · DRAGON MONAD
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,229,102,0.45)", letterSpacing: 2, fontFamily: "'Cinzel',serif" }}>
              DONATE TO KEEP THE DRAGON ALIVE · CLICK TO VIEW ON MONADVISION
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,215,0,0.5)", letterSpacing: 1, marginTop: 1 }}>
              {TOKEN_ADDRESS.slice(0,12)}…{TOKEN_ADDRESS.slice(-10)}
            </div>
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 18px", borderRadius: 20, flexShrink: 0,
            border: "1px solid rgba(255,215,0,0.5)",
            background: "linear-gradient(135deg,rgba(255,215,0,0.15),rgba(57,255,20,0.1))",
            fontFamily: "'Cinzel',serif", fontSize: 10, color: "#FFD700",
            letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap",
            boxShadow: "0 0 20px rgba(255,215,0,0.25)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 21C12 21 3 14.5 3 8.5A5.5 5.5 0 0 1 12 5.1 5.5 5.5 0 0 1 21 8.5C21 14.5 12 21 12 21Z"
                fill="url(#hg2)" stroke="#FFD700" strokeWidth="1.2"/>
              <defs>
                <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFD700"/><stop offset="100%" stopColor="#39FF14"/>
                </linearGradient>
              </defs>
            </svg>
            DONATE
          </div>
        </a>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,215,0,0.08)",
          background: "rgba(255,215,0,0.02)",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,215,0,0.45)", letterSpacing: 1 }}>
            CONTRACT: {TOKEN_ADDRESS}
          </span>
          <button onClick={copyAddr} style={{
            padding: "3px 12px", borderRadius: 6, cursor: "pointer",
            border: "1px solid rgba(255,215,0,0.35)",
            background: copied ? "rgba(255,215,0,0.2)" : "rgba(255,215,0,0.06)",
            color: copied ? "#FFD700" : "rgba(255,215,0,0.6)",
            fontFamily: "'Cinzel',serif", fontSize: 8, letterSpacing: 2, transition: "all 0.2s",
          }}>
            {copied ? "✓ COPIED" : "COPY"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", flexWrap: "wrap" }}>
          {socialLinks.map(function(l, i) {
            return (
              <a key={i} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "18px 22px", textDecoration: "none",
                  flex: 1, minWidth: 110,
                  borderRight: i < socialLinks.length - 1 ? "1px solid rgba(255,215,0,0.08)" : "none",
                  transition: "background 0.2s",
                }}
                onMouseOver={function(e){ e.currentTarget.style.background="rgba(255,215,0,0.05)"; }}
                onMouseOut= {function(e){ e.currentTarget.style.background="transparent"; }}
              >
                <span style={{ lineHeight: 1 }}>{l.icon}</span>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: l.color }}>
                  {l.label}
                </span>
                <span style={{ fontSize: 8, color: "rgba(255,229,102,0.25)", letterSpacing: 1, fontFamily: "'Rajdhani',sans-serif" }}>
                  {l.sub}
                </span>
              </a>
            );
          })}
        </div>

        <div style={{
          textAlign: "center", padding: "10px 20px 14px",
          fontSize: 8, color: "rgba(255,215,0,0.2)", letterSpacing: 4,
          fontFamily: "'Cinzel',serif",
          borderTop: "1px solid rgba(255,215,0,0.07)",
        }}>
          DRAGON TOKEN · MONAD MAINNET · CHAIN 143 · © 2026
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
      onSuccess: function() { setTxStatus("success"); },
      onError:   function() { setTxStatus("error");   },
    });
  }

  async function handleGetQuote() {
    if (!swapOrigin || !swapAmount || !account) return;
    vibrate(); setSwapLoading(true); setSwapError(null); setSwapQuote(null);
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
          --white-flash: #FFFFFF;
          --black:       #050A0E;
          --dark-green:  #003300;
          --deep-green:  #004400;
          --border:      rgba(255,215,0,0.25);
          --border2:     rgba(255,215,0,0.55);
          --text:        #FFE566;
          --text-dim:    rgba(255,229,102,0.6);
          --text-faint:  rgba(255,215,0,0.38);
          --grad-main:   linear-gradient(135deg,#FFE566 0%,#FFD700 35%,#C8960C 70%,#B8860B 100%);
          --grad-gold:   linear-gradient(135deg,#FFE566,#FFD700,#C8960C,#B8860B);
          --grad-cyber:  linear-gradient(135deg,#FFD700 0%,#39FF14 40%,#00eaff 70%,#a259ff 100%);
          --glow-neon:   0 0 20px rgba(57,255,20,0.5), 0 0 40px rgba(0,255,0,0.25);
          --glow-gold:   0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(200,150,12,0.35), 0 0 60px rgba(255,229,102,0.15);
        }

        body { background:var(--black); color:var(--text); font-family:'Rajdhani',sans-serif; }

        .app {
          min-height:100vh;
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%,  rgba(40,30,0,0.7)   0%,transparent 65%),
            radial-gradient(ellipse 45% 35% at 10% 80%, rgba(57,255,20,0.08) 0%,transparent 55%),
            radial-gradient(ellipse 45% 35% at 90% 80%, rgba(162,89,255,0.06) 0%,transparent 55%),
            var(--black);
          position:relative; overflow-x:hidden;
        }
        .app::before {
          content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,215,0,0.012) 3px,rgba(255,215,0,0.012) 4px);
        }

        /* PARTICLES */
        .dragon-particles { position:fixed; inset:0; pointer-events:none; z-index:1; }
        .dp  { position:absolute; bottom:-20px; border-radius:50%; animation:dpRise linear infinite; }
        .dp0 { width:5px;  height:12px; border-radius:50% 50% 50% 50%/60% 60% 40% 40%; background:radial-gradient(#FFD700,transparent); opacity:0.55; }
        .dp1 { width:3px;  height:8px;  border-radius:50%; background:radial-gradient(#39FF14,transparent); opacity:0.4; }
        .dp2 { width:6px;  height:6px;  border-radius:50%; background:radial-gradient(#00eaff,transparent); opacity:0.22; }
        .dp3 { width:2px;  height:10px; border-radius:50%; background:radial-gradient(#a259ff,transparent); opacity:0.28; }
        .dp4 { width:4px;  height:7px;  border-radius:50%; background:radial-gradient(#ff6ec7,transparent); opacity:0.18; }
        @keyframes dpRise {
          0%   { transform:translateY(0) scaleX(1);        opacity:0; }
          8%   { opacity:1; }
          85%  { opacity:0.2; }
          100% { transform:translateY(-100vh) scaleX(0.6); opacity:0; }
        }
        @keyframes bbScroll { 0% { background-position:0% 0%; } 100% { background-position:200% 0%; } }
        @keyframes pingRing { 0% { transform:scale(1); opacity:0.7; } 100% { transform:scale(1.7); opacity:0; } }

        /* HEADER */
        .header {
          position:relative; z-index:10;
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 40px;
          border-bottom:1px solid rgba(255,215,0,0.2);
          background:rgba(5,8,2,0.96);
          backdrop-filter:blur(20px);
          box-shadow:0 1px 0 rgba(255,215,0,0.1),0 4px 32px rgba(0,0,0,0.9);
        }
        .logo { display:flex; align-items:center; gap:14px; }
        .logo-text {
          font-family:'Cinzel',serif; font-size:22px; font-weight:900;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          letter-spacing:4px; filter:drop-shadow(0 0 10px rgba(255,215,0,0.55));
        }
        .logo-sub { font-size:9px; color:var(--text-faint); letter-spacing:4px; text-transform:uppercase; margin-top:3px; font-family:'Cinzel',serif; }
        .chain-badge {
          display:inline-flex; align-items:center; gap:7px; padding:5px 16px; border-radius:20px;
          background:rgba(255,215,0,0.07); border:1px solid rgba(255,215,0,0.25);
          font-size:10px; color:var(--gold); letter-spacing:2px; font-family:'Cinzel',serif;
          box-shadow:0 0 12px rgba(255,215,0,0.1);
        }
        .neon-dot { width:6px; height:6px; border-radius:50%; background:var(--gold); box-shadow:0 0 8px var(--gold); display:inline-block; animation:dotPulse 2s infinite alternate; }
        @keyframes dotPulse { 0% { opacity:1; box-shadow:0 0 8px var(--gold); } 100% { opacity:0.3; box-shadow:none; } }

        /* HERO */
        .hero { position:relative; z-index:5; text-align:center; padding:56px 20px 32px; }
        .hero-logo { display:flex; justify-content:center; margin-bottom:24px; }
        .hero-logo > * { animation:dragonFloat 5s ease-in-out infinite; }
        @keyframes dragonFloat {
          0%,100% { transform:translateY(0) rotate(-1deg);   filter:drop-shadow(0 0 22px rgba(255,215,0,0.7)) drop-shadow(0 0 8px rgba(57,255,20,0.3)); }
          50%      { transform:translateY(-14px) rotate(1deg); filter:drop-shadow(0 0 38px rgba(255,215,0,0.95)) drop-shadow(0 0 16px rgba(162,89,255,0.4)); }
        }
        .hero-title {
          font-family:'Cinzel',serif; font-size:clamp(36px,8vw,72px); font-weight:900; letter-spacing:10px;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          animation:titleGlow 3s ease-in-out infinite alternate;
        }
        @keyframes titleGlow {
          0%   { filter:drop-shadow(0 0 20px rgba(255,215,0,0.5)); }
          100% { filter:drop-shadow(0 0 35px rgba(255,229,102,0.7)); }
        }
        .hero-sub { margin-top:10px; font-size:12px; letter-spacing:5px; text-transform:uppercase; color:var(--text-dim); font-family:'Cinzel',serif; }
        .hero-divider {
          margin:28px auto; width:220px; height:1px;
          background:linear-gradient(90deg,transparent,#FFD700,#FFE566,#39FF14,#00eaff,transparent);
          box-shadow:0 0 14px rgba(255,215,0,0.5), 0 0 28px rgba(57,255,20,0.2);
        }

        /* SOCIAL LINKS */
        .social-links { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:4px; }
        .social-link {
          display:inline-flex; align-items:center; gap:7px; padding:8px 18px; border-radius:20px;
          background:rgba(255,215,0,0.06); border:1px solid rgba(255,215,0,0.22);
          color:var(--text-dim); text-decoration:none; font-size:12px;
          font-family:'Cinzel',serif; letter-spacing:1px; transition:all .2s;
        }
        .social-link:hover { background:rgba(255,215,0,0.13); border-color:var(--gold); color:var(--gold); box-shadow:var(--glow-gold); }

        /* STATS */
        .stats { position:relative; z-index:5; display:flex; justify-content:center; flex-wrap:wrap; gap:12px; padding:0 40px 36px; }
        .stat-card {
          background:linear-gradient(135deg,rgba(20,15,0,0.92),rgba(5,10,14,0.97));
          border:1px solid rgba(255,215,0,0.22); border-radius:12px; padding:18px 28px; min-width:160px; text-align:center;
          transition:all .3s; position:relative; overflow:hidden;
        }
        .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#FFD700,#FFE566,#39FF14,transparent); }
        .stat-card:hover { border-color:var(--gold); box-shadow:var(--glow-gold); transform:translateY(-3px); }
        .stat-label { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--text-faint); font-family:'Cinzel',serif; }
        .stat-value {
          font-family:'Cinzel',serif; font-size:18px; font-weight:700; margin-top:6px;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }

        /* TABS */
        .tabs { position:relative; z-index:5; display:flex; justify-content:center; gap:6px; padding:0 20px 24px; flex-wrap:wrap; }
        .tab-btn {
          padding:10px 28px; border-radius:6px; border:1px solid rgba(255,215,0,0.22);
          background:transparent; color:var(--text-dim);
          font-family:'Cinzel',serif; font-size:10px; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .2s;
          -webkit-tap-highlight-color:transparent;
        }
        .tab-btn.active {
          background:rgba(255,215,0,0.1); color:var(--gold-light); border-color:var(--gold);
          box-shadow:0 0 16px rgba(255,215,0,0.25),inset 0 0 12px rgba(255,215,0,0.06);
        }
        .tab-btn:not(.active):hover { border-color:rgba(255,215,0,0.5); color:var(--text); background:rgba(255,215,0,0.05); }

        /* PANEL */
        .panel { position:relative; z-index:5; max-width:560px; margin:0 auto; padding:0 20px 40px; }
        .card {
          background:linear-gradient(135deg,rgba(10,8,0,0.97),rgba(5,10,14,0.99));
          border:1px solid rgba(255,215,0,0.22); border-radius:16px; padding:30px;
          box-shadow:0 8px 48px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,215,0,0.1);
          animation:fadeUp .35s ease; position:relative; overflow:hidden;
        }
        .card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#FFD700,#FFE566,#39FF14,#00eaff,#a259ff,transparent); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }

        .card-title {
          font-family:'Cinzel',serif; font-size:11px; font-weight:700;
          background:var(--grad-main);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          margin-bottom:22px; display:flex; align-items:center; gap:10px; letter-spacing:3px;
        }
        .card-title::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(255,215,0,0.5),transparent); }

        /* BALANCE */
        .balance-display {
          text-align:center; padding:32px 20px;
          background:radial-gradient(ellipse at center,rgba(255,215,0,0.07) 0%,transparent 70%);
          border-radius:12px; border:1px solid rgba(255,215,0,0.2); margin-bottom:24px;
        }
        .balance-amount {
          font-family:'Cinzel',serif; font-size:42px; font-weight:900;
          background:linear-gradient(135deg,#FFE566,#FFD700,#C8960C);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .balance-symbol { font-size:18px; color:var(--gold); margin-left:8px; font-family:'Cinzel',serif; }
        .balance-addr   { font-size:11px; color:var(--text-faint); margin-top:8px; font-family:monospace; }

        /* CONNECT PROMPT */
        .connect-prompt { text-align:center; padding:32px 20px; }
        .connect-icon   { display:flex; justify-content:center; margin-bottom:24px; }

        /* FIELDS */
        .field { margin-bottom:14px; }
        .field label { display:block; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--text-faint); margin-bottom:6px; font-family:'Cinzel',serif; }
        .field input,.field select {
          width:100%; padding:11px 14px; border-radius:8px;
          background:rgba(10,8,0,0.9); border:1px solid rgba(255,215,0,0.22);
          color:var(--text); font-family:'Rajdhani',sans-serif; font-size:15px;
          outline:none; transition:border-color .2s,box-shadow .2s;
        }
        .field input:focus,.field select:focus { border-color:var(--gold); box-shadow:0 0 0 2px rgba(255,215,0,0.12); }
        .field select option { background:#0a0800; color:var(--text); }

        /* BUTTONS */
        @keyframes goldPulse { 0%,100%{ box-shadow:0 0 20px rgba(255,215,0,0.4); } 50%{ box-shadow:0 0 35px rgba(255,215,0,0.7),0 0 60px rgba(200,150,12,0.4); } }
        .btn-neon {
          width:100%; padding:14px; border-radius:8px;
          border:1px solid rgba(255,215,0,0.5); cursor:pointer;
          background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(200,150,12,0.1),rgba(255,229,102,0.12));
          color:var(--gold-light); font-family:'Cinzel',serif; font-size:11px; font-weight:700;
          letter-spacing:3px; text-transform:uppercase;
          animation:goldPulse 3s ease infinite;
          transition:transform .15s; -webkit-tap-highlight-color:transparent;
        }
        .btn-neon:hover:not(:disabled) { box-shadow:0 0 35px rgba(255,215,0,0.7),0 0 60px rgba(57,255,20,0.2); transform:scale(1.02); color:#fff; }
        .btn-neon:active:not(:disabled) { transform:scale(0.97); }
        .btn-neon:disabled { opacity:0.3; cursor:not-allowed; animation:none; }

        .btn-gold {
          width:100%; padding:14px; border-radius:8px;
          border:1px solid rgba(255,215,0,0.5); cursor:pointer;
          background:linear-gradient(135deg,rgba(255,229,102,0.18),rgba(255,215,0,0.12));
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
          border:1px solid rgba(255,215,0,0.25); background:transparent; color:var(--text-dim);
          font-family:'Cinzel',serif; font-size:10px; cursor:pointer; transition:all .2s; letter-spacing:2px;
          -webkit-tap-highlight-color:transparent;
        }
        .btn-outline:hover { border-color:var(--gold); color:var(--gold-light); background:rgba(255,215,0,0.06); }

        /* STATUS */
        .status { margin-top:12px; padding:11px 14px; border-radius:8px; font-size:11px; font-weight:700; text-align:center; font-family:'Cinzel',serif; letter-spacing:2px; }
        .status.pending { background:rgba(255,215,0,.07);  color:var(--gold);      border:1px solid rgba(255,215,0,.3); }
        .status.success { background:rgba(57,255,20,.07);  color:var(--neon3);     border:1px solid rgba(57,255,20,.3); }
        .status.error   { background:rgba(200,0,0,.08);    color:#ff5050;          border:1px solid rgba(200,0,0,.3); }

        /* QUOTE */
        .quote-box { margin-top:14px; padding:14px; border-radius:10px; background:rgba(255,215,0,0.04); border:1px solid rgba(255,215,0,0.2); }
        .quote-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid rgba(255,215,0,0.08); font-size:13px; }
        .quote-row:last-child { border-bottom:none; }
        .quote-row span:first-child { color:var(--text-dim); }
        .quote-row span:last-child  { color:var(--gold-light); font-weight:700; font-family:'Cinzel',serif; font-size:11px; }
        .deposit-box { margin-top:14px; padding:14px; border-radius:8px; background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.3); word-break:break-all; font-size:11px; color:var(--gold-light); font-family:monospace; line-height:1.7; }

        /* INFO ROWS */
        .info-row { display:flex; justify-content:space-between; padding:11px 0; border-bottom:1px solid rgba(255,215,0,0.08); font-size:13px; }
        .info-row:last-child { border-bottom:none; }
        .info-row .k { color:var(--text-faint); font-family:'Cinzel',serif; font-size:9px; letter-spacing:2px; text-transform:uppercase; }
        .info-row .v { color:var(--gold-light); font-weight:600; font-family:monospace; word-break:break-all; text-align:right; max-width:62%; }

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
            <LogoImage size={48} src={COIN_LOGO}/>
            <div>
              <div className="logo-text">{tokenName || "DRAGON"}</div>
              <div className="logo-sub">Monad Network · Cyberlux Gold</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="chain-badge"><span className="neon-dot"/> Monad · 143</div>
            <DragonConnectButton title="🔥 Connect"/>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-logo"><LogoImage size={130} src={COIN_LOGO}/></div>
          <div className="hero-title">{sym}</div>
          <div className="hero-sub">Dragon of the Monad Chain · Cyberlux Gold Spectrum</div>
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
            { id: "wallet", label: "Wallet"  },
            { id: "swap",   label: "Swap"    },
            { id: "mining", label: "Mining"  },
            { id: "info",   label: "Info"    },
          ].map(function(t) {
            return (
              <button key={t.id} className={"tab-btn" + (tab === t.id ? " active" : "")} onClick={function() { vibrate(); setTab(t.id); }}>
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
                  <div className="connect-icon">
                    <VibrantConnectLogo size={130}/>
                  </div>
                  <DragonConnectButton title="🔥 Connect Wallet"/>
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
                    <input placeholder="0x..." value={transferTo} onChange={function(e) { setTransferTo(e.target.value); }}/>
                  </div>
                  <div className="field">
                    <label>Amount</label>
                    <input type="number" placeholder="0.00" value={transferAmt} onChange={function(e) { setTransferAmt(e.target.value); }}/>
                  </div>
                  <button className="btn-neon" onClick={handleTransfer} disabled={!transferTo || !transferAmt || txStatus === "pending"}>
                    {txStatus === "pending" ? "⏳ SENDING..." : "SEND " + sym}
                  </button>
                  {txStatus && (
                    <div className={"status " + txStatus}>
                      {txStatus === "pending" && "⏳ TRANSACTION PENDING..."}
                      {txStatus === "success" && "✅ TRANSFER CONFIRMED"}
                      {txStatus === "error"   && "❌ TRANSACTION FAILED"}
                    </div>
                  )}
                  <BuyWithCard account={account} sym={sym}/>
                  <a href={"https://monadscan.com/address/" + account.address} target="_blank" rel="noopener noreferrer">
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
          {tab === "swap" && (
            <div className="card">
              <div className="card-title">SWAP → {sym}</div>
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon">
                    <VibrantConnectLogo size={100}/>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 20, lineHeight: 1.8 }}>
                    Connect your wallet to swap any token for {sym} via NEAR Intents.
                  </div>
                  <DragonConnectButton title="🔥 Connect Wallet"/>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.8 }}>
                    Powered by <strong style={{ color: "var(--gold-light)" }}>NEAR Intents</strong> — swap ETH, BTC, SOL, USDC and more into {sym}.
                  </div>
                  <div className="field">
                    <label>From Token</label>
                    <select value={swapOrigin} onChange={function(e) { setSwapOrigin(e.target.value); }}>
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
                    <input type="number" placeholder="0.00" value={swapAmount} onChange={function(e) { setSwapAmount(e.target.value); }}/>
                  </div>
                  <button className="btn-neon" onClick={handleGetQuote} disabled={!swapOrigin || !swapAmount || swapLoading}>
                    {swapLoading ? "⏳ FETCHING QUOTE..." : "GET BEST QUOTE"}
                  </button>
                  {swapError && <div className="status error">{swapError}</div>}
                  {swapQuote && !swapError && (
                    <>
                      <div className="quote-box">
                        <div className="quote-row">
                          <span>You Send</span>
                          <span>{swapAmount} {swapTokens.find(function(t) { return t.assetId === swapOrigin; })?.symbol}</span>
                        </div>
                        <div className="quote-row">
                          <span>You Receive (est.)</span>
                          <span>{swapQuote.amountOutFormatted || "—"} {sym}</span>
                        </div>
                        <div className="quote-row">
                          <span>Deadline</span>
                          <span>{swapQuote.deadline ? new Date(swapQuote.deadline).toLocaleTimeString() : "10 min"}</span>
                        </div>
                      </div>
                      {swapQuote.depositAddress && (
                        <div className="deposit-box">
                          <div style={{ color: "var(--gold-light)", marginBottom: 6, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>DEPOSIT ADDRESS:</div>
                          {swapQuote.depositAddress}
                          <div style={{ marginTop: 8, color: "var(--text-dim)", fontSize: 12 }}>
                            Send your tokens here. NEAR Intents will complete the swap and deliver {sym} to your wallet.
                          </div>
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
              <div className="card-title">LP MINING</div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.8, marginBottom: 20 }}>
                Provide liquidity and earn {sym} rewards through the LP Mining contract.
              </div>
              <div className="info-row"><span className="k">Mining Contract</span><span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Token Contract</span> <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">Network</span>         <span className="v">Monad Mainnet · 143</span></div>
              <div style={{ marginTop: 22 }}>
                <a href={"https://monadscan.com/address/" + LP_MINING} target="_blank" rel="noopener noreferrer">
                  <button className="btn-neon">VIEW MINING CONTRACT</button>
                </a>
                <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer">
                  <button className="btn-outline">📊 MONADVISION ANALYTICS</button>
                </a>
              </div>
            </div>
          )}

          {/* INFO */}
          {tab === "info" && (
            <div className="card">
              <div className="card-title">CONTRACT INFO</div>
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
