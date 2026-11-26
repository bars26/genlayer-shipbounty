// Deploys contracts/ship_bounty.py to GenLayer Studio and prints the address.
//
//   node scripts/deploy.mjs

import { readFileSync } from "fs";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const RPC = "https://studio.genlayer.com/api";
const account = createAccount(generatePrivateKey());
const client = createClient({ chain: studionet, endpoint: RPC, account });
const code = readFileSync(new URL("../contracts/ship_bounty.py", import.meta.url), "utf8");

await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sim_fundAccount", params: [account.address, 10 * 1e18] }) });
await new Promise((r) => setTimeout(r, 3000));
// GenLayer Studio (since 2026-11-24) needs a fee distribution with every transaction (genlayer-js 2.0).
const est = await client.estimateTransactionFees({ leaderTimeunitsAllocation: 300n, validatorTimeunitsAllocation: 300n });
const hash = await client.deployContract({ code, args: [], leaderOnly: false, fees: { distribution: est.distribution, feeValue: est.feeValue } });
console.log("deploy tx", hash);
const receipt = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 120, interval: 5000 });
const lr = receipt?.consensus_data?.leader_receipt;
const first = Array.isArray(lr) ? lr[0] : lr;
if (first?.execution_result !== "SUCCESS") {
  console.error("deploy executed with", first?.execution_result, JSON.stringify(first?.result ?? {}).slice(0, 300));
  process.exit(1);
}
console.log("contract", receipt.data?.contract_address ?? receipt.to_address ?? receipt.recipient);
