# ShipBounty

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)

<img src="assets/shipbounty-logo.png" alt="ShipBounty logo" width="80" align="right" />

**Issue bounties for open-source iOS apps, escrowed in GEN and paid when the fix ships: GenLayer validators follow
it from the GitHub issue to the change that closed it, to the release, to the version the App Store actually offers.**

Bounty platforms pay when a pull request is merged. Users of an app do not care about merges: a fix helps them when it
is in the version they can download, and for an iOS app that can be weeks later, or never (a release that fails App
Review, a branch that is abandoned). Open-source iOS apps publish everything needed to tell the difference: GitHub
records which change closed an issue and which release contains it, and Apple's App Store lookup says which version
users get and when it came out. ShipBounty turns that into a contract:

1. **Users back an issue** of an open-source iOS app: the repository, the issue number, the app's App Store id, a
   deadline and a survival period. Validators check that the **repository names that App Store app** (its README or
   homepage links the app's id, or the app's seller website is the repository's homepage), so a bounty cannot pay for
   one project with another app's releases. Anyone can add GEN to it. An issue already fixed makes the bounty
   **retroactive**: a thank-you for work done.
2. **A developer fixes it**; the maintainers merge the change and close the issue.
3. Anyone **claims**. **Every validator** reads:
   - the **issue**: closed as completed (not "not planned", not a duplicate);
   - the **change that closed it**: the commit on the issue's closing event (and that commit's pull request), or a
     merged pull request that says "fixes #N". On a bounty opened before the fix, only a change merged after the
     bounty counts;
   - the **App Store**: the version users get today and when it was released;
   - the **releases**: the newest published release whose version is at most the App Store's, and (with GitHub's
     compare) whether it contains the change. The App Store build must also be released after the merge;
   - the **model** reads the issue and the change and says whether the change delivers what was asked, in part, or
     not at all. Only a full delivery is paid.
4. A **shipped** claim **reserves** the pot. Until confirmation anyone may **dispute** it with 10% of the pot at stake:
   validators make the whole ruling again. Upheld: the stake back plus 10%, the rest returns to the bounty. Dismissed:
   the stake joins the author's payment.
5. Once the shipping App Store version has been out the **survival period**, anyone **confirms**: validators check the
   issue is still closed and the App Store still offers the release. The author of the change is paid at the
   **GenLayer wallet in their GitHub bio** ("GenLayer wallet: 0x…"); until they add one the payment is **held** and
   anyone can send it once the wallet appears; after 90 days it goes back to the backers. A bounty nobody claims by
   its deadline is refunded to every backer, pro rata. GEN leaves the contract only through `withdraw()`, to the caller.

**Live app:** [shipbounty-bars26.vercel.app](https://shipbounty-bars26.vercel.app). Paste any GitHub issue (or pick an
example) to see, without a wallet, the change that closed it, the release that has it, the App Store version and
whether the author has a wallet; then open, back or claim a bounty with MetaMask on GenLayer Studio and **Test GEN**
from the header.

