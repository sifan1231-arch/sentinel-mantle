# Mantle Mainnet RWA / Oracle / DEX addresses (verified) — for optional mainnet mode

> High-confidence, cross-checked against primary sources (Ondo docs, Ethena docs, Mantle official token list, Pyth docs, DEX docs, mantlescan). The default Sentinel build runs on **testnet with mock assets** and does NOT need these. They power: (a) the agent Scout's **real price feeds** (Pyth), and (b) the optional `MODE=mainnet` config. **Checksum-verify on mantlescan before sending real-value txs.**

## Yield / RWA assets (Mantle mainnet, chainId 5000)
| Symbol | Name | Address | Dec | Yield source |
|---|---|---|---|---|
| **USDY** | Ondo U.S. Dollar Yield | `0x5bE26527e817998A7206475496fDE1E68957c5A6` | 18 | Tokenized short-term US Treasuries + bank deposits (price-accruing) |
| **mETH** | Mantle Staked Ether | `0xcDA86A272531e8640cD7F1a92c01839911B90bb0` | 18 | ETH liquid-staking receipt (value-accruing vs ETH) |
| **cmETH** | Mantle Restaked ETH | `0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA` | 18 | mETH restaking (EigenLayer/Symbiotic/Karak + AVS) |
| **FBTC** | Ignition FBTC | `0xC96dE26018A54D51c097160568752c4E3BD6C364` | **8** | Omnichain wrapped/yield BTC |
| **USDe** | Ethena USDe | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` | 18 | Delta-neutral synthetic dollar |
| **sUSDe** | Ethena Staked USDe | `0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2` | 18 | Yield-bearing staked USDe (ERC-4626) |

> ⚠️ FBTC is **8 decimals** (BTC-style), not 18 — handle decimals dynamically (our contracts already read `decimals()`).

## Pyth oracle (the agent's REAL price source — no API key)
- Pyth contract Mantle **mainnet**: `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`
- Pyth contract Mantle **Sepolia**: `0x98046Bd286715D3B0BC227Dd7a956b83D8978603`
- Live prices (off-chain, no key): **Hermes** `https://hermes.pyth.network/v2/updates/price/latest?ids[]=<FEED_ID>`
- **Feed IDs (global, identical on every chain):**
  | Pair | Feed ID |
  |---|---|
  | ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
  | mETH/USD | `0xfbc9c3a716650b6e24ab22ab85b1c0ef4141b18f4590cc0b986e2f9064cf73d6` |
  | USDY/USD | `0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326` |
  | USDe/USD | `0x6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d` |
  | sUSDe/USD | `0xca3ba9a619a4b3755c10ac7d5e760275aa95e9823d38a84fedd416856cdba37c` |
  | BTC/USD (FBTC proxy) | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |

> mETH, USDY, USDe all have native Pyth feeds → the Scout pulls **real** mETH & USDY prices and pushes them into our testnet oracle. cmETH ≈ mETH price (1:1 receipt); FBTC ≈ BTC price (proxy).

## DEX routers (optional mainnet execution; Uniswap-style)
- **Merchant Moe** LB Router v2.2: `0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a` ; classic Moe Router: `0xeaEE7EE68874218c3558b40063c42B82D3E7232a`
- **Agni Finance** Swap Router: `0x319B69888b0d11cEC22caA5034e25FfFBDc88421`
- **FusionX** V3 SwapRouter: `0x5989FB161568b9F133eDf5Cf6787f5597762797F` ; SmartRouter: `0x4bf659cA398A73AaF73818F0c64c838B9e229c08`
- WMNT: `0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8`

## Mapping mock → real (mainnet mode)
`mUSD → USDe (or USDC)`, `mETH → mETH`, `mRWA → USDY`. Prices: real Pyth feeds for all three. Execution: route via Merchant Moe LB Router or Agni instead of `SentinelPool`.
