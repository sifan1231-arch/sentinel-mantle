import { ethers } from "ethers";
import { MANTLE_MAINNET_RPC, METH_MAINNET } from "../config";
import { mean, std } from "../util";
import type { OnchainFlow } from "../types";

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const IFACE = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const LARGE_METH = 25; // a "whale" transfer threshold (~$75k)

/**
 * Reads REAL mETH transfer flow on Mantle MAINNET (regardless of where the agent executes),
 * so the Scout's anomaly/flow signals are grounded in genuine Mantle on-chain data.
 * Fully graceful: if a public RPC limits the log range, it shrinks the window or returns neutral.
 */
export async function readMantleFlow(): Promise<OnchainFlow> {
  const neutral: OnchainFlow = {
    ok: false,
    latestBlock: 0,
    blockSpan: 0,
    txCount: 0,
    totalVolume: 0,
    largeTransferCount: 0,
    largeTransferVolume: 0,
    whaleZ: 0,
    topTransfers: [],
    note: "on-chain read unavailable",
  };

  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_MAINNET_RPC, 5000);
    const latest = await provider.getBlockNumber();

    let logs: ethers.Log[] = [];
    let span = 0;
    for (const s of [600, 200, 50]) {
      try {
        logs = await provider.getLogs({
          address: METH_MAINNET,
          topics: [TRANSFER_TOPIC],
          fromBlock: latest - s,
          toBlock: latest,
        });
        span = s;
        break;
      } catch {
        /* try a smaller window */
      }
    }

    if (!logs.length) {
      return { ...neutral, ok: true, latestBlock: latest, blockSpan: span, note: "no mETH transfers in window" };
    }

    const xfers = logs
      .map((l) => {
        try {
          const p = IFACE.parseLog({ topics: l.topics as string[], data: l.data });
          return { from: p!.args[0] as string, to: p!.args[1] as string, amount: Number(ethers.formatUnits(p!.args[2] as bigint, 18)) };
        } catch {
          return null;
        }
      })
      .filter((x): x is { from: string; to: string; amount: number } => x !== null);

    const amounts = xfers.map((x) => x.amount);
    const total = amounts.reduce((a, b) => a + b, 0);
    const large = xfers.filter((x) => x.amount >= LARGE_METH);
    const largeVol = large.reduce((a, b) => a + b.amount, 0);
    const maxAmt = amounts.length ? Math.max(...amounts) : 0;
    const sd = std(amounts);
    const whaleZ = sd > 0 ? (maxAmt - mean(amounts)) / sd : 0;
    const top = [...xfers].sort((a, b) => b.amount - a.amount).slice(0, 3);

    return {
      ok: true,
      latestBlock: latest,
      blockSpan: span,
      txCount: xfers.length,
      totalVolume: total,
      largeTransferCount: large.length,
      largeTransferVolume: largeVol,
      whaleZ,
      topTransfers: top,
      note: `mETH flow on Mantle mainnet — ${xfers.length} transfers / ${span} blocks`,
    };
  } catch {
    return neutral;
  }
}
