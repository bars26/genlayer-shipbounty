# ShipBounty: reproduction

Every ruling below was made by GenLayer validators on GenLayer Studio, reading GitHub's public API (the issue, the change
that closed it, the repository's releases and compares, the author's profile) and Apple's App Store lookup. Contract
`0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8` ([explorer](https://explorer-studio.genlayer.com/address/0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8)); `node scripts/verify-code.mjs 0xBA2344C91B9dd284a82Ae692f11BfDB0756552f8`
checks the deployed code is byte-identical to `contracts/ship_bounty.py`.

The bounties are **demo bounties** funded by test wallets with Studio test GEN: not offers to these developers. The
issues, pull requests, commits, releases and App Store versions are real.

## The bounties

| Bounty | Issue | App | Retroactive | Deadline, survival | Backers | Backed | State |
|---|---|---|---|---|---|---|---|
| bounty_0 | [Dimillian/IceCubesApp#2512](https://github.com/Dimillian/IceCubesApp/issues/2512): Blocked and muted account lists repeat the first page | [Ice Cubes for Mastodon](https://apps.apple.com/app/id6444915884) | yes | 2027-02-28, 7 days | 1 | 1 GEN | confirmed: payment held for the author's wallet |
| bounty_1 | [Dimillian/IceCubesApp#2469](https://github.com/Dimillian/IceCubesApp/issues/2469): Bug: Mac app doesn't display quoted post | [Ice Cubes for Mastodon](https://apps.apple.com/app/id6444915884) | yes | 2027-02-28, 7 days | 2 | 1 GEN | confirmed: payment held for the author's wallet |
| bounty_2 | [mastodon/mastodon-ios#511](https://github.com/mastodon/mastodon-ios/issues/511): [BUG] Always expand posts marked with content warnings not working | [Mastodon](https://apps.apple.com/app/id1571998974) | yes | 2027-02-28, 7 days | 1 | 0.5 GEN | confirmed: payment held for the author's wallet |
| bounty_3 | [mastodon/mastodon-ios#297](https://github.com/mastodon/mastodon-ios/issues/297): Show all media setting | [Mastodon](https://apps.apple.com/app/id1571998974) | yes | 2027-02-28, 7 days | 1 | 0.5 GEN | held |
| bounty_4 | [mastodon/mastodon-ios#1554](https://github.com/mastodon/mastodon-ios/issues/1554): [BUG] Refreshing notifications not reliable | [Mastodon](https://apps.apple.com/app/id1571998974) | yes | 2027-02-28, 7 days | 1 | 0.5 GEN | open |
| bounty_5 | [mastodon/mastodon-ios#1575](https://github.com/mastodon/mastodon-ios/issues/1575): [BUG] SerialStream leaks its 5 MiB scratch buffer | [Mastodon](https://apps.apple.com/app/id1571998974) | yes | 2027-02-28, 7 days | 1 | 0.5 GEN | open |
| bounty_6 | [Dimillian/IceCubesApp#2551](https://github.com/Dimillian/IceCubesApp/issues/2551): Feature request: OpenAI ALT text in different languages | [Ice Cubes for Mastodon](https://apps.apple.com/app/id6444915884) | no | 2027-02-28, 7 days | 1 | 0.5 GEN | open |

## Every claim

| Claim | Issue | The change that closed it | Release users have | App Store | The model, on the change | Ruling | State |
|---|---|---|---|---|---|---|---|
| claim_0 (bounty_0) | closed as completed | [PR #2514](https://github.com/Dimillian/IceCubesApp/pull/2514) by ivan-magda, merged 2026-10-12 06:57:23 | 2.1.6 (2026-10-13) | 2.1.6 since 2026-10-14 | FULL: The change passes the saved Link-header cursor as max_id for subsequent blocked and muted account requests, fixing repeated first-page results, and adds tests f | **SHIPPED** shipped | awaiting_wallet |
| claim_1 (bounty_1) | closed as completed | [PR #2472](https://github.com/Dimillian/IceCubesApp/pull/2472) by SameerNadaf, merged 2026-08-22 10:39:32 | 2.1.6 (2026-10-13) | 2.1.6 since 2026-10-14 | FULL: The change directly fixes the reported bug where quoted posts do not display on macOS while preserving the correct behavior on iOS. | **SHIPPED** shipped | awaiting_wallet |
| claim_2 (bounty_2) | closed as completed | [commit c2990666](https://github.com/mastodon/mastodon-ios/commit/c299066652450c05bbfc54dd4f00a8e2ea373368) by whattherestimefor, merged 2026-10-15 21:20:22 | 2026.08 (2026-11-19) | 2026.08 since 2026-11-12 | FULL: The change explicitly makes content warning concealment respect the user's preference to always expand such posts. | **SHIPPED** shipped | awaiting_wallet |
| claim_3 (bounty_3) | closed as completed | [commit c2990666](https://github.com/mastodon/mastodon-ios/commit/c299066652450c05bbfc54dd4f00a8e2ea373368) by whattherestimefor, merged 2026-10-15 21:20:22 | 2026.08 (2026-11-19) | 2026.08 since 2026-11-12 | FULL: The change respects users’ web-configured content-warning preferences, allowing sensitive media to be shown by default rather than blurred. | **SHIPPED** shipped | held |
| claim_4 (bounty_4) | closed as completed | — | — | — | — | **INELIGIBLE** no_change | refused |
| claim_5 (bounty_5) | closed as not_planned | — | — | — | — | **INELIGIBLE** not_completed | refused |
| claim_6 (bounty_6) | open | — | — | — | — | **INELIGIBLE** not_closed | refused |

- **claim_0** (Ice Cubes #2512 (PR #2514, release 2.1.6)): SHIPPED: The issue was closed by a change that delivers it, and that change is in the release the App Store offers. PR #2514 by ivan-magda (Use the next-page cursor for blocked and muted accounts), merged 2026-10-12 06:57:23 UTC. In release 2.1.6. App Store: 2.1.6 since 2026-10-14. Model: FULL, The change passes the saved Link-header cursor as max_id for subsequent blocked and muted account requests, fixing repeated first-page results, and adds tests for both pagination flows. Ruling packet sha256 `75879c3775608d85681d187a45c3dbf7dd7b33a193bfafe52f0a4773f2d9c3d9`, read at 2026-11-26T07:25:39 UTC. **Disputed** by `0x24855b45735ac3a5ee3f1d9e11525ff7242cb396` at 2026-11-26T08:51:26 UTC: read again, DISMISSED (still shipped); the stake, 0.1 GEN, joined the author's payment. Confirmed at 2026-11-26T09:39:21 UTC: issue still closed, App Store 2.1.6 (still has the release); GenLayer wallet in ivan-magda's GitHub bio: none yet; 1.1 GEN held for the author.
- **claim_1** (Ice Cubes #2469 (PR #2472, in release 2.1.6 that the App Store offers)): SHIPPED: The issue was closed by a change that delivers it, and that change is in the release the App Store offers. PR #2472 by SameerNadaf (Fix quoted posts not displaying on macOS (#2469)), merged 2026-08-22 10:39:32 UTC. In release 2.1.6. App Store: 2.1.6 since 2026-10-14. Model: FULL, The change directly fixes the reported bug where quoted posts do not display on macOS while preserving the correct behavior on iOS. Ruling packet sha256 `5038e5a465c736e1f54a95b724ff652e3ceab1a269d4c146611f1beb4c7a7b7e`, read at 2026-11-26T07:42:35 UTC. Confirmed at 2026-11-26T09:40:32 UTC: issue still closed, App Store 2.1.6 (still has the release); GenLayer wallet in SameerNadaf's GitHub bio: none yet; 1 GEN held for the author.
- **claim_2** (Mastodon #511 (closed by a commit, no PR; release 2026.08)): SHIPPED: The issue was closed by a change that delivers it, and that change is in the release the App Store offers. commit c299066652 by whattherestimefor (Handle text content and media content concealment more distinctly), merged 2026-10-15 21:20:22 UTC. In release 2026.08. App Store: 2026.08 since 2026-11-12. Model: FULL, The change explicitly makes content warning concealment respect the user's preference to always expand such posts. Ruling packet sha256 `000a466416e4ade2cb2a08636ecfcbd726c7f54dafe979fe9616a4a35c85ca33`, read at 2026-11-26T08:29:28 UTC. Confirmed at 2026-11-26T09:41:57 UTC: issue still closed, App Store 2026.08 (still has the release); GenLayer wallet in whattherestimefor's GitHub bio: none yet; 0.5 GEN held for the author.
- **claim_3** (Mastodon #297 (closed by the same broad commit)): SHIPPED: The issue was closed by a change that delivers it, and that change is in the release the App Store offers. commit c299066652 by whattherestimefor (Handle text content and media content concealment more distinctly), merged 2026-10-15 21:20:22 UTC. In release 2026.08. App Store: 2026.08 since 2026-11-12. Model: FULL, The change respects users’ web-configured content-warning preferences, allowing sensitive media to be shown by default rather than blurred. Ruling packet sha256 `981c18ddb13dde87193382664b59cc2b9005dcc445075f790206041ae1a8f181`, read at 2026-11-26T08:30:47 UTC.
- **claim_4** (Mastodon #1554 (closed without a closing change)): INELIGIBLE: No commit or merged pull request closed the issue. Ruling packet sha256 `03671c7c7df7cbf42556ea7f9a4f64e6c0aac65bebe7677d0387a166e8ac5cdc`, read at 2026-11-26T08:32:11 UTC.
- **claim_5** (Mastodon #1575 (not planned)): INELIGIBLE: The issue was closed as not planned or a duplicate, not completed. Ruling packet sha256 `5554608b18daca7b8a421da13410a84ac1522750036c50ba7e8f0bafb4eb4ca1`, read at 2026-11-26T08:48:32 UTC.
- **claim_6** (Ice Cubes #2551 (still open)): INELIGIBLE: The issue is still open. Ruling packet sha256 `78a2d4eabe176e99622146d15c0257664573d9603be0b44cd71821bf6f11c445`, read at 2026-11-26T08:49:51 UTC.

Check one yourself: `curl -s https://api.github.com/repos/Dimillian/IceCubesApp/compare/2.1.6...ddadbfc8da3af1e83f0be35b090c870fa64daf5c | grep -m1 '"status"'`
(`behind` or `identical`: release 2.1.6 contains the change) and
`curl -s "https://itunes.apple.com/lookup?id=6444915884" | grep -o '"version":"[^"]*"'`.

## Wallet test from the live app

A MetaMask test from the live app (shipbounty-bars26.vercel.app) on 2026-11-26. The tester checked Ice Cubes #2511 (the posting progress timer kept running after submission) in the issue preview, opened a retroactive 0.2 GEN bounty on it (bounty_7), claimed it (SHIPPED: PR #2513 by ivan-magda, in release 2.1.6, App Store 2.1.6, the model FULL) and confirmed it (issue still closed, App Store still 2.1.6; no GenLayer wallet in the author's GitHub bio yet, so 0.2 GEN is held for them), then added 0.1 GEN to bounty_6. Six transactions, all FINALIZED with SUCCESS; afterwards totals() (4.9 GEN: pots 1.6 + reserved 0.5 + held 2.8) matched the contract's balance. Wallet `0x4f80b5c475fced34fc9a07ffccf39e1adc1406bf`.

| Step | GEN sent | Result | Tx |
|---|---|---|---|
| deposit() for the bounty | 0.2 | SUCCESS: 0.2 GEN credited | [0x25b5b8b3…](https://explorer-studio.genlayer.com/tx/0x25b5b8b39a02577ef5911279ae2f8e7a425a5cb68679f0a8f89a51375bf47534) |
| open_bounty("Dimillian/IceCubesApp", 2511, "6444915884", "", "2027-01-25", 7, 0.2 GEN) | 0 | SUCCESS: bounty_7, retroactive (the issue was already fixed) | [0xf4e54a4d…](https://explorer-studio.genlayer.com/tx/0xf4e54a4d1487b646f107b4a2c6166a265690234492c6851c38dd6f306fbc141e) |
| claim("bounty_7") | 0 | SHIPPED: PR #2513, release 2.1.6, App Store 2.1.6, model FULL; 0.2 GEN reserved | [0xd5374f09…](https://explorer-studio.genlayer.com/tx/0xd5374f09e73a0bcf57c2e1959b2c1e4f89158b873e0fa978017d543003081378) |
| confirm("claim_7") | 0 | SUCCESS: awaiting_wallet (still closed, still in the App Store; no wallet in ivan-magda's bio yet) | [0x8aedbeb1…](https://explorer-studio.genlayer.com/tx/0x8aedbeb18609c59efe9691a10001f9e1e807328d894e2a7ee80211199359cd18) |
| deposit() to back another bounty | 0.1 | SUCCESS: 0.1 GEN credited | [0xee5d80df…](https://explorer-studio.genlayer.com/tx/0xee5d80df903d9a926d9cc6e52856f78e1d9cff427186f9c74c6af9dc967bc17d) |
| back("bounty_6", 0.1 GEN) | 0 | SUCCESS: bounty_6 now 0.6 GEN from two backers | [0x33b6d0f8…](https://explorer-studio.genlayer.com/tx/0x33b6d0f8225b5f4f32f47752d1c3928ee8ac2f041879d70449cde5a68d2c39ca) |

## Every transaction

A refused call is still ACCEPTED by consensus; the contract outcome is the `exec` column (`ERROR` = refused, on purpose here).
GenLayer Studio charges a fee distribution on every transaction (since 2026-11-24); a withdrawal's GEN arrives when the
transaction is finalized.

| Who | Call | GEN sent | Consensus | exec | Returned / refused | Tx |
|---|---|---|---|---|---|---|
| funder | `deposit()` | 4.5 | ACCEPTED | SUCCESS | 4500000000000000000 | [0x900c5b5b…](https://explorer-studio.genlayer.com/tx/0x900c5b5bb3ee9d6c6f96685764d3ef8057f9620bba4f263c3ad79c54f8f68d7b) |
| funder | `open_bounty("Dimillian/IceCubesApp", 2512, "6444915884", "", "2027-02-28", 7, 1 GEN)` |  | ACCEPTED | SUCCESS | bounty_0 | [0xc72b1d8e…](https://explorer-studio.genlayer.com/tx/0xc72b1d8ebb1a69c666186513accfd2361c15e75330894d2092be8c1e62700594) |
| funder | `open_bounty("Dimillian/IceCubesApp", 2469, "6444915884", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_1 | [0xf18e03b3…](https://explorer-studio.genlayer.com/tx/0xf18e03b3538294f020204e8018cd2050f13c526f3c6d86d50bfdbea792fa07f7) |
| funder | `open_bounty("mastodon/mastodon-ios", 511, "1571998974", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_2 | [0x58629054…](https://explorer-studio.genlayer.com/tx/0x58629054a515f36273e599f6d489dc93f23dbeef43fdb295f24f6b52c45db497) |
| funder | `open_bounty("mastodon/mastodon-ios", 297, "1571998974", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_3 | [0xa267b7b7…](https://explorer-studio.genlayer.com/tx/0xa267b7b72cca3bdcdfd84e6d32aee46045c854f7ee16ffc5ed90daa0f89e177a) |
| funder | `open_bounty("mastodon/mastodon-ios", 1554, "1571998974", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_4 | [0x4eb30f12…](https://explorer-studio.genlayer.com/tx/0x4eb30f1296bdce9b86b6e5f9576fe7f672503f6152233a998087f83008884be2) |
| funder | `open_bounty("mastodon/mastodon-ios", 1575, "1571998974", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_5 | [0x479188f1…](https://explorer-studio.genlayer.com/tx/0x479188f1cc649c7dfb78b7d23677071cf2e1de04152d632993a7e43a5967b140) |
| funder | `open_bounty("Dimillian/IceCubesApp", 2551, "6444915884", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | SUCCESS | bounty_6 | [0x71b579cf…](https://explorer-studio.genlayer.com/tx/0x71b579cfef20e6edfc44c6a07ed73a3585ba75d4e900efac82d5864abbf99792) |
| funder | `open_bounty("Ranchero-Software/NetNewsWire", 4700, "6444915884", "", "2027-02-28", 7, 0.5 GEN)` |  | ACCEPTED | ERROR | refused: Ranchero-Software/NetNewsWire does not name App Store app 6444915884 (Ice Cubes for Mastodon) in its README or homepage | [0xf545455d…](https://explorer-studio.genlayer.com/tx/0xf545455d80bb5f8c10235791443df5fba668978c184cd8f000161698236c27a2) |
| backer | `deposit()` | 0.5 | ACCEPTED | SUCCESS | 500000000000000000 | [0xf9322971…](https://explorer-studio.genlayer.com/tx/0xf9322971e3caaee523e4f5378662349789ea9043284bf7ee5904beab03bf9105) |
| backer | `back("bounty_1", 0.5 GEN)` |  | ACCEPTED | SUCCESS | 1000000000000000000 | [0xb6cd80d7…](https://explorer-studio.genlayer.com/tx/0xb6cd80d7a5bdf1ad66deba6aa408f3c4286425b9cc9cd86ff8e323ff2fdc8c48) |
| scout | `claim("bounty_0")` |  | ACCEPTED | SUCCESS | claim_0 | [0x88947ef7…](https://explorer-studio.genlayer.com/tx/0x88947ef7d6a4688881ab5b87456a6209154e0b02e7a80c749c1452a0529d851b) |
| scout | `claim("bounty_1")` |  | ACCEPTED | ERROR |  | [0x2c339f3a…](https://explorer-studio.genlayer.com/tx/0x2c339f3acee7bbe14d8254f8e0583a1839b2eee21b27e6adc98be5f636167013) |
| scout | `claim("bounty_1")` |  | ACCEPTED | SUCCESS | claim_1 | [0x56a8c6ca…](https://explorer-studio.genlayer.com/tx/0x56a8c6cab5ba22f27b0320041bf00c4f63a7915e0d1fd2f260001ecd0223a822) |
| scout | `claim("bounty_2")` |  | ACCEPTED | ERROR |  | [0x5b284579…](https://explorer-studio.genlayer.com/tx/0x5b284579b95252a52cbe0d45228b317e3d1a4cb197fcad3baf4fce09ff1187e8) |
| scout | `claim("bounty_2")` |  | ACCEPTED | ERROR |  | [0xf8942fde…](https://explorer-studio.genlayer.com/tx/0xf8942fdec03c41f947bc0853c3ea49e14a6c8e0f8e81f8d7c8bfee410d218fde) |
| scout | `claim("bounty_2")` |  | ACCEPTED | ERROR |  | [0xe3cc0a93…](https://explorer-studio.genlayer.com/tx/0xe3cc0a9333110152a2e4deebd50222e60b562e8bc05d9061dbfdb4a3a5869fb1) |
| scout | `claim("bounty_2")` |  | ACCEPTED | SUCCESS | claim_2 | [0x06c69ba1…](https://explorer-studio.genlayer.com/tx/0x06c69ba169179cada2b539dd1d33c8a97f5adc3b2ed872d3bc0cc314d674ad65) |
| scout | `claim("bounty_3")` |  | ACCEPTED | SUCCESS | claim_3 | [0xde7fea51…](https://explorer-studio.genlayer.com/tx/0xde7fea51eb522f75c31b0d2d8c8554512f31383198f0e64a73998345cede0367) |
| scout | `claim("bounty_4")` |  | ACCEPTED | SUCCESS | claim_4 | [0xe268a5d3…](https://explorer-studio.genlayer.com/tx/0xe268a5d3b76ab10546c213d799aa112265195baace21fe9eab4885f8a0365ed0) |
| scout | `claim("bounty_5")` |  | ACCEPTED | ERROR |  | [0x178dcd3e…](https://explorer-studio.genlayer.com/tx/0x178dcd3e01fbd59c00733c3155a58e04eb473f41eeb7283c0d63b96527ebd729) |
| scout | `claim("bounty_5")` |  | ACCEPTED | SUCCESS | claim_5 | [0x4469180b…](https://explorer-studio.genlayer.com/tx/0x4469180b474b79e181b5b9f7d8c7ce233a3315fbd8f75bf7e77b3ed3b1f50a47) |
| scout | `claim("bounty_6")` |  | ACCEPTED | SUCCESS | claim_6 | [0x49c9de37…](https://explorer-studio.genlayer.com/tx/0x49c9de371780a03cc93779df455ade06f3744683eb22361eeeb9b3baf0e9fedc) |
| reviewer | `deposit()` | 0.1 | ACCEPTED | SUCCESS | 100000000000000000 | [0x1f1b4157…](https://explorer-studio.genlayer.com/tx/0x1f1b4157a2ca3e62b110eaf34879bc6b54fabb8f9768fc0959eb5c68af1a5902) |
| reviewer | `dispute("claim_0")` |  | ACCEPTED | SUCCESS | DISMISSED | [0xfd6c491e…](https://explorer-studio.genlayer.com/tx/0xfd6c491ee3ef2a4d4ca7bbfc8d3a7a8c056ebd8df56a706829c154595cc0c4de) |
| reviewer | `dispute("claim_0")` |  | ACCEPTED | ERROR | refused: This claim has been disputed already | [0xa5dc268f…](https://explorer-studio.genlayer.com/tx/0xa5dc268f7f09aa74f0fbd6765ac1e132366c63336fa9a732153b39df95293371) |
| scout | `confirm("claim_0")` |  | ACCEPTED | ERROR |  | [0x1c00b564…](https://explorer-studio.genlayer.com/tx/0x1c00b56404e2b26633d8679e68f59fdb1e7484ffde878c5f78f67830ddf76f35) |
| scout | `confirm("claim_0")` |  | ACCEPTED | ERROR |  | [0xaec829d8…](https://explorer-studio.genlayer.com/tx/0xaec829d81b43a5f143829701128ab6b6a33144c6c5bb942aeb8b5e61dee16ff6) |
| scout | `confirm("claim_0")` |  | ACCEPTED | ERROR |  | [0x386373df…](https://explorer-studio.genlayer.com/tx/0x386373dfaa0e24c8dec36c724e8fcab167f0eb6e625a93ae007bfb4109970c05) |
| scout | `confirm("claim_0")` |  | ACCEPTED | SUCCESS | awaiting_wallet | [0x6a0ed87e…](https://explorer-studio.genlayer.com/tx/0x6a0ed87e768c407f47fe92fc907b87588c92b510f485571cd1777c723fd25ba9) |
| scout | `confirm("claim_1")` |  | ACCEPTED | SUCCESS | awaiting_wallet | [0xdf808fc6…](https://explorer-studio.genlayer.com/tx/0xdf808fc6ef591342732c54de2665ec1df9c1c2da0f3b94dae19742de15f71fe8) |
| scout | `confirm("claim_2")` |  | ACCEPTED | SUCCESS | awaiting_wallet | [0x02623b88…](https://explorer-studio.genlayer.com/tx/0x02623b88e5efe201f99b963e7d5f08fdda29d131736b827135122f78e1242059) |
| scout | `collect("claim_0")` |  | ACCEPTED | ERROR | refused: ivan-magda's GitHub bio does not declare one GenLayer wallet yet | [0xa69baa2b…](https://explorer-studio.genlayer.com/tx/0xa69baa2b959655d7c80d73ea8d7bfdc8f58c2bec2e16b6baf33f1e3b576264ad) |
| scout | `refund("bounty_6")` |  | ACCEPTED | ERROR | refused: The bounty takes claims until 2027-02-28 | [0xf7ab1fe6…](https://explorer-studio.genlayer.com/tx/0xf7ab1fe673aa6b3aac5b2faa14a56d27a6457a327a1fe1b613fea6921d7096c2) |
| backer | `back("bounty_0", 0.5 GEN)` |  | ACCEPTED | ERROR | refused: This bounty takes no more backing | [0xb3717eee…](https://explorer-studio.genlayer.com/tx/0xb3717eeea85ad251152a63e34d03ea8fa0424442c6e8350ac6ceb29e5033862d) |
| funder | `withdraw()` |  | ACCEPTED | SUCCESS | 500000000000000000 | [0xcc7fb21b…](https://explorer-studio.genlayer.com/tx/0xcc7fb21bda4e66078975f61eacb8962ad1edf8e1136adbba1793f5f0dc23010c) |

Accounts: funder `0x0BDe871a2ACaF8d6fe152A31c94c23C626E141Db`, backer `0x424152ae28678fA4AcA7BC29b86038DaCDCb7F70`, scout `0x7da5F1742EBAe8FBB2d1B611a1F700101FC54E2b`, reviewer `0x24855b45735AC3a5eE3f1d9E11525ff7242cb396`.

## Balance reconciliation

`totals()` keeps running totals (unreserved pots, reserved claims, payments held for an author's wallet, GEN credited
but not withdrawn); their sum must equal the contract's GEN balance on chain. Each line was taken once every transaction
had finalized.

| When | Pots | Reserved | Held | Credited | Expected | On-chain balance | |
|---|---|---|---|---|---|---|---|
| seven bounties backed, 0.5 GEN still credited to the funder | 4.5 GEN | 0 GEN | 0 GEN | 0.5 GEN | 5 GEN | 5 GEN | match |
| shipped claims reserved | 1.5 GEN | 3 GEN | 0 GEN | 0.5 GEN | 5 GEN | 5 GEN | match |
| a dismissed dispute: the stake reserved for the author | 1.5 GEN | 3.1 GEN | 0 GEN | 0.5 GEN | 5.1 GEN | 5.1 GEN | match |
| claims confirmed: the authors' payments held for their wallets | 1.5 GEN | 0.5 GEN | 2.6 GEN | 0.5 GEN | 5.1 GEN | 5.1 GEN | match |
| end of run, after the funder's withdrawal finalized | 1.5 GEN | 0.5 GEN | 2.6 GEN | 0 GEN | 4.6 GEN | 4.6 GEN | match |
