// Renders docs/REPRODUCTION.md from docs/demo-run.json (written by scripts/demo.mjs) and, when present,
// docs/ui-test.json (a MetaMask run from the live app).
//
//   node scripts/reproduction.mjs

import { readFileSync, writeFileSync } from "fs";

const run = JSON.parse(readFileSync(new URL("../docs/demo-run.json", import.meta.url), "utf8"));
const EXPLORER = "https://explorer-studio.genlayer.com";
const tx = (h) => (h ? `[${h.slice(0, 10)}…](${EXPLORER}/tx/${h})` : "");
const gen = (w) => `${(Number(w ?? 0) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 4 })} GEN`;
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const js = (s) => { try { return JSON.parse(s || "{}"); } catch { return {}; } };
const gh = (repo) => `https://github.com/${repo}`;
const change = (repo, c) =>
  c ? `[${c.kind === "pr" ? `PR #${c.number}` : `commit ${c.sha.slice(0, 8)}`}](${c.kind === "pr" ? `${gh(repo)}/pull/${c.number}` : `${gh(repo)}/commit/${c.sha}`}) by ${esc(c.author)}, merged ${c.merged_at.replace("T", " ")}` : "—";

const bounties = Object.values(run.bounties).map((b) => {
  const backers = js(b.backers_json);
  return `| ${b.id} | [${esc(b.repo)}#${b.issue}](${gh(b.repo)}/issues/${b.issue}): ${esc(b.title)} | [${esc(b.app)}](https://apps.apple.com/app/id${b.apple_id}) | ${b.retro ? "yes" : "no"} | ${b.deadline}, ${b.survival_days} days | ${Array.isArray(backers) ? backers.length : 0} | ${gen(BigInt(b.pot) + BigInt(b.reserved) + BigInt(b.paid_total))} | ${b.state} |`;
});

const claims = Object.values(run.claims).map((c) => {
  const b = run.bounties[c.bounty_id];
  const g = js(c.reading_json);
  const f = g.facts || {};
  const rel = f.release?.tag ? `${f.release.tag} (${String(f.release.published || "").slice(0, 10)})` : "—";
  const app = f.app ? `${f.app.version} since ${String(f.app.released).slice(0, 10)}` : "—";
  const judged = g.judged ? `${g.judged.delivers}: ${esc(g.judged.reason).slice(0, 160)}` : "—";
  return `| ${c.id} (${c.bounty_id}) | ${f.issue_state ? `${f.issue_state}${f.reason ? ` as ${f.reason}` : ""}` : "—"} | ${change(b.repo, f.change)} | ${rel} | ${app} | ${judged} | **${c.verdict}** ${c.code} | ${c.state} |`;
});

const details = Object.values(run.claims).map((c) => {
  const g = js(c.reading_json);
  const d = c.dispute_json ? js(c.dispute_json) : null;
  const k = c.confirm_json ? js(c.confirm_json) : null;
  return `- **${c.id}** (${esc(run.claimLabels[c.id])}): ${esc(c.why)} Ruling packet sha256 \`${g.packet_sha256}\`, read at ${g.read_at} UTC.${d ? ` **Disputed** by \`${c.disputed_by}\` at ${d.read_at} UTC: read again, ${d.verdict === "SHIPPED" ? "DISMISSED (still shipped)" : `UPHELD (${d.code})`}${Number(c.bonus) ? `; the stake, ${gen(c.bonus)}, joined the author's payment` : ""}.` : ""}${k ? ` Confirmed at ${k.read_at} UTC: issue ${k.still_closed ? "still closed" : "reopened"}, App Store ${k.app_version}${k.in_store ? " (still has the release)" : ""}; GenLayer wallet in ${c.author}'s GitHub bio: ${k.wallet || "none yet"}; ${gen(BigInt(c.amount) + BigInt(c.bonus))} ${c.state === "paid" ? "paid" : "held for the author"}.` : ""}`;
});

