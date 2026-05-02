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

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CLIENT_ID  = "821819db832d1a313ae3b1a62fbeafb7";
const NEAR_JWT   = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjUtMDEtMTItdjEifQ.eyJ2IjoxLCJrZXlfdHlwZSI6ImRpc3RyaWJ1dGlvbl9jaGFubmVsIiwicGFydG5lcl9pZCI6ImNyeXB0b2Nhc2gtbmZ0IiwiaWF0IjoxNzczMDc3MzExLCJleHAiOjE4MDQ2MTMzMTF9.Wi55S8cwVmAXPtOG0ymr7ldX-5CXVygzuanbjAAJHP-Am14_52C6i4cQG5FvjcAorw0KD8k8JD_YX5AM4QKhNqYtU5gsI4-KKe0KavO5_69NowzUKc_ubtjYn85eFjWskzZQvICMqSZkdGOSnMT_hNEePA8qYi_wSov4a4bQh4zIfNA0znEdDIV3rGI_bDM9dgOk0PnJRIpwi_aXOQ8Q4e50IO2UMrZEDtBVmUhK5-Mno3S_iS7tZl4QSui_4_bNCapQolFwUPB9Zqyxay_6rPVEr7j-8Ez5-htwkR5ZYvTb1mJaj3DVPpWPL9QTxhjvhbJ7nKrWpibcWX3AVoXZ6g";

// ── CONTRACTS ─────────────────────────────────────────────────────────────────
const DRAGON_ADDRESS  = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81";
const GOLD_ADDRESS    = "0xb73bb15509504fB2Be64159ab0B0b38F26C6d795"; // NOU
const STAKING_ADDRESS = "0x095a69Fe5f0B01bb68f85F18C8b74c17D3F8971F"; // NOU
const LP_MINING       = "0x28840f3e117345A5FBF08b7F67503D2F47B28023";
const TREASURY        = "0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e";

const COIN_LOGO    = "https://raw.githubusercontent.com/00impera/dragon-moonad/1b69991aab99757ff35360042dba5e83c1bbe713/1%2Cpng.png";
const VIBRANT_LOGO = "https://raw.githubusercontent.com/00impera/dragon-moonad/b7e094df45b3a33ef5b310e925e1afd04ab8a5a6/3.png.png";
const MONAD_VISION = "https://monadvision.com/token/" + DRAGON_ADDRESS;

