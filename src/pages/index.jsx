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
import { createWallet, inAppWallet } from "thirdweb/wallets";

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

// inAppWallet first = auto-reconnect for returning users (email/google/apple)
// MetaMask/Coinbase/WalletConnect = manual connect with button click
const WALLETS = [
  inAppWallet({
    auth: { options: ["email", "google", "apple", "phone"] },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];

const ERC20_ABI = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf",   outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                      name: "name",        outputs: [{ name: "", type: "string"  }], stateMutability: "view", type: "function" },
  { inputs: [],                                      name: "symbol",      outputs: [{ name: "", type: "string"  }], stateMutability: "view", type: "function" },
  { inputs: [],                                      name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                      name: "decimals",    outputs: [{ name: "", type: "uint8"   }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
];

// ── UTILS ────────────────────────────────────────────────────────
function fmt(val, dec = 18, digits = 4) {
  if (!val) return "0";
  try {
    const n = Number(BigInt(val.toString()) * 10000n / BigInt(Math.pow(10, dec))) / 10000;
    return n.toLocaleString("en-US", { maximumFractionDigits: digits });
  } catch { return "0"; }
}

function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

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

// ── DRAGON FIRE PARTICLES ─────────────────────────────────────────
function DragonParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${(i * 37 + 5) % 100}%`,
    delay: `${(i * 0.4) % 8}s`,
    duration: `${4 + (i * 0.3) % 6}s`,
    size: i % 3 === 0 ? "large" : i % 3 === 1 ? "medium" : "small",
  }));
  return (
    <div className="dragon-particles">
      {particles.map(p => (
        <div key={p.id} className={`dp dp-${p.size}`} style={{
          left: p.left,
          animationDelay: p.delay,
          animationDuration: p.duration,
        }} />
      ))}
    </div>
  );
}

// ── BUY WITH CARD ─────────────────────────────────────────────────
function BuyWithCard({ account, sym }) {
  const [show, setShow] = useState(false);
  if (!account) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {!show ? (
        <button className="btn-fire" onClick={() => setShow(true)}>
          💳 BUY {sym} WITH CARD
        </button>
      ) : (
        <>
          <button className="btn-outline" style={{ marginBottom: 12, fontSize: 10 }} onClick={() => setShow(false)}>✕ CLOSE</button>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,80,0,0.4)" }}>
            <BuyWidget client={client} chain={MONAD_MAINNET} tokenAddress={TOKEN_ADDRESS} theme="dark" />
          </div>
        </>
      )}
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

  const { data: balance     } = useReadContract({ contract, method: "balanceOf",   params: [account?.address ?? "0x0000000000000000000000000000000000000000"] });
  const { data: totalSupply } = useReadContract({ contract, method: "totalSupply", params: [] });
  const { data: tokenName   } = useReadContract({ contract, method: "name",        params: [] });
  const { data: tokenSymbol } = useReadContract({ contract, method: "symbol",      params: [] });
  const { mutate: sendTx    } = useSendTransaction();

  useEffect(() => {
    getNearIntentsTokens()
      .then(tokens => setSwapTokens(tokens.filter(t =>
        ["eth","btc","sol","usdc","usdt","near"].some(s => t.symbol?.toLowerCase().includes(s))
      )))
      .catch(() => {});
  }, []);

  function handleTransfer() {
    if (!transferTo || !transferAmt) return;
    setTxStatus("pending");
    const tx = prepareContractCall({ contract, method: "transfer", params: [transferTo, toWei(transferAmt)] });
    sendTx(tx, {
      onSuccess: () => setTxStatus("success"),
      onError:   () => setTxStatus("error"),
    });
  }

  async function handleGetQuote() {
    if (!swapOrigin || !swapAmount || !account) return;
    setSwapLoading(true); setSwapError(null); setSwapQuote(null);
    try {
      const destAsset   = "nep141:monad-" + TOKEN_ADDRESS.toLowerCase() + ".omft.near";
      const originToken = swapTokens.find(t => t.assetId === swapOrigin);
      const decimals    = originToken?.decimals ?? 18;
      const amountRaw   = (BigInt(Math.round(parseFloat(swapAmount) * Math.pow(10, decimals)))).toString();
      const quote       = await getNearIntentsQuote({ originAsset: swapOrigin, destinationAsset: destAsset, amount: amountRaw, recipient: account.address });
      setSwapQuote(quote);
    } catch { setSwapError("Could not fetch quote. Try a different token or amount."); }
    setSwapLoading(false);
  }

  const sym = tokenSymbol || "DRAGON";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --fire:       #FF4500;
          --fire2:      #FF6B00;
          --fire3:      #FFB347;
          --ember:      #FF8C00;
          --gold:       #D4AF37;
          --gold2:      #FFD700;
          --dragon-red: #8B0000;
          --deep:       #0D0608;
          --dark:       #180A0A;
          --dark2:      #221010;
          --dark3:      #2D1515;
          --border:     rgba(255,69,0,0.3);
          --border2:    rgba(212,175,55,0.25);
          --text:       #F5E6D3;
          --text-dim:   rgba(245,230,211,0.55);
          --text-faint: rgba(245,230,211,0.25);
        }

        body { background: var(--deep); color: var(--text); font-family: 'Crimson Pro', serif; }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 70% 50% at 50% 0%,   rgba(139,0,0,0.4)   0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 20% 80%,  rgba(255,69,0,0.15) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 80% 80%,  rgba(255,69,0,0.12) 0%, transparent 55%),
            var(--deep);
          position: relative; overflow-x: hidden;
        }

        .app::before {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(ellipse 8px 6px at 50% 50%, rgba(139,0,0,0.08) 0%, transparent 70%);
          background-size: 20px 16px; opacity: 0.6;
        }

        .dragon-particles { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
        .dp { position: absolute; bottom: -20px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; animation: fireRise linear infinite; }
        .dp-large  { width: 6px;  height: 14px; background: radial-gradient(var(--fire), transparent); opacity: 0.7; }
        .dp-medium { width: 4px;  height: 9px;  background: radial-gradient(var(--fire2), transparent); opacity: 0.5; }
        .dp-small  { width: 2px;  height: 5px;  background: radial-gradient(var(--fire3), transparent); opacity: 0.35; }
        @keyframes fireRise {
          0%   { transform: translateY(0) scaleX(1);      opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translateY(-50vh) scaleX(1.3); }
          90%  { opacity: 0.2; }
          100% { transform: translateY(-100vh) scaleX(0.5); opacity: 0; }
        }

        .header {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 40px;
          border-bottom: 1px solid var(--border);
          background: rgba(13,6,8,0.92);
          backdrop-filter: blur(20px);
          box-shadow: 0 1px 0 rgba(255,69,0,0.1), 0 4px 32px rgba(0,0,0,0.7);
        }
        .logo { display: flex; align-items: center; gap: 14px; }
        .logo img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--fire); box-shadow: 0 0 16px rgba(255,69,0,0.6); object-fit: cover; }
        .logo-text {
          font-family: 'Cinzel', serif; font-size: 22px; font-weight: 900;
          background: linear-gradient(135deg, var(--fire3), var(--fire), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          letter-spacing: 4px; filter: drop-shadow(0 0 8px rgba(255,69,0,0.5));
        }
        .logo-sub { font-size: 9px; color: var(--text-faint); letter-spacing: 4px; text-transform: uppercase; margin-top: 3px; font-family: 'Cinzel', serif; }
        .chain-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 16px; border-radius: 20px;
          background: rgba(255,69,0,0.08); border: 1px solid rgba(255,69,0,0.3);
          font-size: 10px; color: var(--fire3); letter-spacing: 2px; font-family: 'Cinzel', serif;
        }
        .fire-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--fire); box-shadow: 0 0 8px var(--fire); animation: flicker 1.5s infinite alternate; }
        @keyframes flicker { 0% { opacity: 1; box-shadow: 0 0 8px var(--fire); } 100% { opacity: 0.4; box-shadow: 0 0 2px var(--fire2); } }

        .hero { position: relative; z-index: 5; text-align: center; padding: 56px 20px 32px; }
        .hero-logo { display: flex; justify-content: center; margin-bottom: 24px; }
        .hero-logo img {
          width: 130px; height: 130px; border-radius: 50%;
          border: 3px solid var(--fire);
          box-shadow: 0 0 40px rgba(255,69,0,0.7), 0 0 80px rgba(255,69,0,0.3), 0 0 120px rgba(139,0,0,0.2);
          animation: dragonFloat 5s ease-in-out infinite; object-fit: cover;
        }
        @keyframes dragonFloat {
          0%,100% { transform: translateY(0) rotate(-1deg); box-shadow: 0 0 40px rgba(255,69,0,0.7), 0 0 80px rgba(255,69,0,0.3); }
          50%      { transform: translateY(-14px) rotate(1deg); box-shadow: 0 0 60px rgba(255,69,0,0.9), 0 0 100px rgba(255,69,0,0.4); }
        }
        .hero-title {
          font-family: 'Cinzel', serif;
          font-size: clamp(36px, 8vw, 72px); font-weight: 900; letter-spacing: 10px;
          background: linear-gradient(135deg, var(--fire3) 0%, var(--fire) 40%, var(--gold) 70%, var(--fire2) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          filter: drop-shadow(0 0 20px rgba(255,69,0,0.5));
          animation: titleGlow 3s ease-in-out infinite alternate;
        }
        @keyframes titleGlow {
          0%   { filter: drop-shadow(0 0 20px rgba(255,69,0,0.5)); }
          100% { filter: drop-shadow(0 0 35px rgba(255,150,0,0.7)); }
        }
        .hero-sub { margin-top: 10px; font-size: 12px; letter-spacing: 6px; text-transform: uppercase; color: var(--text-dim); font-family: 'Cinzel', serif; }
        .hero-divider {
          margin: 28px auto; width: 200px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--fire), var(--gold), var(--fire), transparent);
          box-shadow: 0 0 10px rgba(255,69,0,0.5);
        }

        .stats { position: relative; z-index: 5; display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 0 40px 36px; }
        .stat-card {
          background: linear-gradient(135deg, rgba(45,21,21,0.9) 0%, rgba(13,6,8,0.95) 100%);
          border: 1px solid var(--border); border-radius: 12px; padding: 18px 28px; min-width: 160px; text-align: center;
          transition: all .3s; position: relative; overflow: hidden;
        }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--fire), transparent); }
        .stat-card:hover { border-color: rgba(255,69,0,0.6); box-shadow: 0 0 24px rgba(255,69,0,0.2), 0 0 48px rgba(139,0,0,0.1); transform: translateY(-3px); }
        .stat-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-faint); font-family: 'Cinzel', serif; }
        .stat-value {
          font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; margin-top: 6px;
          background: linear-gradient(135deg, var(--fire3), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .tabs { position: relative; z-index: 5; display: flex; justify-content: center; gap: 6px; padding: 0 20px 24px; flex-wrap: wrap; }
        .tab-btn {
          padding: 10px 28px; border-radius: 6px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim);
          font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all .2s;
        }
        .tab-btn.active { background: rgba(255,69,0,0.12); color: var(--fire3); border-color: rgba(255,69,0,0.5); box-shadow: 0 0 16px rgba(255,69,0,0.2), inset 0 0 12px rgba(255,69,0,0.06); }
        .tab-btn:not(.active):hover { border-color: rgba(255,69,0,0.4); color: var(--text); background: rgba(255,69,0,0.05); }

        .panel { position: relative; z-index: 5; max-width: 560px; margin: 0 auto; padding: 0 20px 80px; }
        .card {
          background: linear-gradient(135deg, rgba(34,16,16,0.95) 0%, rgba(13,6,8,0.98) 100%);
          border: 1px solid var(--border); border-radius: 16px; padding: 30px;
          box-shadow: 0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,69,0,0.1);
          animation: fadeUp .35s ease; position: relative; overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, var(--fire), var(--gold), var(--fire), transparent);
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

        .card-title {
          font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
          background: linear-gradient(135deg, var(--fire3), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 22px; display: flex; align-items: center; gap: 10px; letter-spacing: 3px;
        }
        .card-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,69,0,0.5), transparent); }

        .balance-display {
          text-align: center; padding: 32px 20px;
          background: radial-gradient(ellipse at center, rgba(255,69,0,0.08) 0%, transparent 70%);
          border-radius: 12px; border: 1px solid rgba(255,69,0,0.2); margin-bottom: 24px;
        }
        .balance-amount {
          font-family: 'Cinzel', serif; font-size: 42px; font-weight: 900;
          background: linear-gradient(135deg, var(--fire3), var(--fire), var(--gold));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          filter: drop-shadow(0 0 12px rgba(255,69,0,0.4));
        }
        .balance-symbol { font-size: 18px; color: var(--fire2); margin-left: 8px; font-family: 'Cinzel', serif; }
        .balance-addr { font-size: 11px; color: var(--text-faint); margin-top: 8px; font-family: monospace; }

        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-faint); margin-bottom: 6px; font-family: 'Cinzel', serif; }
        .field input, .field select {
          width: 100%; padding: 11px 14px; border-radius: 8px;
          background: rgba(13,6,8,0.9); border: 1px solid var(--border);
          color: var(--text); font-family: 'Crimson Pro', serif; font-size: 15px;
          outline: none; transition: border-color .2s, box-shadow .2s;
        }
        .field input:focus, .field select:focus { border-color: rgba(255,69,0,0.6); box-shadow: 0 0 0 2px rgba(255,69,0,0.12); }
        .field select option { background: #221010; color: var(--text); }

        .btn-fire {
          width: 100%; padding: 14px; border-radius: 8px; border: none; cursor: pointer;
          background: linear-gradient(135deg, var(--fire) 0%, var(--dragon-red) 50%, var(--fire2) 100%);
          background-size: 200% 200%; animation: fireShift 3s ease infinite;
          color: var(--text); font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
          letter-spacing: 3px; text-transform: uppercase;
          box-shadow: 0 0 20px rgba(255,69,0,0.5), 0 0 40px rgba(139,0,0,0.3);
          transition: box-shadow .2s, transform .15s;
        }
        @keyframes fireShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .btn-fire:hover:not(:disabled) { box-shadow: 0 0 35px rgba(255,69,0,0.8), 0 0 60px rgba(255,69,0,0.4); transform: scale(1.02); }
        .btn-fire:active:not(:disabled) { transform: scale(0.97); }
        .btn-fire:disabled { opacity: 0.3; cursor: not-allowed; animation: none; }

        .btn-gold {
          width: 100%; padding: 14px; border-radius: 8px; border: none; cursor: pointer;
          background: linear-gradient(135deg, var(--gold2), var(--gold), #B8960C);
          color: #1a0a00; font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
          letter-spacing: 3px; text-transform: uppercase;
          box-shadow: 0 0 20px rgba(212,175,55,0.4); transition: all .2s;
        }
        .btn-gold:hover:not(:disabled) { box-shadow: 0 0 30px rgba(255,215,0,0.6); transform: scale(1.02); }
        .btn-gold:disabled { opacity: 0.3; cursor: not-allowed; }

        .btn-outline {
          width: 100%; padding: 11px; border-radius: 8px; margin-top: 10px;
          border: 1px solid rgba(255,69,0,0.35); background: transparent;
          color: var(--text-dim); font-family: 'Cinzel', serif;
          font-size: 10px; font-weight: 600; cursor: pointer; transition: all .2s; letter-spacing: 2px;
        }
        .btn-outline:hover { border-color: rgba(255,69,0,0.6); color: var(--fire3); background: rgba(255,69,0,0.06); }

        .status { margin-top: 12px; padding: 11px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; text-align: center; font-family: 'Cinzel', serif; letter-spacing: 2px; }
        .status.pending { background: rgba(255,165,0,.08); color: #FFA500; border: 1px solid rgba(255,165,0,.25); }
        .status.success { background: rgba(255,69,0,.08);  color: var(--fire3); border: 1px solid rgba(255,69,0,.3); }
        .status.error   { background: rgba(200,0,0,.08);   color: #FF5050;      border: 1px solid rgba(200,0,0,.3); }

        .quote-box { margin-top: 14px; padding: 14px; border-radius: 10px; background: rgba(255,69,0,0.04); border: 1px solid var(--border); }
        .quote-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid rgba(255,69,0,0.08); font-size: 13px; }
        .quote-row:last-child { border-bottom: none; }
        .quote-row span:first-child { color: var(--text-dim); }
        .quote-row span:last-child { color: var(--fire3); font-weight: 700; font-family: 'Cinzel', serif; font-size: 11px; }
        .deposit-box { margin-top: 14px; padding: 14px; border-radius: 8px; background: rgba(255,69,0,0.05); border: 1px solid rgba(255,69,0,0.3); word-break: break-all; font-size: 11px; color: var(--fire3); font-family: monospace; line-height: 1.7; }

        .info-row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid rgba(255,69,0,0.08); font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
        .info-row .k { color: var(--text-faint); font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
        .info-row .v { color: var(--fire3); font-weight: 600; font-family: monospace; word-break: break-all; text-align: right; max-width: 62%; }

        .connect-prompt { text-align: center; padding: 46px 20px; }
        .connect-icon { font-size: 52px; margin-bottom: 16px; }
        .connect-msg { color: var(--text-dim); font-size: 15px; margin-bottom: 24px; line-height: 1.8; }

        .social-links { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 28px; }
        .social-link {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 18px; border-radius: 20px;
          background: rgba(255,69,0,0.06); border: 1px solid var(--border);
          color: var(--text-dim); text-decoration: none; font-size: 12px;
          font-family: 'Cinzel', serif; letter-spacing: 1px; transition: all .2s;
        }
        .social-link:hover { background: rgba(255,69,0,0.14); border-color: rgba(255,69,0,0.5); color: var(--fire3); box-shadow: 0 0 12px rgba(255,69,0,0.2); }

        .footer { position: relative; z-index: 5; text-align: center; padding: 28px 20px 20px; border-top: 1px solid var(--border); font-size: 9px; color: var(--text-faint); letter-spacing: 3px; font-family: 'Cinzel', serif; }
        .footer a { color: rgba(255,139,0,0.6); text-decoration: none; transition: color .2s; }
        .footer a:hover { color: var(--fire3); }

        @media (max-width: 600px) {
          .header { padding: 14px 16px; }
          .stats  { padding: 0 12px 28px; }
          .hero   { padding: 36px 16px 20px; }
        }
      `}</style>

      <div className="app">
        <DragonParticles />

        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <img src={COIN_LOGO} alt="Dragon Coin" />
            <div>
              <div className="logo-text">{tokenName || "DRAGON"}</div>
              <div className="logo-sub">Monad Network · Fire & Fortune</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="chain-badge">
              <span className="fire-dot" />
              Monad · 143
            </div>
            <ConnectButton
              client={client}
              chain={MONAD_MAINNET}
              wallets={WALLETS}
              theme="dark"
              btnTitle="🔥 Connect"
              autoConnect={true}
            />
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-logo">
            <img src={COIN_LOGO} alt="Dragon" />
          </div>
          <div className="hero-title">{sym}</div>
          <div className="hero-sub">🐉 Dragon of the Monad Chain · Fire &amp; Wealth</div>
          <div className="hero-divider" />
          <div className="social-links">
            <a className="social-link" href="https://x.com/bnbgold277983" target="_blank" rel="noopener noreferrer">𝕏 Twitter</a>
            <a className="social-link" href="https://t.me/gemsrock_bot"   target="_blank" rel="noopener noreferrer">💬 Telegram</a>
            <a className="social-link" href="https://discord.com/channels/1316093079090106472" target="_blank" rel="noopener noreferrer">🎮 Discord</a>
            <a className="social-link" href={`https://monadvision.com/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer">📊 MonadVision</a>
          </div>
        </section>

        {/* STATS */}
        <div className="stats">
          {[
            { label: "Total Supply",  value: fmt(totalSupply) },
            { label: "Your Balance",  value: account ? fmt(balance) : "—" },
            { label: "Network",       value: "Monad" },
            { label: "Chain ID",      value: "143" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="tabs">
          {[
            { id: "wallet", label: "🐉 Wallet"  },
            { id: "swap",   label: "🔥 Swap"    },
            { id: "mining", label: "⛏️ Mining"  },
            { id: "info",   label: "📜 Info"    },
          ].map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* PANEL */}
        <div className="panel">

          {/* WALLET */}
          {tab === "wallet" && (
            <div className="card">
              {!account ? (
                <div className="connect-prompt">
                  <div className="connect-icon">🐉</div>
                  <div className="connect-msg">Connect your wallet to view your {sym} balance and send tokens on Monad.</div>
                  <ConnectButton
                    client={client}
                    chain={MONAD_MAINNET}
                    wallets={WALLETS}
                    theme="dark"
                    btnTitle="🔥 Connect Wallet"
                    autoConnect={true}
                  />
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
                    <input placeholder="0x..." value={transferTo} onChange={e => setTransferTo(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Amount</label>
                    <input type="number" placeholder="0.00" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} />
                  </div>
                  <button className="btn-fire" onClick={handleTransfer} disabled={!transferTo || !transferAmt || txStatus === "pending"}>
                    {txStatus === "pending" ? "🔥 SENDING..." : `🐉 SEND ${sym}`}
                  </button>
                  {txStatus && (
                    <div className={`status ${txStatus}`}>
                      {txStatus === "pending" && "🔥 TRANSACTION PENDING..."}
                      {txStatus === "success" && "✅ TRANSFER CONFIRMED"}
                      {txStatus === "error"   && "❌ TRANSACTION FAILED"}
                    </div>
                  )}
                  <BuyWithCard account={account} sym={sym} />
                  <a href={`https://monadscan.com/address/${account.address}`} target="_blank" rel="noopener noreferrer">
                    <button className="btn-outline">🔍 VIEW ON MONADSCAN</button>
                  </a>
                  <a href={`https://monadvision.com/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer">
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
                  <div className="connect-icon">🔥</div>
                  <div className="connect-msg">Connect your wallet to swap any token for {sym} via NEAR Intents.</div>
                  <ConnectButton client={client} chain={MONAD_MAINNET} wallets={WALLETS} theme="dark" btnTitle="🔥 Connect Wallet" autoConnect={true} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.8 }}>
                    Powered by <strong style={{ color: "var(--fire3)" }}>NEAR Intents</strong> — swap ETH, BTC, SOL, USDC and more into {sym}.
                  </div>
                  <div className="field">
                    <label>From Token</label>
                    <select value={swapOrigin} onChange={e => setSwapOrigin(e.target.value)}>
                      <option value="">Select token...</option>
                      {swapTokens.map(t => (
                        <option key={t.assetId} value={t.assetId}>
                          {t.symbol} — {t.blockchain?.toUpperCase() ?? ""}{t.price ? ` ($${Number(t.price).toFixed(2)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Amount to Swap</label>
                    <input type="number" placeholder="0.00" value={swapAmount} onChange={e => setSwapAmount(e.target.value)} />
                  </div>
                  <button className="btn-fire" onClick={handleGetQuote} disabled={!swapOrigin || !swapAmount || swapLoading}>
                    {swapLoading ? "🔥 FETCHING QUOTE..." : "🐉 GET BEST QUOTE"}
                  </button>
                  {swapError && <div className="status error">{swapError}</div>}
                  {swapQuote && !swapError && (
                    <>
                      <div className="quote-box">
                        <div className="quote-row"><span>You Send</span><span>{swapAmount} {swapTokens.find(t => t.assetId === swapOrigin)?.symbol}</span></div>
                        <div className="quote-row"><span>You Receive (est.)</span><span>{swapQuote.amountOutFormatted || "—"} {sym}</span></div>
                        <div className="quote-row"><span>Deadline</span><span>{swapQuote.deadline ? new Date(swapQuote.deadline).toLocaleTimeString() : "10 min"}</span></div>
                      </div>
                      {swapQuote.depositAddress && (
                        <div className="deposit-box">
                          <div style={{ color: "var(--fire3)", marginBottom: 6, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>DEPOSIT ADDRESS:</div>
                          {swapQuote.depositAddress}
                          <div style={{ marginTop: 8, color: "var(--text-dim)", fontFamily: "'Crimson Pro',serif", fontSize: 12 }}>
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
              <div className="card-title">⛏️ LP MINING</div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.8, marginBottom: 20 }}>
                Provide liquidity and earn {sym} rewards through the LP Mining contract.
              </div>
              <div className="info-row"><span className="k">Mining Contract</span><span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Token Contract</span><span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">Network</span><span className="v">Monad Mainnet · 143</span></div>
              <div style={{ marginTop: 22 }}>
                <a href={`https://monadscan.com/address/${LP_MINING}`} target="_blank" rel="noopener noreferrer">
                  <button className="btn-fire">🐉 VIEW MINING CONTRACT</button>
                </a>
                <a href={`https://monadvision.com/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer">
                  <button className="btn-outline">📊 MONADVISION ANALYTICS</button>
                </a>
              </div>
            </div>
          )}

          {/* INFO */}
          {tab === "info" && (
            <div className="card">
              <div className="card-title">📜 CONTRACT INFO</div>
              <div className="info-row"><span className="k">Token Name</span>      <span className="v">{tokenName || "—"}</span></div>
              <div className="info-row"><span className="k">Symbol</span>          <span className="v">{sym}</span></div>
              <div className="info-row"><span className="k">Network</span>         <span className="v">Monad Mainnet</span></div>
              <div className="info-row"><span className="k">Chain ID</span>        <span className="v">143</span></div>
              <div className="info-row"><span className="k">Token Address</span>   <span className="v">{shortAddr(TOKEN_ADDRESS)}</span></div>
              <div className="info-row"><span className="k">LP Mining</span>       <span className="v">{shortAddr(LP_MINING)}</span></div>
              <div className="info-row"><span className="k">Total Supply</span>    <span className="v">{fmt(totalSupply)}</span></div>
              <div className="info-row"><span className="k">Standard</span>        <span className="v">ERC-20</span></div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                <a href={`https://monadscan.com/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-fire" style={{ fontSize: 10 }}>MONADSCAN</button>
                </a>
                <a href={`https://monadvision.com/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
                  <button className="btn-outline" style={{ marginTop: 0, fontSize: 10 }}>MONADVISION</button>
                </a>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <footer className="footer">
          🐉 DRAGON TOKEN · MONAD MAINNET ·{" "}
          <a href="https://thirdweb.com" target="_blank" rel="noopener noreferrer">THIRDWEB</a>
          {" "}&amp;{" "}
          <a href="https://near-intents.org" target="_blank" rel="noopener noreferrer">NEAR INTENTS</a>
          {" "}· © 2026
        </footer>
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
