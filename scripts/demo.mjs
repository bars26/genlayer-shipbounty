// Live run of ShipBounty on GenLayer Studio over real open-source iOS apps: GitHub issues, the changes that closed
// them, GitHub releases and Apple's App Store lookup. Writes docs/demo-run.json.
//
//   DEMO_KEYS=<file> node scripts/demo.mjs <contract-address>
//
// The bounties are DEMO bounties funded by test wallets with Studio test GEN, not offers to these developers. The
// issues, pull requests, commits, releases and App Store versions are real.

import { writeFileSync } from "fs";
import { createAccount, generatePrivateKey } from "genlayer-js";
import { GEN, client, field, fund, log, read, reconcile, reconciliations, setContract, sleep, write } from "./studio.mjs";

const [CONTRACT] = process.argv.slice(2);
if (!CONTRACT) {
  console.error("usage: node scripts/demo.mjs <contract-address>");
  process.exit(1);
}
setContract(CONTRACT);
const keys = { funder: generatePrivateKey(), backer: generatePrivateKey(), scout: generatePrivateKey(), reviewer: generatePrivateKey() };
if (process.env.DEMO_KEYS) writeFileSync(process.env.DEMO_KEYS, JSON.stringify(keys));
const acct = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, createAccount(v)]));
const C = Object.fromEntries(Object.entries(acct).map(([k, a]) => [k, client(a)]));
console.log("contract  ", CONTRACT);
for (const [k, a] of Object.entries(acct)) console.log(k.padEnd(10), a.address);
await fund(acct.funder.address, 20n);
await fund(acct.backer.address, 5n);
await fund(acct.scout.address, 5n);
await fund(acct.reviewer.address, 3n);
await sleep(3000);

const ICE = ["Dimillian/IceCubesApp", "6444915884"];
const MASTODON = ["mastodon/mastodon-ios", "1571998974"];
const DEADLINE = "2027-02-28";
const half = GEN / 2n;
let nextBounty = (await read(C.funder, "get_bounties", [0, 100])).length;
let nextClaim = (await read(C.funder, "get_claims", [0, 200])).length;
const bounties = {};
const claims = {};
const open = async (label, [repo, apple], issue, amount, opts) => {
  await write(C.funder, "funder", "open_bounty", [repo, issue, apple, "", DEADLINE, 7, amount], 0n, opts);
  if (opts?.expectError) return null;
  const id = `bounty_${nextBounty++}`;
  bounties[id] = label;
  return id;
};
const claim = async (label, bountyId) => {
  // GitHub's keyless API allows each validator 60 requests an hour: if it says no, wait and try again.
  for (let attempt = 1; ; attempt++) {
    try {
      await write(C.scout, "scout", "claim", [bountyId]);
      break;
    } catch (err) {
      if (attempt >= 3 || !/ERROR/.test(String(err?.message))) throw err;
      console.log("  GitHub or Apple could not be read (rate limit?); waiting 10 minutes");
      await sleep(600_000);
    }
  }
  const id = `claim_${nextClaim++}`;
  const c = await read(C.funder, "get_claim", [id]);
  console.log(`  -> ${id} ${label}: ${field(c, "verdict")} ${field(c, "code")}. ${field(c, "why")}`);
  claims[id] = label;
  return id;
};

await write(C.funder, "funder", "deposit", [], 4n * GEN + half);
const b2512 = await open("Ice Cubes #2512: blocked and muted lists repeat the first page", ICE, 2512, GEN);
const b2469 = await open("Ice Cubes #2469: the Mac app doesn't display quoted posts", ICE, 2469, half);
const b511 = await open("Mastodon #511: 'always expand posts with content warnings' not working", MASTODON, 511, half);
const b297 = await open("Mastodon #297: a 'show all media' setting", MASTODON, 297, half);
const b1554 = await open("Mastodon #1554: refreshing notifications not reliable", MASTODON, 1554, half);
const b1575 = await open("Mastodon #1575: SerialStream leaks its scratch buffer (closed as not planned)", MASTODON, 1575, half);
const b2551 = await open("Ice Cubes #2551: ALT text in different languages (still open)", ICE, 2551, half);
// Refused before anything is taken: NetNewsWire's repository does not name Ice Cubes' App Store id.
await open("NetNewsWire repo with Ice Cubes' App Store id", ["Ranchero-Software/NetNewsWire", ICE[1]], 4700, half, { expectError: true });
// A second backer joins a bounty.
await write(C.backer, "backer", "deposit", [], half);
await write(C.backer, "backer", "back", [b2469, half]);
await reconcile(C.funder, "seven bounties backed, 0.5 GEN still credited to the funder");

const c2512 = await claim("Ice Cubes #2512 (PR #2514, release 2.1.6)", b2512);
const c2469 = await claim("Ice Cubes #2469 (PR #2472, release 2.1.4; App Store 2.1.6)", b2469);
const c511 = await claim("Mastodon #511 (closed by a commit, no PR; release 2026.08)", b511);
await claim("Mastodon #297 (closed by the same broad commit)", b297);
await claim("Mastodon #1554 (closed without a closing change)", b1554);
await claim("Mastodon #1575 (not planned)", b1575);
await claim("Ice Cubes #2551 (still open)", b2551);
await reconcile(C.funder, "shipped claims reserved");

// A reviewer disputes one shipped claim with a 10% stake: the whole ruling is made again. It stands: dismissed.
await write(C.reviewer, "reviewer", "deposit", [], GEN / 10n);
await write(C.reviewer, "reviewer", "dispute", [c2512]);
await write(C.reviewer, "reviewer", "dispute", [c2512], 0n, { expectError: true });
await reconcile(C.funder, "a dismissed dispute: the stake reserved for the author");

// Each shipping App Store version has been out a week: confirm. No author has a GenLayer wallet in their GitHub bio yet.
for (const id of [c2512, c2469, c511]) await write(C.scout, "scout", "confirm", [id]);
await write(C.scout, "scout", "collect", [c2512], 0n, { expectError: true });
await write(C.scout, "scout", "refund", [b2551], 0n, { expectError: true }); // its deadline is ahead
await write(C.backer, "backer", "back", [b2512, half], 0n, { expectError: true }); // paid bounties take no more backing
await reconcile(C.funder, "claims confirmed: the authors' payments held for their wallets");
await write(C.funder, "funder", "withdraw", []);
await reconcile(C.funder, "end of run, after the funder's withdrawal finalized");

const plain = (m) => JSON.parse(JSON.stringify(m instanceof Map ? Object.fromEntries(m) : m, (k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v)));
const out = { network: "studio", contract: CONTRACT, accounts: Object.fromEntries(Object.entries(acct).map(([k, a]) => [k, a.address])),
  bounties: {}, claims: {}, bountyLabels: bounties, claimLabels: claims, reconciliations, log };
for (const id of Object.keys(bounties)) out.bounties[id] = plain(await read(C.funder, "get_bounty", [id]));
for (const id of Object.keys(claims)) out.claims[id] = plain(await read(C.funder, "get_claim", [id]));
writeFileSync(new URL("../docs/demo-run.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("wrote docs/demo-run.json");
