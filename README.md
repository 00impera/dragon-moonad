<p align="center">
  <img src="https://raw.githubusercontent.com/00impera/dragon-moonad/b7e094df45b3a33ef5b310e925e1afd04ab8a5a6/3.png.png
" alt="DRAGON MOONAD" width="160" />
</p>

<h1 align="center">🐉 DRAGON MOONAD</h1>
<p align="center">
  <b>Revolutionary LP Mining Protocol on Monad Blockchain</b><br>
  <a href="https://dexscreener.com/monad/0x1b685B0c771b877d1a4e8F02365a4A809E962c81">
    <img src="https://api.dexscreener.com/latest/dex/tokens/0x1b685B0c771b877d1a4e8F02365a4A809E962c81/badge" alt="MONAD Price" />
  </a>
</p>

---

## 🌟 About

**DRAGON MOONAD** is a next-generation DeFi protocol offering liquidity mining rewards on the Monad blockchain. Stake LP tokens and earn 1 DRAGON per block.  
Now with a live dashboard, wallet connect, staking, rewards, and real-time stats!

---

## 📊 Token Information

- **Token Name:** DRAGON MOONAD
- **Symbol:** DRAGON
- **Total Supply:** 1,000,000 DRAGON
- **Network:** Monad (Chain ID: 143)
- **Token Contract:** [`0x1b685B0c771b877d1a4e8F02365a4A809E962c81`](https://dexscreener.com/monad/0x1b685B0c771b877d1a4e8F02365a4A809E962c81)
- **LP Mining Contract:** [`0x28840f3e117345A5FBF08b7F67503D2F47B28023`](https://sourcify.dev/#/lookup/0x28840f3e117345A5FBF08b7F67503D2F47B28023)

---

## 🔗 Links

- **Website / Dashboard:** [https://00impera.github.io/dragon-moonad](https://00impera.github.io/dragon-moonad)
- **Twitter:** [@bnbgold277983](https://x.com/bnbgold277983)
- **Telegram Bot:** [@DragonMonadBot](https://t.me/DragonMonadBot)
- **Discord:** [Community](https://discord.gg/xnDAuzd8)
- **MonadVision Analytics:** [View Token](https://monadvision.com/token/0x1b685B0c771b877d1a4e8F02365a4A809E962c81)
- **Explorer:** [MonadScan](https://monadscan.com/token/0x1b685B0c771b877d1a4e8F02365a4A809E962c81)

---

## 🛡️ Smart Contracts

- **Token Contract:**  
  `0x1b685B0c771b877d1a4e8F02365a4A809E962c81`  
  Verified: ✅ Sourcify Match ID 520026

- **LP Mining Contract:**  
  `0x28840f3e117345A5FBF08b7F67503D2F47B28023`  
  Verified: ✅ Sourcify Match ID 520027

---

## 🎯 Features

- ⚡ Lightning-fast transactions on Monad
- 💎 1 DRAGON reward per block
- 🔐 100% verified contracts
- 🛡️ Emergency withdraw capability
- 📊 Fair, proportional distribution
- 🌟 Community-driven development
- 🦊 **Wallet Connect** (MetaMask, Coinbase, Trust, Phantom, Rabby)
- 📈 **Live Stats & Charts** (price, liquidity, volume)
- 🏦 **Staking Widget** (stake, unstake, claim, see balances)
- 🪙 **Mint/Buy DRAGON** (directly from dashboard)
- 🧾 **Copy contract address** (one-click)
- ✨ **Animated UI** (star background, smooth scroll)

---

## 🚀 How to Use

1. **Add DRAGON + MONAD liquidity** on a Monad DEX (e.g. OctoSwap)
2. **Receive LP tokens**
3. **Go to the dashboard:** [https://00impera.github.io/dragon-moonad](https://00impera.github.io/dragon-moonad)
4. **Connect your wallet** (MetaMask, Coinbase, Trust, Phantom, Rabby)
5. **Stake LP tokens** in the mining contract
6. **Earn 1 DRAGON per block** (proportional to your share)
7. **Claim rewards** anytime from the dashboard

**Example:**  
If you stake 100 LP tokens out of 1,000 total (10%), you earn 0.1 DRAGON per block.

---

## 💰 Reward Formula

> **Your DRAGON per block = (Your LP tokens / Total LP tokens staked) × 1 DRAGON**

---

## 🖥️ Live Dashboard & Staking (thirdweb React Example)

Below is a simplified version of the main dApp logic from your `index.jsx`, using [thirdweb](https://thirdweb.com):

```jsx
import { useState } from "react";
import {
  ThirdwebProvider,
  ConnectButton,
  useActiveAccount,
  useReadContract,
  BuyWidget,
} from "thirdweb/react";
import {
  createThirdwebClient,
  defineChain,
  getContract,
} from "thirdweb";

const CLIENT_ID = "YOUR_CLIENT_ID";
const TOKEN_ADDRESS = "0x1b685B0c771b877d1a4e8F02365a4A809E962c81";
const MONAD_MAINNET = defineChain({ id: 143, name: "Monad", rpc: "https://rpc.monad.xyz" });
const client = createThirdwebClient({ clientId: CLIENT_ID });

function DragonApp() {
  const account = useActiveAccount();
  const contract = getContract({ client, chain: MONAD_MAINNET, address: TOKEN_ADDRESS });
  const { data: balance } = useReadContract({ contract, method: "balanceOf", params: [account?.address] });
  const { data: totalSupply } = useReadContract({ contract, method: "totalSupply" });

  return (
    <div>
      <img src="https://files.catbox.moe/byzt1g.png" alt="Dragon Logo" width={100} />
      <h2>🐉 DRAGON MOONAD Dashboard</h2>
      <ConnectButton client={client} chain={MONAD_MAINNET} />
      <div>Your DRAGON Balance: {balance?.toString() || "0"}</div>
      <div>Total Supply: {totalSupply?.toString() || "1,000,000"}</div>
      <BuyWidget client={client} chain={MONAD_MAINNET} tokenAddress={TOKEN_ADDRESS} />
    </div>
  );
}

export default function App() {
  return (
    <ThirdwebProvider>
      <DragonApp />
    </ThirdwebProvider>
  );
}
