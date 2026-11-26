// Shared helpers for the GenLayer Studio scripts: retrying writes and reads, Studio's test faucet, balance checks.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

let CONTRACT = "";
export const setContract = (address) => { CONTRACT = address; };
export function client(account) {
  return createClient({ chain: studionet, endpoint: RPC, account });
}

export const RPC = "https://studio.genlayer.com/api";
export const GEN = 10n ** 18n;
export const WINDOW_MS = 600_000;


export async function rpc(method, params) {
  // Studio sometimes answers with an HTML error page; these calls are reads or idempotent top-ups, so retry them.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = await res.json();
      if (body.error) throw new Error(`${method}: ${body.error.message}`);
      return body.result;
    } catch (err) {
      if (attempt >= 5 || /^\w+: /.test(String(err?.message))) throw err;
      await new Promise((r) => setTimeout(r, 10000 * attempt));
    }
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GenLayer Studio (since 2026-11-24) needs a fee distribution with every transaction (genlayer-js 2.0): time each
// validator phase may take, in seconds; reading GitHub, Apple and the model gets more.
const TIME = { open_bounty: 200n, claim: 500n, confirm: 300n, dispute: 500n, collect: 200n };
export async function feesFor(c, functionName) {
  const est = await c.estimateTransactionFees({ leaderTimeunitsAllocation: TIME[functionName] ?? 120n, validatorTimeunitsAllocation: TIME[functionName] ?? 120n });
  return { distribution: est.distribution, feeValue: est.feeValue };
}
export const log = [];
const TRANSIENT = /rate limit|Unexpected token '<'|not valid JSON|fetch failed|ECONNRESET|socket hang up|50[234]/i;

export async function write(c, who, functionName, args, value = 0n, { expectError = false } = {}) {
  const from = c.account.address;
  for (let attempt = 1; ; attempt++) {
    const nonceBefore = BigInt(await rpc("eth_getTransactionCount", [from, "latest"]));
    try {
      let hash;
      try {
        hash = await c.writeContract({ address: CONTRACT, functionName, args, value, fees: await feesFor(c, functionName) });
      } catch (err) {
        // The RPC sometimes answers a send with an HTML error page. Only resend if the
        // nonce did not move; otherwise the first send went through and we pick it up.
        if (!TRANSIENT.test(String(err?.message || err))) throw err;
        await sleep(15000);
        const nonceAfter = BigInt(await rpc("eth_getTransactionCount", [from, "latest"]));
        if (nonceAfter === nonceBefore) throw err;
        const txs = await rpc("sim_getTransactionsForAddress", [from]);
        hash = txs.filter((t) => (t.from_address || "").toLowerCase() === from.toLowerCase()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0].hash;
        console.log(`  send answered with an error page but the tx exists: ${hash}`);
      }
      // Once a hash exists, only the wait is retried; the transaction is never sent twice.
      let receipt;
      for (let wait = 1; ; wait++) {
        try {
          receipt = await c.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 150, interval: 6000 });
          break;
        } catch (err) {
          if (!TRANSIENT.test(String(err?.message || err)) || wait >= 6) throw Object.assign(err, { sent: true });
          await sleep(10000 * wait);
        }
      }
      // A receipt can be ACCEPTED while leaders are still rotating: wait until the last round is Accepted or Undetermined.
      let rounds = receipt?.consensus_history?.consensus_results ?? [];
      for (let poll = 0; rounds.length && !["Accepted", "Undetermined"].includes(rounds.at(-1)?.consensus_round) && poll < 60; poll++) {
        await sleep(5000);
        try { rounds = (await c.getTransaction({ hash }))?.consensus_history?.consensus_results ?? rounds; } catch {}
      }
      const lr = receipt?.consensus_data?.leader_receipt;
      const first = Array.isArray(lr) ? lr[0] : lr;
      const exec = rounds.length && rounds.at(-1)?.consensus_round === "Undetermined" ? "UNDETERMINED" : first?.execution_result ?? "?";
      let returned = first?.result?.payload?.readable;
      try { returned = JSON.parse(returned); } catch {}
      const row = {
        who,
        call: `${functionName}(${args.map((a) => (typeof a === "bigint" ? `${Number(a) / 1e18} GEN` : JSON.stringify(a)).slice(0, 60)).join(", ")})`,
        value: (Number(value) / 1e18).toString(),
        hash,
        status: receipt.statusName ?? receipt.status_name ?? "ACCEPTED",
        exec,
        returned: typeof returned === "string" ? returned : undefined,
      };
      log.push(row);
      console.log(`${row.who.padEnd(11)} ${row.call.padEnd(58)} ${row.status.padEnd(9)} ${row.exec.padEnd(7)} ${hash}${row.returned ? "  -> " + row.returned.slice(0, 160) : ""}`);
      if (expectError) {
        if (exec !== "ERROR") throw new Error(`${functionName} was expected to be refused but executed with ${exec}`);
        const msg = typeof first?.result?.payload === "string" ? first.result.payload : "";
        row.refused = msg;
        console.log(`  -> refused as designed: ${msg}`);
        return row;
      }
      if (exec !== "SUCCESS") throw new Error(`${functionName} executed with ${exec}`);
      return row;
    } catch (err) {
      const msg = String(err?.message || err);
      if (TRANSIENT.test(msg) && attempt < 5 && !err?.sent) {
        console.log(`  transient RPC error (${msg.slice(0, 60)}), waiting ${15 * attempt}s`);
        await sleep(15000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

export async function read(c, functionName, args = []) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await c.readContract({ address: CONTRACT, functionName, args });
    } catch (err) {
      if (TRANSIENT.test(String(err?.message)) && attempt < 6) {
        await sleep(15000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

export const balance = async (addr) => BigInt(await rpc("eth_getBalance", [addr, "latest"]));
export const fmt = (wei) => (Number(wei) / 1e18).toFixed(2);
export const fund = async (addr, gen) => rpc("sim_fundAccount", [addr, Number(gen * GEN)]);
export const field = (obj, name) => (obj instanceof Map ? obj.get(name) : obj[name]);



// GEN leaves the contract only through withdraw(); its transfer runs once the withdraw is finalized, so compare
// balances only when nothing touching the contract is in flight.
export async function quiet() {
  let last = -1;
  for (let i = 0; i < 90; i++) {
    const txs = await rpc("sim_getTransactionsForAddress", [CONTRACT]);
    const busy = txs.filter((t) => t.status !== "FINALIZED" && t.status !== "CANCELED" && t.status !== "UNDETERMINED").length;
    if (busy === 0 && txs.length === last) return txs.length;
    last = busy === 0 ? txs.length : -1;
    await sleep(10000);
  }
  throw new Error("transactions did not finalize");
}

export const reconciliations = [];
export async function reconcile(c, label) {
  await quiet();
  const t = JSON.parse(await read(c, "totals"));
  const onChain = await balance(CONTRACT);
  const ok = BigInt(t.expected_balance) === onChain;
  reconciliations.push({ label, budgets: t.budgets, reserved: t.reserved, held: t.held, owed: t.owed, expected: t.expected_balance, balance: onChain.toString(), ok });
  console.log(`  reconcile (${label}): budgets ${fmt(t.budgets)} + reserved ${fmt(t.reserved)} + held ${fmt(t.held)} + credited ${fmt(t.owed)} = ${fmt(t.expected_balance)} GEN; contract balance ${fmt(onChain)} GEN ${ok ? "OK" : "MISMATCH"}`);
  if (!ok) throw new Error("balance mismatch");
}