const log = run.log.map((r) => `| ${r.who} | \`${esc(r.call).slice(0, 110)}\` | ${r.value === "0" ? "" : r.value} | ${r.status} | ${r.exec} | ${esc(r.refused ? `refused: ${r.refused}` : r.returned ?? "").slice(0, 150)} | ${tx(r.hash)} |`);
const recon = run.reconciliations.map((r) => {
  const pots = r.pots ?? (BigInt(r.expected) - BigInt(r.reserved) - BigInt(r.held) - BigInt(r.owed)).toString();
  return `| ${r.label} | ${gen(pots)} | ${gen(r.reserved)} | ${gen(r.held)} | ${gen(r.owed)} | ${gen(r.expected)} | ${gen(r.balance)} | ${r.ok ? "match" : "MISMATCH"} |`;
});

function check() {
  const c = Object.values(run.claims).find((x) => x.verdict === "SHIPPED");
  if (!c) return "";
  const b = run.bounties[c.bounty_id];
  const f = js(c.reading_json).facts || {};
  if (!f.change || !f.release?.tag) return "";
  return `Check one yourself: \`curl -s https://api.github.com/repos/${b.repo}/compare/${f.release.tag}...${f.change.sha} | grep -m1 '"status"'\`
(\`behind\` or \`identical\`: release ${f.release.tag} contains the change) and
\`curl -s "https://itunes.apple.com/lookup?id=${b.apple_id}" | grep -o '"version":"[^"]*"'\`.`;
}

let uiTest = "";
try {
  const ui = JSON.parse(readFileSync(new URL("../docs/ui-test.json", import.meta.url), "utf8"));
  uiTest = `## Wallet test from the live app

${ui.note} Wallet \`${ui.wallet}\`.

| Step | GEN sent | Result | Tx |
|---|---|---|---|
${ui.steps.map(([step, value, result, hash]) => `| ${esc(step)} | ${value} | ${esc(result)} | ${tx(hash)} |`).join("\n")}

`;
} catch {
  // no wallet test recorded
}

const md = `# ShipBounty: reproduction

Every ruling below was made by GenLayer validators on GenLayer Studio, reading GitHub's public API (the issue, the change
that closed it, the repository's releases and compares, the author's profile) and Apple's App Store lookup. Contract
\`${run.contract}\` ([explorer](${EXPLORER}/address/${run.contract})); \`node scripts/verify-code.mjs ${run.contract}\`
checks the deployed code is byte-identical to \`contracts/ship_bounty.py\`.

The bounties are **demo bounties** funded by test wallets with Studio test GEN: not offers to these developers. The
issues, pull requests, commits, releases and App Store versions are real.

## The bounties

| Bounty | Issue | App | Retroactive | Deadline, survival | Backers | Total | State |
|---|---|---|---|---|---|---|---|
${bounties.join("\n")}

## Every claim

| Claim | Issue | The change that closed it | Release users have | App Store | The model, on the change | Ruling | State |
|---|---|---|---|---|---|---|---|
${claims.join("\n")}

${details.join("\n")}

${check()}

${uiTest}## Every transaction

A refused call is still ACCEPTED by consensus; the contract outcome is the \`exec\` column (\`ERROR\` = refused, on purpose here).
GenLayer Studio charges a fee distribution on every transaction (since 2026-11-24); a withdrawal's GEN arrives when the
transaction is finalized.

| Who | Call | GEN sent | Consensus | exec | Returned / refused | Tx |
|---|---|---|---|---|---|---|
${log.join("\n")}

Accounts: ${Object.entries(run.accounts).map(([k, a]) => `${k} \`${a}\``).join(", ")}.

## Balance reconciliation

\`totals()\` keeps running totals (unreserved pots, reserved claims, payments held for an author's wallet, GEN credited
but not withdrawn); their sum must equal the contract's GEN balance on chain. Each line was taken once every transaction
had finalized.

| When | Pots | Reserved | Held | Credited | Expected | On-chain balance | |
|---|---|---|---|---|---|---|---|
${recon.join("\n")}
`;
writeFileSync(new URL("../docs/REPRODUCTION.md", import.meta.url), md);
console.log(`wrote docs/REPRODUCTION.md (${run.log.length} transactions)`);
