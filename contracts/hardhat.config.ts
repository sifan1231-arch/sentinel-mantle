import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from the repo root (one level up) and from this package.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY?.trim() || "";
const accounts = PRIVATE_KEY && /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY) ? [PRIVATE_KEY] : [];

const MANTLE_SEPOLIA_RPC = process.env.MANTLE_SEPOLIA_RPC?.trim() || "https://rpc.sepolia.mantle.xyz";
const MANTLE_MAINNET_RPC = process.env.MANTLE_MAINNET_RPC?.trim() || "https://rpc.mantle.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // viaIR avoids "stack too deep" on the rich 12-field AgentDecision event
      // and generally produces better-optimized code.
      viaIR: true,
      // Mantle supports Cancun (EIP-4844) and beyond. Safe to target cancun.
      evmVersion: "cancun",
    },
  },
  networks: {
    // ---- Mantle Sepolia testnet (default deploy target) ----
    mantleSepolia: {
      url: MANTLE_SEPOLIA_RPC,
      chainId: 5003,
      accounts,
      // Mantle recommends maxPriorityFeePerGas = 0. Do NOT hard-cap gasLimit
      // (Mantle folds the L1 data fee into eth_estimateGas, so it looks large).
    },
    // ---- Mantle mainnet (optional) ----
    mantle: {
      url: MANTLE_MAINNET_RPC,
      chainId: 5000,
      accounts,
    },
  },
  // Etherscan API V2 (unified): one free key, chain selected by the chainid query param.
  etherscan: {
    apiKey: {
      mantleSepolia: ETHERSCAN_API_KEY,
      mantle: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=5003",
          browserURL: "https://sepolia.mantlescan.xyz",
        },
      },
      {
        network: "mantle",
        chainId: 5000,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=5000",
          browserURL: "https://mantlescan.xyz",
        },
      },
    ],
  },
  sourcify: { enabled: false },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
