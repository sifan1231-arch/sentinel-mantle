import { ethers } from "ethers";
import { RPC, CHAIN_ID, AGENT_PRIVATE_KEY, loadDeployment, SYMBOLS } from "./config";

export interface Chain {
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;
  d: any;
  oracle: any;
  vault: any;
  registry: any;
  tokens: Record<string, any>;
  decimals: Record<string, number>;
  addr: Record<string, string>;
  agentId: number;
}

export async function makeChain(): Promise<Chain> {
  const dep = loadDeployment();
  if (!dep.ok) throw new Error(dep.error);
  const { data, abis } = dep;

  if (!/^0x[0-9a-fA-F]{64}$/.test(AGENT_PRIVATE_KEY)) {
    throw new Error("Set a valid PRIVATE_KEY (or AGENT_PRIVATE_KEY) in .env (0x + 64 hex).");
  }

  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

  const oracle = new ethers.Contract(data.addresses.oracle, abis.SentinelOracle, wallet) as any;
  const vault = new ethers.Contract(data.addresses.vault, abis.SentinelVault, wallet) as any;
  const registry = new ethers.Contract(data.addresses.registry, abis.DecisionRegistry, wallet) as any;

  const tokens: Record<string, any> = {};
  const decimals: Record<string, number> = {};
  for (const sym of SYMBOLS) {
    const t = new ethers.Contract(data.addresses[sym], abis.MockERC20, wallet) as any;
    tokens[sym] = t;
    decimals[sym] = Number(await t.decimals());
  }

  return {
    provider,
    wallet,
    d: data,
    oracle,
    vault,
    registry,
    tokens,
    decimals,
    addr: data.addresses,
    agentId: Number(data.agentId),
  };
}