const MONAD_MAINNET = defineChain({
  id: 143, name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpc: "https://rpc.monad.xyz",
  blockExplorers: [{ name: "MonadScan", url: "https://monadscan.com" }],
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

// ── ABIs ──────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf",   outputs: [{ name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "name",        outputs: [{ name: "", type: "string"  }], stateMutability: "view",        type: "function" },
  { inputs: [],                                      name: "symbol",      outputs: [{ name: "", type: "string"  }], stateMutability: "view",        type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
];

const STAKING_ABI = [
  { inputs: [],                                    name: "stake",          outputs: [],                              stateMutability: "payable",    type: "function" },
  { inputs: [{ name: "amount", type: "uint256" }], name: "requestUnstake", outputs: [],                              stateMutability: "nonpayable", type: "function" },
  { inputs: [],                                    name: "claimUnstake",   outputs: [],                              stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "amount", type: "uint256" }], name: "instantUnstake", outputs: [],                              stateMutability: "nonpayable", type: "function" },
  { inputs: [],                                    name: "claimRewards",   outputs: [],                              stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "user", type: "address" }],   name: "pendingRewards", outputs: [{ name: "", type: "uint256" }], stateMutability: "view",       type: "function" },
  { inputs: [],                                    name: "totalStaked",    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",       type: "function" },
  { inputs: [{ name: "user", type: "address" }],   name: "stakeInfo",      outputs: [
    { name: "amount",        type: "uint256" },
    { name: "stakedAt",      type: "uint256" },
    { name: "pending",       type: "uint256" },
    { name: "unstakeAmount", type: "uint256" },
    { name: "unstakeAt",     type: "uint256" },
    { name: "canClaim",      type: "bool"    },
  ], stateMutability: "view", type: "function" },
];

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(val, dec = 18, digits = 4) {
  if (!val) return "0";
  try {
    const n = Number(BigInt(val.toString()) * 10000n / BigInt(Math.pow(10, dec))) / 10000;
    return n.toLocaleString("en-US", { maximumFractionDigits: digits });
  } catch { return "0"; }
}
function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
function vibrate()    { if (navigator.vibrate) navigator.vibrate([40, 15, 40]); }
function timeLeft(ts) {
  const diff = Number(ts) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ready";
  const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
const ZERO = "0x0000000000000000000000000000000000000000";

// ── NEAR INTENTS ──────────────────────────────────────────────────────────────
async function getNearTokens() {
  const r = await fetch("https://1click.chaindefuser.com/v0/tokens", { headers: { Authorization: "Bearer " + NEAR_JWT } });
  return r.json();
}
async function getNearQuote({ originAsset, destinationAsset, amount, recipient }) {
  const deadline = new Date(Date.now() + 600000).toISOString();
  const r = await fetch("https://1click.chaindefuser.com/v0/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + NEAR_JWT },
    body: JSON.stringify({ dry: false, swapType: "EXACT_INPUT", slippageTolerance: 100, originAsset, depositType: "ORIGIN_CHAIN", destinationAsset, amount, recipient, recipientType: "DESTINATION_CHAIN", refundTo: recipient, refundType: "ORIGIN_CHAIN", deadline }),
  });
  return r.json();
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
function Logo({ size = 48, src }) {
  const [err, setErr] = useState(false);
  const s = size;
  if (err) return (
    <div style={{ width: s, height: s, borderRadius: "50%", flexShrink: 0, background: "radial-gradient(circle,#050A0E,#001a00)", border: `${s > 80 ? 3 : 2}px solid #00BFFF`, boxShadow: "0 0 24px rgba(0,191,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: s > 80 ? 44 : 20 }}>🐲</div>
  );
  return (
    <img src={src || COIN_LOGO} alt="Dragon" width={s} height={s}
      style={{ borderRadius: "50%", flexShrink: 0, display: "block", objectFit: "cover", border: `${s > 80 ? 3 : 2}px solid #00BFFF`, boxShadow: s > 80 ? "0 0 40px rgba(0,191,255,0.7),0 0 80px rgba(57,255,20,0.3)" : "0 0 16px rgba(0,191,255,0.6)" }}
      onError={() => setErr(true)}
    />
  );
}

function VibrantLogo({ size = 120 }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <Logo size={size} src={VIBRANT_LOGO} />
      {[{ i: -8, d: "0s" }, { i: -16, d: "0.5s" }].map((r, k) => (
        <div key={k} style={{ position: "absolute", inset: r.i, borderRadius: "50%", border: "1.5px solid rgba(0,191,255,0.5)", animation: `pingRing 2s ease-out infinite ${r.d}`, pointerEvents: "none" }} />
      ))}
    </div>
  );
}

// ── PARTICLES ─────────────────────────────────────────────────────────────────
function Particles() {
  return (
    <div className="particles">
      {Array.from({ length: 28 }, (_, i) => (
        <div key={i} className={`dp dp${i % 5}`} style={{ left: `${(i * 31 + 3) % 100}%`, animationDelay: `${(i * 0.35) % 9}s`, animationDuration: `${5 + (i * 0.28) % 7}s` }} />
      ))}
    </div>
  );
}

// ── STATUS ────────────────────────────────────────────────────────────────────
function TxStatus({ s }) {
  if (!s) return null;
  const M = { pending: ["pending", "PENDING..."], success: ["success", "CONFIRMED!"], error: ["error", "FAILED"] };
  return <div className={`status ${M[s][0]}`}>{M[s][1]}</div>;
}

// ── CONNECT PROMPT ────────────────────────────────────────────────────────────
function ConnectPrompt({ msg = "access this feature" }) {
  return (
    <div className="connect-prompt">
      <div className="connect-icon"><VibrantLogo size={120} /></div>
      <p style={{ color: "rgba(57,255,20,0.7)", marginBottom: 20, fontSize: 13, lineHeight: 1.7 }}>Connect your wallet to {msg}</p>
      <ConnectButton client={client} chain={MONAD_MAINNET} wallets={WALLETS} showAllWallets theme="dark" btnTitle="Connect Wallet" connectModal={{ title: "Connect Wallet", showThirdwebBranding: false }} />
    </div>
  );
}

// ── TAB: WALLET ───────────────────────────────────────────────────────────────
function WalletTab({ account }) {
  const [to, setTo]       = useState("");
  const [amt, setAmt]     = useState("");
  const [s, setS]         = useState(null);
  const [showBuy, setBuy] = useState(false);
  const { mutate: send }  = useSendTransaction();
  const addr = account?.address ?? ZERO;

  const drC = getContract({ client, chain: MONAD_MAINNET, address: DRAGON_ADDRESS, abi: ERC20_ABI });
  const goC = getContract({ client, chain: MONAD_MAINNET, address: GOLD_ADDRESS,   abi: ERC20_ABI });
  const { data: dBal } = useReadContract({ contract: drC, method: "balanceOf",   params: [addr] });
  const { data: gBal } = useReadContract({ contract: goC, method: "balanceOf",   params: [addr] });
  const { data: sup  } = useReadContract({ contract: drC, method: "totalSupply", params: [] });

  function sendTx() {
    if (!to || !amt) return; vibrate(); setS("pending");
    send(prepareContractCall({ contract: drC, method: "transfer", params: [to, toWei(amt)] }), { onSuccess: () => setS("success"), onError: () => setS("error") });
  }

  if (!account) return <ConnectPrompt msg="view your wallet" />;
  return (
    <>
      <div className="balance-display">
        <div><span className="balance-amount">{fmt(dBal)}</span><span className="balance-symbol">DRAGON</span></div>
        <div style={{ borderTop: "1px solid rgba(0,191,255,0.15)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "rgba(57,255,20,0.7)" }}>GOLD: <strong style={{ color: "#39FF14" }}>{fmt(gBal)} GOLD</strong></div>
          <div style={{ fontSize: 10, color: "rgba(0,191,255,0.4)", marginTop: 3, fontFamily: "monospace" }}>Supply: {fmt(sup)} DRAGON</div>
        </div>
        <div className="balance-addr">{shortAddr(account.address)}</div>
      </div>
      <div className="card-title">SEND DRAGON</div>
      <div className="field"><label>Recipient</label><input placeholder="0x..." value={to} onChange={e => setTo(e.target.value)} /></div>
      <div className="field"><label>Amount</label><input type="number" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} /></div>
      <button className="btn-neon" onClick={sendTx} disabled={!to || !amt || s === "pending"}>
        {s === "pending" ? "SENDING..." : "SEND DRAGON"}
      </button>
      <TxStatus s={s} />
      <div style={{ marginTop: 14 }}>
        {!showBuy
          ? <button className="btn-gold" onClick={() => { vibrate(); setBuy(true); }}>BUY DRAGON WITH CARD</button>
          : <><button className="btn-outline" style={{ marginBottom: 10 }} onClick={() => setBuy(false)}>CLOSE</button>
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,191,255,0.3)" }}>
                <BuyWidget client={client} chain={MONAD_MAINNET} tokenAddress={DRAGON_ADDRESS} theme="dark" />
              </div></>}
      </div>
      <a href={`https://monadscan.com/address/${account.address}`} target="_blank" rel="noopener noreferrer"><button className="btn-outline">MONADSCAN</button></a>
      <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer"><button className="btn-outline">MONADVISION</button></a>
    </>
  );
}

// ── TAB: STAKE ────────────────────────────────────────────────────────────────
function StakeTab({ account }) {
  const [stAmt, setStAmt] = useState("");
  const [unAmt, setUnAmt] = useState("");
  const [inAmt, setInAmt] = useState("");
  const [s, setS]         = useState(null);
  const { mutate: send }  = useSendTransaction();
  const addr = account?.address ?? ZERO;

  const stC = getContract({ client, chain: MONAD_MAINNET, address: STAKING_ADDRESS, abi: STAKING_ABI });
  const { data: info  } = useReadContract({ contract: stC, method: "stakeInfo",      params: [addr] });
  const { data: total } = useReadContract({ contract: stC, method: "totalStaked",    params: [] });
  const { data: pend  } = useReadContract({ contract: stC, method: "pendingRewards", params: [addr] });

  const myStaked = info?.[0] ?? 0n;
  const unAmount = info?.[3] ?? 0n;
  const unAt     = info?.[4] ?? 0n;
  const canClaim = info?.[5] ?? false;

  function tx(method, params = [], value) {
    vibrate(); setS("pending");
    const opts = { contract: stC, method, params, ...(value !== undefined ? { value } : {}) };
    send(prepareContractCall(opts), { onSuccess: () => setS("success"), onError: () => setS("error") });
  }

  if (!account) return <ConnectPrompt msg="stake MON and earn GOLD" />;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {[
          ["MY STAKED",    fmt(myStaked, 18, 6) + " MON"],
          ["TOTAL STAKED", fmt(total, 18, 6)    + " MON"],
          ["PENDING GOLD", fmt(pend) + " GOLD"],
        ].map(([l, v]) => (
          <div key={l} className="stat-card-blue">
            <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(57,255,20,0.5)", fontFamily: "'Cinzel',serif", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, color: "#39FF14", marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(0,60,255,0.08)", border: "1px solid rgba(0,191,255,0.25)", borderRadius: 10, padding: "11px 14px", marginBottom: 18, fontSize: 12, color: "rgba(57,255,20,0.8)", lineHeight: 1.9 }}>
        <strong style={{ color: "#39FF14" }}>Rate:</strong> 1 GOLD per MON per day &nbsp;|&nbsp;
        <strong style={{ color: "#00BFFF" }}>Instant penalty:</strong> 10%
      </div>

      <div className="card-title">STAKE MON</div>
      <div className="field"><label>Amount MON</label><input type="number" placeholder="0.00" value={stAmt} onChange={e => setStAmt(e.target.value)} /></div>
      <button className="btn-neon" onClick={() => stAmt && tx("stake", [], toWei(stAmt))} disabled={!stAmt || s === "pending"}>STAKE MON</button>

      <button className="btn-gold" style={{ marginTop: 10 }} onClick={() => tx("claimRewards")} disabled={s === "pending"}>
        CLAIM REWARDS (GOLD)
      </button>

      <div className="card-title" style={{ marginTop: 20 }}>REQUEST UNSTAKE (7 days)</div>
      <div className="field"><label>Amount MON</label><input type="number" placeholder="0.00" value={unAmt} onChange={e => setUnAmt(e.target.value)} /></div>
      <button className="btn-outline" onClick={() => unAmt && tx("requestUnstake", [toWei(unAmt)])} disabled={!unAmt}>REQUEST UNSTAKE</button>

      {unAmount > 0n && (
        <div style={{ background: "rgba(0,60,255,0.06)", border: "1px solid rgba(0,191,255,0.2)", borderRadius: 10, padding: "13px 14px", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(57,255,20,0.7)", marginBottom: 6 }}>
            Pending: <strong style={{ color: "#39FF14" }}>{fmt(unAmount, 18, 6)} MON</strong>
          </div>
          <div style={{ fontSize: 12, color: "rgba(0,191,255,0.6)", marginBottom: 10 }}>
            Ready: <strong style={{ color: canClaim ? "#39FF14" : "#00BFFF" }}>{timeLeft(unAt)}</strong>
          </div>
          <button className="btn-neon" onClick={() => tx("claimUnstake")} disabled={!canClaim || s === "pending"}>CLAIM UNSTAKE</button>
        </div>
      )}

      <div className="card-title" style={{ marginTop: 20 }}>INSTANT UNSTAKE (-10%)</div>
      <div className="field"><label>Amount MON (10% penalty)</label><input type="number" placeholder="0.00" value={inAmt} onChange={e => setInAmt(e.target.value)} /></div>
      <button className="btn-outline" style={{ borderColor: "rgba(0,191,255,0.4)", color: "#00BFFF" }} onClick={() => inAmt && tx("instantUnstake", [toWei(inAmt)])} disabled={!inAmt}>
        INSTANT UNSTAKE
      </button>

      <TxStatus s={s} />
      <div style={{ marginTop: 14, padding: "9px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 8, fontSize: 9, color: "rgba(0,191,255,0.3)", fontFamily: "monospace", wordBreak: "break-all" }}>
        Staking: {STAKING_ADDRESS}
      </div>
    </>
  );
}

// ── TAB: SWAP ─────────────────────────────────────────────────────────────────
function SwapTab({ account }) {
  const [tokens,  setTokens ] = useState([]);
  const [origin,  setOrigin ] = useState("");
  const [amount,  setAmount ] = useState("");
  const [quote,   setQuote  ] = useState(null);
  const [loading, setLoad   ] = useState(false);
  const [error,   setError  ] = useState(null);
  const [copied,  setCopied ] = useState(false);

  useEffect(() => {
    getNearTokens().then(t => setTokens(t.filter(x => ["eth","btc","sol","usdc","usdt","near"].some(s => x.symbol?.toLowerCase().includes(s))))).catch(() => {});
  }, []);

  async function getQuote() {
    if (!origin || !amount || !account) return;
    vibrate(); setLoad(true); setError(null); setQuote(null);
    try {
      const dest = `nep141:monad-${DRAGON_ADDRESS.toLowerCase()}.omft.near`;
      const tok  = tokens.find(t => t.assetId === origin);
      const dec  = tok?.decimals ?? 18;
      const raw  = BigInt(Math.round(parseFloat(amount) * Math.pow(10, dec))).toString();
      setQuote(await getNearQuote({ originAsset: origin, destinationAsset: dest, amount: raw, recipient: account.address }));
    } catch { setError("Could not fetch quote. Try a different token or amount."); }
    setLoad(false);
  }

  if (!account) return <ConnectPrompt msg="swap tokens for DRAGON" />;
  return (
    <>
      <div style={{ fontSize: 13, color: "rgba(57,255,20,0.7)", marginBottom: 16, lineHeight: 1.8 }}>
        Powered by <strong style={{ color: "#39FF14" }}>NEAR Intents</strong> — swap ETH, BTC, SOL, USDC to DRAGON
      </div>
      <div className="field">
        <label>From Token</label>
        <select value={origin} onChange={e => setOrigin(e.target.value)}>
          <option value="">Select token...</option>
          {tokens.map(t => <option key={t.assetId} value={t.assetId}>{t.symbol} — {t.blockchain?.toUpperCase()}{t.price ? ` ($${Number(t.price).toFixed(2)})` : ""}</option>)}
        </select>
      </div>
      <div className="field"><label>Amount</label><input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <button className="btn-neon" onClick={getQuote} disabled={!origin || !amount || loading}>
        {loading ? "FETCHING QUOTE..." : "GET BEST QUOTE"}
      </button>
      {error && <div className="status error">{error}</div>}
      {quote && (
        <>
          <div className="quote-box">
            <div className="quote-row"><span>You Send</span><span>{amount} {tokens.find(t => t.assetId === origin)?.symbol}</span></div>
            <div className="quote-row"><span>You Receive (est.)</span><span>{quote.amountOutFormatted ?? "—"} DRAGON</span></div>
            <div className="quote-row"><span>Deadline</span><span>{quote.deadline ? new Date(quote.deadline).toLocaleTimeString() : "10 min"}</span></div>
          </div>
          {quote.depositAddress && (
            <div className="deposit-box">
              <div style={{ color: "#39FF14", marginBottom: 6, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>DEPOSIT ADDRESS:</div>
              {quote.depositAddress}
              <button className="btn-outline" style={{ marginTop: 10, fontSize: 10 }} onClick={() => { navigator.clipboard.writeText(quote.depositAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? "COPIED" : "COPY ADDRESS"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── TAB: AIRDROP ──────────────────────────────────────────────────────────────
function AirdropTab() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,rgba(0,60,255,0.12),rgba(57,255,20,0.05))", border: "1px solid rgba(0,191,255,0.25)", borderRadius: 14, padding: "22px 18px", marginBottom: 18, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🏆</div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 15, fontWeight: 700, color: "#39FF14", letterSpacing: 2 }}>STAKE MON · WIN GOLD</div>
        <div style={{ fontSize: 12, color: "rgba(57,255,20,0.6)", marginTop: 10, lineHeight: 1.8 }}>
          Stake MON → earn 1 GOLD per MON per day.<br />
          GOLD is the reward token, verified on Sourcify.
        </div>
      </div>

      <div className="card-title">CONTRACTS</div>
      {[
        ["GOLD Token (Rewards)", GOLD_ADDRESS,    "#39FF14"],
        ["DRAGON Token",         DRAGON_ADDRESS,  "#00BFFF"],
        ["LiquidStaking",        STAKING_ADDRESS, "#00BFFF"],
      ].map(([l, a, c]) => (
        <div key={l} className="info-row">
          <span className="k">{l}</span>
          <span className="v" style={{ color: c }}>{shortAddr(a)}</span>
        </div>
      ))}

      <div style={{ background: "rgba(0,60,255,0.08)", border: "1px solid rgba(0,191,255,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 16, fontSize: 12, color: "rgba(57,255,20,0.7)", lineHeight: 1.9 }}>
        <strong style={{ color: "#39FF14" }}>How it works:</strong><br />
        1. Stake MON in the Stake tab<br />
        2. Earn 1 GOLD per MON per day<br />
        3. Claim rewards anytime from the Stake tab<br />
        4. GOLD goes directly to your wallet
      </div>

      <a href={`https://monadvision.com/token/${GOLD_ADDRESS}`} target="_blank" rel="noopener noreferrer">
        <button className="btn-neon" style={{ marginTop: 16 }}>VIEW GOLD ON MONADVISION</button>
      </a>
      <a href={`https://monadscan.com/address/${STAKING_ADDRESS}`} target="_blank" rel="noopener noreferrer">
        <button className="btn-outline">VIEW STAKING CONTRACT</button>
      </a>
    </>
  );
}

// ── TAB: INFO ─────────────────────────────────────────────────────────────────
function InfoTab() {
  const [cop, setCop] = useState(null);
  function copy(a, k) { navigator.clipboard.writeText(a).then(() => { setCop(k); setTimeout(() => setCop(null), 2000); }); }

  const addrs = [
    ["DRAGON Token",     DRAGON_ADDRESS,  "ERC-20 · 8.6K holders"],
    ["GOLD Token (new)", GOLD_ADDRESS,    "ERC-20 · Reward token"],
    ["LiquidStaking",    STAKING_ADDRESS, "Stake MON · Earn GOLD"],
    ["LP Mining",        LP_MINING,       "Original LP Mining"],
    ["Treasury",         TREASURY,        "Owner wallet"],
  ];

  return (
    <>
      <div className="card-title">CONTRACT INFO</div>
      {[
        ["Network",         "Monad Mainnet",    true ],
        ["Chain ID",        "143",              false],
        ["Rewards/day",     "1 GOLD per MON",   true ],
        ["Unstake delay",   "7 days",           false],
        ["Instant penalty", "10% to treasury",  false],
        ["Verified",        "Sourcify",         true ],
      ].map(([k, v, hi]) => (
        <div key={k} className="info-row">
          <span className="k">{k}</span>
          <span className="v" style={hi ? { color: "#39FF14" } : { color: "#00BFFF" }}>{v}</span>
        </div>
      ))}

      <div className="card-title" style={{ marginTop: 20 }}>ADDRESSES</div>
      {addrs.map(([l, a, d]) => (
        <div key={l} style={{ background: "rgba(0,20,60,0.7)", border: "1px solid rgba(0,191,255,0.18)", borderRadius: 10, padding: "11px 13px", marginBottom: 7, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 8, color: "rgba(0,191,255,0.5)", letterSpacing: 2, textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#39FF14", marginTop: 2 }}>{a}</div>
            <div style={{ fontSize: 9, color: "rgba(57,255,20,0.35)", marginTop: 2 }}>{d}</div>
          </div>
          <button onClick={() => copy(a, l)} style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(0,191,255,0.35)", background: cop === l ? "rgba(0,60,255,0.25)" : "rgba(0,60,255,0.08)", color: cop === l ? "#39FF14" : "rgba(57,255,20,0.6)", fontFamily: "'Cinzel',serif", fontSize: 8, letterSpacing: 2, whiteSpace: "nowrap" }}>
            {cop === l ? "COPIED" : "COPY"}
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <a href={`https://monadscan.com/token/${DRAGON_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}><button className="btn-neon" style={{ fontSize: 9 }}>MONADSCAN</button></a>
        <a href={MONAD_VISION} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}><button className="btn-outline" style={{ marginTop: 0, fontSize: 9 }}>MONADVISION</button></a>
      </div>
    </>
  );
}

// ── BOTTOM BANNER ─────────────────────────────────────────────────────────────
function Banner() {
  const [cop, setCop] = useState(false);
  const links = [
    { href: "https://t.me/DragonMonadBot",                      label: "TELEGRAM",   color: "#39FF14" },
    { href: "https://x.com/bnbgold277983",                      label: "TWITTER",    color: "#39FF14" },
    { href: "https://discord.com/channels/1316093079090106472", label: "DISCORD",    color: "#39FF14" },
    { href: MONAD_VISION,                                        label: "ANALYTICS",  color: "#39FF14" },
  ];
  return (
    <div style={{ position: "relative", zIndex: 5, padding: "0 14px 24px" }}>
      <div style={{ height: 2, background: "linear-gradient(90deg,#003cff,#39FF14,#00BFFF,#003cff)", backgroundSize: "200% 100%", animation: "bbScroll 4s linear infinite", borderRadius: "2px 2px 0 0" }} />
      <div style={{ border: "1px solid rgba(0,191,255,0.2)", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden", background: "linear-gradient(160deg,#050A0E,#000d20,#001a00)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderBottom: "1px solid rgba(0,191,255,0.08)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(0,191,255,0.4)" }}>DRAGON: {DRAGON_ADDRESS}</span>
          <button onClick={() => { navigator.clipboard.writeText(DRAGON_ADDRESS).then(() => { setCop(true); setTimeout(() => setCop(false), 2000); }); }} style={{ padding: "3px 9px", borderRadius: 5, cursor: "pointer", border: "1px solid rgba(0,191,255,0.3)", background: cop ? "rgba(0,60,255,0.2)" : "rgba(0,60,255,0.05)", color: cop ? "#39FF14" : "rgba(57,255,20,0.5)", fontFamily: "'Cinzel',serif", fontSize: 7, letterSpacing: 2 }}>
            {cop ? "COPIED" : "COPY"}
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {links.map((l, i) => (
            <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "14px 16px", textDecoration: "none", flex: 1, minWidth: 90, borderRight: i < links.length - 1 ? "1px solid rgba(0,191,255,0.08)" : "none" }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 8, fontWeight: 700, letterSpacing: 2, color: l.color }}>{l.label}</span>
            </a>
          ))}
        </div>
        <div style={{ textAlign: "center", padding: "8px 16px 12px", fontSize: 7, color: "rgba(0,191,255,0.2)", letterSpacing: 4, fontFamily: "'Cinzel',serif", borderTop: "1px solid rgba(0,191,255,0.07)" }}>
          DRAGON · GOLD REWARDS · MONAD · CHAIN 143 · 2026
        </div>
      </div>
    </div>
  );
}

// ── TABS CONFIG ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "wallet",  label: "Wallet"  },
  { id: "stake",   label: "Stake"   },
  { id: "swap",    label: "Swap"    },
  { id: "airdrop", label: "Airdrop" },
  { id: "info",    label: "Info"    },
];

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function DragonApp() {
  const account = useActiveAccount();
  const [tab, setTab] = useState("wallet");

  const drC = getContract({ client, chain: MONAD_MAINNET, address: DRAGON_ADDRESS, abi: ERC20_ABI });
  const { data: supply } = useReadContract({ contract: drC, method: "totalSupply", params: [] });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Rajdhani:wght@400;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{--blue:#003cff;--blue-l:#00BFFF;--neon:#39FF14;--black:#050A0E;--bdr:rgba(0,191,255,0.22);--txt:#39FF14;--dim:rgba(57,255,20,0.6);--fnt:rgba(0,191,255,0.4);--grad:linear-gradient(135deg,#39FF14,#00BFFF,#003cff);}
        body{background:var(--black);color:var(--txt);font-family:'Rajdhani',sans-serif;}
        .app{min-height:100vh;background:radial-gradient(ellipse 80% 55% at 50% 0%,rgba(0,30,80,0.7),transparent 65%),radial-gradient(ellipse 40% 30% at 10% 80%,rgba(57,255,20,0.07),transparent 55%),var(--black);position:relative;overflow-x:hidden;}
        .app::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,191,255,0.01) 3px,rgba(0,191,255,0.01) 4px);}
        .particles{position:fixed;inset:0;pointer-events:none;z-index:1;}
        .dp{position:absolute;bottom:-20px;border-radius:50%;animation:dpRise linear infinite;}
        .dp0{width:4px;height:9px;background:radial-gradient(#003cff,transparent);opacity:.5;}
        .dp1{width:3px;height:7px;background:radial-gradient(#39FF14,transparent);opacity:.35;}
        .dp2{width:5px;height:5px;background:radial-gradient(#00BFFF,transparent);opacity:.2;}
        .dp3{width:2px;height:8px;background:radial-gradient(#003cff,transparent);opacity:.25;}
        .dp4{width:3px;height:6px;background:radial-gradient(#39FF14,transparent);opacity:.18;}
        @keyframes dpRise{0%{transform:translateY(0);opacity:0;}8%{opacity:.8;}85%{opacity:.12;}100%{transform:translateY(-100vh);opacity:0;}}
        @keyframes pingRing{0%{transform:scale(1);opacity:.7;}100%{transform:scale(1.7);opacity:0;}}
        @keyframes bbScroll{0%{background-position:0%;}100%{background-position:200%;}}
        @keyframes titleGlow{0%{filter:drop-shadow(0 0 18px rgba(0,191,255,.5));}100%{filter:drop-shadow(0 0 32px rgba(57,255,20,.7));}}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-13px);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 16px rgba(0,60,255,.35);}50%{box-shadow:0 0 30px rgba(0,60,255,.65),0 0 52px rgba(57,255,20,.3);}}
        .wrap{position:relative;z-index:2;}
        .hdr{display:flex;align-items:center;justify-content:space-between;padding:13px 28px;border-bottom:1px solid rgba(0,191,255,0.18);background:rgba(2,5,20,.97);backdrop-filter:blur(20px);}
        .logo-txt{font-family:'Cinzel',serif;font-size:19px;font-weight:900;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:4px;}
        .logo-sub{font-size:8px;color:var(--fnt);letter-spacing:3px;font-family:'Cinzel',serif;margin-top:2px;}
        .badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(0,60,255,.1);border:1px solid rgba(0,191,255,.25);font-size:9px;color:#00BFFF;letter-spacing:2px;font-family:'Cinzel',serif;}
        .ndot{width:5px;height:5px;border-radius:50%;background:var(--neon);display:inline-block;animation:dpRise 2s infinite alternate;}
        .hero{text-align:center;padding:44px 18px 26px;}
        .hero-float{animation:float 5s ease-in-out infinite;}
        .hero-title{font-family:'Cinzel',serif;font-size:clamp(32px,8vw,64px);font-weight:900;letter-spacing:10px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:titleGlow 3s ease-in-out infinite alternate;}
        .hero-sub{margin-top:7px;font-size:10px;letter-spacing:4px;color:var(--dim);font-family:'Cinzel',serif;}
        .divider{margin:20px auto;width:190px;height:1px;background:linear-gradient(90deg,transparent,#003cff,#39FF14,transparent);}
        .social-links{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:4px;}
        .slink{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;background:rgba(0,60,255,.15);border:1px solid rgba(0,191,255,.3);color:#39FF14;text-decoration:none;font-size:10px;font-family:'Cinzel',serif;letter-spacing:1px;transition:all .2s;}
        .slink:hover{background:rgba(0,60,255,.3);border-color:#00BFFF;color:#39FF14;}
        .stats{display:flex;justify-content:center;flex-wrap:wrap;gap:9px;padding:0 28px 28px;}
        .stat-card{background:linear-gradient(135deg,rgba(0,30,100,.85),rgba(0,10,40,.97));border:1px solid rgba(0,191,255,.25);border-radius:11px;padding:14px 20px;min-width:140px;text-align:center;position:relative;overflow:hidden;transition:all .3s;}
        .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#003cff,#39FF14,transparent);}
        .stat-card:hover{border-color:#00BFFF;transform:translateY(-2px);}
        .stat-card-blue{background:rgba(0,20,80,.8);border:1px solid rgba(0,191,255,.2);border-radius:10px;padding:12px 14px;text-align:center;}
        .stat-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--fnt);font-family:'Cinzel',serif;}
        .stat-value{font-family:'Cinzel',serif;font-size:13px;font-weight:700;margin-top:4px;color:#39FF14;}
        .tabs{display:flex;justify-content:center;gap:5px;padding:0 14px 20px;flex-wrap:wrap;}
        .tab-btn{padding:8px 18px;border-radius:6px;border:1px solid rgba(0,191,255,.2);background:transparent;color:rgba(57,255,20,0.5);font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;cursor:pointer;transition:all .2s;-webkit-tap-highlight-color:transparent;}
        .tab-btn.active{background:linear-gradient(135deg,#003cff,#0055ff);color:#39FF14;border-color:#00BFFF;box-shadow:0 0 14px rgba(0,60,255,.4);}
        .tab-btn:not(.active):hover{border-color:rgba(0,191,255,.5);color:#39FF14;}
        .panel{max-width:520px;margin:0 auto;padding:0 14px 32px;}
        .card{background:linear-gradient(135deg,rgba(0,10,40,.97),rgba(2,5,20,.99));border:1px solid rgba(0,191,255,.2);border-radius:15px;padding:24px;box-shadow:0 8px 44px rgba(0,0,0,.8);animation:fadeUp .3s ease;position:relative;overflow:hidden;}
        .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#003cff,#00BFFF,#39FF14,transparent);}
        .card-title{font-family:'Cinzel',serif;font-size:10px;font-weight:700;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px;display:flex;align-items:center;gap:9px;letter-spacing:3px;}
        .card-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(0,191,255,.5),transparent);}
        .balance-display{text-align:center;padding:24px 14px;background:radial-gradient(ellipse at center,rgba(0,60,255,.08),transparent 70%);border-radius:11px;border:1px solid rgba(0,191,255,.18);margin-bottom:20px;}
        .balance-amount{font-family:'Cinzel',serif;font-size:38px;font-weight:900;background:linear-gradient(135deg,#39FF14,#00BFFF,#003cff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .balance-symbol{font-size:15px;color:#00BFFF;margin-left:5px;font-family:'Cinzel',serif;}
        .balance-addr{font-size:10px;color:var(--fnt);margin-top:6px;font-family:monospace;}
        .connect-prompt{text-align:center;padding:24px 14px;}
        .connect-icon{display:flex;justify-content:center;margin-bottom:18px;}
        .field{margin-bottom:11px;}
        .field label{display:block;font-size:7px;letter-spacing:3px;text-transform:uppercase;color:var(--fnt);margin-bottom:4px;font-family:'Cinzel',serif;}
        .field input,.field select{width:100%;padding:9px 12px;border-radius:7px;background:rgba(0,10,40,.9);border:1px solid rgba(0,191,255,.25);color:#39FF14;font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;transition:border-color .2s;}
        .field input:focus,.field select:focus{border-color:#00BFFF;}
        .field select option{background:#00050f;color:#39FF14;}
        .btn-neon{width:100%;padding:12px;border-radius:8px;border:1px solid rgba(0,191,255,.5);cursor:pointer;background:linear-gradient(135deg,#003cff,#0055ff);color:#39FF14;font-family:'Cinzel',serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;animation:goldPulse 3s ease infinite;transition:transform .15s;-webkit-tap-highlight-color:transparent;}
        .btn-neon:hover:not(:disabled){box-shadow:0 0 28px rgba(0,60,255,.7);transform:scale(1.02);}
        .btn-neon:active:not(:disabled){transform:scale(0.97);}
        .btn-neon:disabled{opacity:.3;cursor:not-allowed;animation:none;}
        .btn-gold{width:100%;padding:12px;border-radius:8px;border:1px solid rgba(0,191,255,.4);cursor:pointer;background:linear-gradient(135deg,rgba(0,60,255,.2),rgba(0,30,120,.15));color:#39FF14;font-family:'Cinzel',serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;transition:all .2s;-webkit-tap-highlight-color:transparent;}
        .btn-gold:hover{transform:scale(1.02);box-shadow:0 0 22px rgba(0,60,255,.5);}
        .btn-outline{width:100%;padding:9px;border-radius:7px;margin-top:7px;border:1px solid rgba(0,191,255,.2);background:transparent;color:rgba(57,255,20,0.6);font-family:'Cinzel',serif;font-size:9px;cursor:pointer;transition:all .2s;letter-spacing:2px;-webkit-tap-highlight-color:transparent;}
        .btn-outline:hover{border-color:#00BFFF;color:#39FF14;background:rgba(0,60,255,.08);}
        .status{margin-top:9px;padding:9px 12px;border-radius:7px;font-size:10px;font-weight:700;text-align:center;font-family:'Cinzel',serif;letter-spacing:2px;}
        .status.pending{background:rgba(0,60,255,.1);color:#00BFFF;border:1px solid rgba(0,191,255,.3);}
        .status.success{background:rgba(57,255,20,.07);color:#6FFF45;border:1px solid rgba(57,255,20,.28);}
        .status.error{background:rgba(200,0,0,.08);color:#ff5050;border:1px solid rgba(200,0,0,.28);}
        .quote-box{margin-top:11px;padding:12px;border-radius:9px;background:rgba(0,60,255,.06);border:1px solid rgba(0,191,255,.18);}
        .quote-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,191,255,.07);font-size:12px;}
        .quote-row:last-child{border-bottom:none;}
        .quote-row span:first-child{color:rgba(57,255,20,0.5);}
        .quote-row span:last-child{color:#39FF14;font-weight:700;font-family:'Cinzel',serif;font-size:10px;}
        .deposit-box{margin-top:11px;padding:12px;border-radius:7px;background:rgba(0,60,255,.07);border:1px solid rgba(0,191,255,.28);word-break:break-all;font-size:10px;color:#39FF14;font-family:monospace;line-height:1.7;}
        .info-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(0,191,255,.07);font-size:12px;}
        .info-row:last-child{border-bottom:none;}
        .k{color:var(--fnt);font-family:'Cinzel',serif;font-size:7px;letter-spacing:2px;text-transform:uppercase;}
        .v{color:#39FF14;font-weight:600;font-family:monospace;word-break:break-all;text-align:right;max-width:62%;font-size:10px;}
        @media(max-width:580px){.hdr{padding:11px 12px;}.stats{padding:0 9px 22px;}.hero{padding:30px 12px 16px;}.badge.hsm{display:none;}}
      `}</style>

      <div className="app">
        <Particles />
        <div className="wrap">

          {/* HEADER */}
          <header className="hdr">
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Logo size={42} src={COIN_LOGO} />
              <div>
                <div className="logo-txt">DRAGON</div>
                <div className="logo-sub">Monad · Liquid Staking · GOLD Rewards</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="badge hsm"><span className="ndot" /> Monad · 143</div>
              <ConnectButton client={client} chain={MONAD_MAINNET} wallets={WALLETS} showAllWallets theme="dark" btnTitle="Connect"
                connectModal={{ title: "Connect Wallet", showThirdwebBranding: false }} />
            </div>
          </header>

          {/* HERO */}
          <section className="hero">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div className="hero-float"><Logo size={118} src={COIN_LOGO} /></div>
            </div>
            <div className="hero-title">DRAGON</div>
            <div className="hero-sub">Liquid Staking · GOLD Rewards · Monad Chain 143</div>
            <div className="divider" />
            <div className="social-links">
              <a className="slink" href="https://t.me/DragonMonadBot" target="_blank" rel="noopener noreferrer">Telegram</a>
              <a className="slink" href="https://x.com/bnbgold277983" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a className="slink" href="https://discord.com/channels/1316093079090106472" target="_blank" rel="noopener noreferrer">Discord</a>
              <a className="slink" href={MONAD_VISION} target="_blank" rel="noopener noreferrer">MonadVision</a>
            </div>
          </section>

          {/* STATS */}
          <div className="stats">
            {[
              ["LiquidStaking", shortAddr(STAKING_ADDRESS)],
              ["GOLD Token",    shortAddr(GOLD_ADDRESS)   ],
              ["DRAGON Token",  shortAddr(DRAGON_ADDRESS) ],
              ["Chain ID",      "143"                     ],
            ].map(([l, v]) => (
              <div key={l} className="stat-card">
                <div className="stat-label">{l}</div>
                <div className="stat-value">{v}</div>
              </div>
            ))}
          </div>

          {/* TABS */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => { vibrate(); setTab(t.id); }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* PANEL */}
          <div className="panel">
            <div className="card">
              {tab === "wallet"  && <WalletTab  account={account} />}
              {tab === "stake"   && <StakeTab   account={account} />}
              {tab === "swap"    && <SwapTab    account={account} />}
              {tab === "airdrop" && <AirdropTab />}
              {tab === "info"    && <InfoTab />}
            </div>
          </div>

          <Banner />
        </div>
      </div>
    </>
  );
}

export default function DragonTokenPage() {
  return <ThirdwebProvider><DragonApp /></ThirdwebProvider>;
}
