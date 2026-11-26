/** Types and display helpers for the ShipBounty contract. */

type Num = string | number | bigint;

export type ClaimState = "held" | "paid" | "awaiting_wallet" | "reverted" | "disputed" | "returned" | "refused";
export type Verdict = "SHIPPED" | "INELIGIBLE" | "UNCLEAR";

export interface Bounty {
  id: string;
  opener: string;
  repo: string;
  issue: Num;
  title: string;
  apple_id: string;
  app: string;
  prefix: string;
  retro: boolean;
  opened_at: string;
  deadline: string;
  survival_days: Num;
  pot: Num;
  reserved: Num;
  paid_total: Num;
  returned_total: Num;
  backers_json: string;
  state: "open" | "held" | "paid" | "refunded";
  claim_id: string;
  history_json: string;
}

export interface Claim {
  id: string;
  bounty_id: string;
  claimer: string;
  verdict: Verdict;
  code: string;
  why: string;
  state: ClaimState;
  held_until: string;
  amount: Num;
  bonus: Num;
  author: string;
  author_wallet: string;
  version: string;
  reading_json: string;
  confirm_json: string;
  disputed_by: string;
  dispute_json: string;
  submitted_at: string;
}

export interface Reading {
  facts?: {
    title: string;
    issue_state: string;
    reason: string;
    closed_at: string;
    change?: { kind: "pr" | "commit"; number: number; sha: string; title: string; author: string; merged_at: string };
    release?: { tag?: string; published?: string; version?: string };
    app?: { version: string; released: string };
  };
  judged?: { delivers: "FULL" | "PARTIAL" | "NO"; reason: string };
  verdict?: Verdict;
  code?: string;
  read_at?: string;
  packet_sha256?: string;
}

export interface Recheck {
  still_closed: boolean;
  in_store: boolean;
  app_version: string;
  wallet: string;
  same: boolean;
  read_at?: string;
}

/** What the app's checker (no validators, no model) finds for an issue: see app/api/issue. */
export interface IssuePreview {
  repo: string;
  number: number;
  title: string;
  state: string;
  reason: string;
  url: string;
  app: { id: string; name: string; version: string; released: string; how: string } | null;
  change: { kind: "pr" | "commit"; number: number; sha: string; title: string; author: string; merged_at: string; url: string } | null;
  release: { tag: string; published: string } | null;
  shipped: boolean;
  wallet: string;
  note: string;
}

export const MIN_BACKING_WEI = 10n ** 16n;
/** A dispute stakes a tenth of the claim's amount from the disputer's credit. */
export const STAKE_DIVISOR = 10n;

export function wei(v: Num | undefined): bigint {
  try {
    return BigInt(String(v ?? "0").split(".")[0]);
  } catch {
    return 0n;
  }
}

export function formatGen(v: Num | undefined, digits = 2): string {
  const n = Number(wei(v)) / 1e18;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function parseGen(input: string): bigint | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18));
}

export function parseJson<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const todayUtc = () => new Date().toISOString().slice(0, 10);
export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? "" : new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}
export const nowIso = () => new Date().toISOString().slice(0, 19);
export const backersOf = (b: Bounty) => parseJson<[string, string][]>(b.backers_json, []);
export const readingOf = (c: Claim) => parseJson<Reading>(c.reading_json, {});
export const issueUrl = (b: Bounty) => `https://github.com/${b.repo}/issues/${String(b.issue)}`;
export const appUrl = (id: string) => `https://apps.apple.com/app/id${id}`;
export const changeUrl = (repo: string, ch: { kind: string; number: number; sha: string }) =>
  ch.kind === "pr" ? `https://github.com/${repo}/pull/${ch.number}` : `https://github.com/${repo}/commit/${ch.sha}`;

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  SHIPPED: { label: "Shipped", cls: "bg-[#E2F1E8] text-[#2E7D4F] border-[#B9DBC6]" },
  INELIGIBLE: { label: "Not a shipped fix", cls: "bg-[#FBE7E4] text-[#A7342A] border-[#F2C4BD]" },
  UNCLEAR: { label: "Not shipped yet", cls: "bg-[#E8EEF6] text-[#526175] border-[#D5DEEA]" },
};

export const STATE_TEXT: Record<ClaimState, string> = {
  held: "The pot is reserved until the shipping App Store version has been out the survival period",
  paid: "Paid to the GenLayer wallet in the author's GitHub bio",
  awaiting_wallet: "Confirmed: the payment waits for the author to add a GenLayer wallet to their GitHub bio",
  reverted: "At confirmation the issue was reopened or the App Store no longer had the release: the GEN went back to the bounty",
  disputed: "Disputed and upheld: the disputer got the stake back plus 10%, the rest went back to the bounty",
  returned: "Never collected: the payment went back to the backers",
  refused: "Nothing reserved; the bounty can be claimed again later",
};

export const CODE_LABEL: Record<string, string> = {
  shipped: "fix merged, released and live in the App Store",
  not_closed: "issue still open",
  not_completed: "closed as not planned or duplicate",
  no_change: "no commit or merged PR closed it",
  no_author: "the change has no GitHub author",
  before_bounty: "merged before the bounty opened",
  not_released: "no published release contains it yet",
  not_in_app_store: "the App Store does not have that release yet",
  not_delivered: "the change does not do what the issue asked",
  partial: "the change only partly does what the issue asked",
};
