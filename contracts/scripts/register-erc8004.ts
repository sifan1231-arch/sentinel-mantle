import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Mints the OFFICIAL ERC-8004 agent identity NFT on Mantle's canonical Identity Registry
 * (the 0x8004… CREATE2 deployment) and links it to our local DecisionRegistry agentId.
 *
 * This strengthens official "Feature #2: ERC-8004 agent identity". It is a BONUS step —
 * the core Sentinel flow already works with the local identity. The script is defensive:
 * if the canonical registry behaves differently than expected, it prints guidance and exits
 * without breaking anything.
 */
const IDENTITY_ABI = [
  "function register(string agentURI) returns (uint256)",
  "function register() returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

async function main() {
  const net = network.name;
  const file = path.resolve(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment at ${file}. Run "npm run deploy" first.`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));

  const identityAddr: string = d.erc8004?.identity;
  if (!identityAddr) throw new Error("No canonical ERC-8004 identity address for this network.");

  const [signer] = await ethers.getSigners();
  const code = await ethers.provider.getCode(identityAddr);
  if (code === "0x") {
    console.log(`\n⚠️  No contract found at the canonical ERC-8004 Identity Registry ${identityAddr} on ${net}.`);
    console.log("   The canonical 0x8004… registry may not be deployed on this testnet yet.");
    console.log("   Your LOCAL agent identity in DecisionRegistry already works — this step is optional.");
    return;
  }

  const agentURI = (process.env.AGENT_CARD_URI || "ipfs://sentinel-agent-card").trim();
  const reg = new ethers.Contract(identityAddr, IDENTITY_ABI, signer);

  console.log(`Registering official ERC-8004 identity on ${identityAddr} ...`);
  let receipt;
  try {
    const tx = await reg.getFunction("register(string)")(agentURI);
    console.log("  tx:", tx.hash);
    receipt = await tx.wait();
  } catch (e) {
    console.log("  register(string) reverted, trying register() ...", String((e as Error).message).split("\n")[0]);
    try {
      const tx2 = await reg.getFunction("register()")();
      console.log("  tx:", tx2.hash);
      receipt = await tx2.wait();
    } catch (e2) {
      console.log("\n⚠️  Could not auto-register on the canonical registry:", String((e2 as Error).message).split("\n")[0]);
      console.log("   This is non-fatal. Register manually via the Mantle hackathon flow, then run:");
      console.log(`   linkCanonical(localAgentId=${d.agentId}, registry=${identityAddr}, canonicalAgentId=<id>)`);
      return;
    }
  }

  // Parse the canonical agentId from the Registered event.
  let canonicalId: bigint | undefined;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = reg.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "Registered") {
        canonicalId = parsed.args[0] as bigint;
        break;
      }
    } catch {
      /* not our event */
    }
  }
  if (canonicalId === undefined) {
    console.log("  Registered, but could not parse the agentId from logs. Check the tx on the explorer.");
    return;
  }
  console.log(`  ✅ Official ERC-8004 agentId: ${canonicalId} (owner ${signer.address})`);

  // Link it into our DecisionRegistry so the on-chain decision log references the official identity.
  try {
    const local = await ethers.getContractAt("DecisionRegistry", d.addresses.registry, signer);
    const tx = await local.linkCanonical(d.agentId, identityAddr, canonicalId);
    await tx.wait();
    console.log(`  ✅ Linked local agentId ${d.agentId} → canonical ${canonicalId}`);
  } catch (e) {
    console.log("  ⚠️  Could not link canonical id locally:", String((e as Error).message).split("\n")[0]);
  }

  // Persist for the README / dashboard.
  d.erc8004.canonicalAgentId = Number(canonicalId);
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  console.log(`\n${d.explorer}/token/${identityAddr}?a=${canonicalId}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