**Contract (GenLayer Studio):** [`0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8`](https://explorer-studio.genlayer.com/address/0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8)
(`node scripts/verify-code.mjs 0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8` checks it is byte-identical to `contracts/ship_bounty.py`).

## Why GenLayer

- **"Shipped" is read from three independent records.** The issue tracker, the release history and the App Store are
  run by different parties; every validator reads all three itself. Neither the backer nor the developer supplies
  evidence, and a merged-but-unreleased fix is not paid.
- **Whether a change delivers an issue is a judgement.** A commit titled "Fix notifications" may or may not fix the
  refresh bug a user reported; a broad commit that closes ten issues may only touch one. The model reads the issue and
  the change; every validator must agree.
- **The model decides only what needs judgement.** The issue's state, the closing change, the versions, the compare,
  the dates, the wallet and every state change are code; validators must agree exactly on all of them and on the
  model's answer.

## Verified live, on real apps

`scripts/demo.mjs` ran ShipBounty on GenLayer Studio on 2026-11-26 with demo bounties (test wallets, test GEN; not
offers to these developers) on real issues of [Ice Cubes](https://github.com/Dimillian/IceCubesApp) and the
[official Mastodon iOS app](https://github.com/mastodon/mastodon-ios). Every transaction, ruling and reconciliation is
in [`docs/REPRODUCTION.md`](docs/REPRODUCTION.md).

| Claim | Issue (real) | Ruling |
|---|---|---|
| `claim_0` | Ice Cubes #2512, blocked and muted lists repeat the first page: PR #2514 by ivan-magda, in release 2.1.6, App Store 2.1.6 | **SHIPPED**; disputed, **dismissed** (the stake joined the payment); confirmed, 1.1 GEN held for the author's wallet |
| `claim_1` | Ice Cubes #2469, the Mac app doesn't display quoted posts (two backers): PR #2472, merged in August, in 2.1.6 | **SHIPPED**; confirmed, held for the author |
| `claim_2` | Mastodon #511, "always expand content warnings" not working: closed by commit c2990666 (no pull request), release 2026.08, App Store 2026.08 | **SHIPPED**; confirmed, held for the author |
| `claim_3` | Mastodon #297, a "show all media" setting: closed by the same commit | **SHIPPED** (the model found the commit also honours the media preference); reserved |
| `claim_4` | Mastodon #1554, refreshing notifications: closed as completed, but no commit or merged PR closed it | INELIGIBLE `no_change` |
| `claim_5` | Mastodon #1575: closed as not planned | INELIGIBLE `not_completed` |
| `claim_6` | Ice Cubes #2551: still open | INELIGIBLE `not_closed` |

- **Refused, taking nothing:** a bounty on NetNewsWire's repository with Ice Cubes' App Store id (the repository does not
  name that app), a second dispute of the same claim, sending a payment before the author has a wallet, refunding a
  bounty before its deadline, backing a bounty already paid out.
- `totals()` matched the contract's on-chain balance at **every** step, the last after the funder's withdrawal finalized.
- **A MetaMask test from the live app** (`docs/ui-test.json`): the tester opened their own retroactive bounty on Ice
  Cubes #2511 (`bounty_7`), claimed it (**SHIPPED**: PR #2513, in 2.1.6), confirmed it (held for the author's wallet)
  and backed `bounty_6`. Six transactions, all finalized; the books matched afterwards.
- GitHub's keyless limit refused a reading eight times during the run (the transaction is refused, nothing taken); each
  was sent again 15 minutes later and went through.

## Who can do what (and the attacks this blocks)

| Rule | Why |
|---|---|
| The repository must name the App Store app (README or homepage link to its id, or the seller website is the repo's homepage) | A bounty cannot be paid with another app's releases |
| The issue must be closed as completed, by a change GitHub links to it | "Not planned", duplicates and issues closed by hand are not paid |
| On a non-retroactive bounty, the change must be merged after the bounty opened | Nobody opens a bounty on work already done to pay themselves |
| The App Store's version must correspond to a published release that contains the change, and be released after the merge | Merged is not shipped; a build with the same number from before the merge does not count |
| The model must find the change delivers the whole issue | A partial or unrelated change is not paid |
| Payment only after the survival period, if the issue is still closed and the App Store still has the release | A fix reverted or pulled from the store is not paid |
| Disputes stake 10%; dismissed stakes go to the author | Challenging a good claim costs the challenger |
| Paid only to the wallet in the change author's own GitHub bio; two addresses count as none | Nobody can redirect a developer's payment, including the claimer |
| Unreadable GitHub or App Store responses decide nothing (the transaction is refused, nothing taken) | An outage or a rate limit never decides a payout |
| Pots come from deposits; every payment is credited; only `withdraw` sends GEN | No GEN rides on a reading, and no payout can fail halfway |
| `totals()` keeps running totals that must equal the contract's balance | Anyone can reconcile the books |

## Run it

```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
genvm-lint check contracts/ship_bounty.py
python -m pytest tests/direct -q                          # direct-mode tests (GitHub, the App Store and the model mocked)
npm install                                               # genlayer-js 2.0 (Studio charges a fee distribution on every transaction)
node scripts/deploy.mjs                                   # deploys to GenLayer Studio, prints the address
DEMO_KEYS=<file> node scripts/demo.mjs <address>          # the live run (paced for GitHub's keyless limit); writes docs/demo-run.json
node scripts/reproduction.mjs                             # renders docs/REPRODUCTION.md
node scripts/verify-code.mjs <address>
cd frontend && npm install && npm run dev                 # the app on localhost:3000 (GITHUB_TOKEN optional, for the preview only)
```

## Limits

- Validators read GitHub's keyless API, limited to 60 requests an hour per address and shared on Studio with every other
  contract. A reading GitHub refuses changes nothing; the claim can be sent again later. The contract keeps its calls
  low (the README from `raw.githubusercontent.com`, at most two compares per claim).
- iOS apps only, and only those whose releases on GitHub follow the App Store's version numbers (optionally with a tag
  prefix such as `iOS-`). Apps that ship from an untagged branch cannot be checked.
- The author paid is the author of the change GitHub links to the issue. Co-authors and reviewers are not paid; a
  maintainer who squash-merges someone else's work is credited only if GitHub keeps the original author.
- Developers do not put GenLayer wallets in their GitHub bios yet, so payments are held; the collect path is covered by
  the tests.
- GenLayer Studio. The source carries the Bradbury header switch used by our other contracts.

Issues, changes and releases are the projects' own public GitHub data; versions are from Apple's public App Store
lookup, read as published.
