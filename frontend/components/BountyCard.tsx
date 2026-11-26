"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Smartphone } from "lucide-react";
import {
  CODE_LABEL,
  STAKE_DIVISOR,
  STATE_TEXT,
  VERDICT_STYLE,
  appUrl,
  backersOf,
  changeUrl,
  formatGen,
  issueUrl,
  parseGen,
  parseJson,
  readingOf,
  todayUtc,
  wei,
  type Bounty,
  type Claim,
  type Reading,
  type Recheck,
} from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { useShipWrite } from "@/lib/hooks/useShipBounty";
import { useNow } from "@/lib/hooks/useNow";
import { addressUrl, currentNetwork } from "@/lib/network";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

function ClaimRow({ claim: c, bounty: b }: { claim: Claim; bounty: Bounty }) {
  const now = useNow(30_000);
  const { isConnected } = useWallet();
  const { write, pending } = useShipWrite();
  const g = readingOf(c);
  const f = g.facts;
  const v = VERDICT_STYLE[c.verdict] ?? VERDICT_STYLE.UNCLEAR;
  const ripe = c.state === "held" && new Date(now).toISOString().slice(0, 19) >= c.held_until;
  const busy = (k: string) => pending === `${k}:${c.id}`;
  const dispute = c.dispute_json ? parseJson<Reading>(c.dispute_json, {}) : null;
  const confirm = c.confirm_json ? parseJson<Recheck>(c.confirm_json, {} as Recheck) : null;
  return (
    <li className="rounded-xl border border-border bg-white p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="mono text-muted-foreground">{c.id}</span>
        <span className={`rounded-full border px-2 py-0.5 font-medium ${v.cls}`}>{v.label}</span>
        <span className="text-muted-foreground">{CODE_LABEL[c.code] ?? c.code}</span>
        <span className="ml-auto font-medium">{c.state.replace("_", " ")}</span>
      </div>
      {f?.change && (
        <p>
          <a href={changeUrl(b.repo, f.change)} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
            {f.change.kind === "pr" ? `PR #${f.change.number}` : `commit ${f.change.sha.slice(0, 10)}`}: {f.change.title} <ExternalLink className="inline w-3 h-3" />
          </a>
          <span className="text-xs text-muted-foreground"> by {f.change.author}, merged {f.change.merged_at.replace("T", " ")} UTC</span>
        </p>
      )}
      {(f?.release?.tag || f?.app?.version) && (
        <p className="text-xs text-muted-foreground">
          {f?.release?.tag ? `In release ${f.release.tag}` : "No release with it"}
          {f?.app?.version ? ` · App Store ${f.app.version} since ${f.app.released.slice(0, 10)}` : ""}
        </p>
      )}
      {g.judged && (
        <p className="rounded-lg bg-muted/60 p-2 text-xs">
          <span className="font-medium">Model: {g.judged.delivers === "FULL" ? "delivers the issue" : g.judged.delivers === "PARTIAL" ? "delivers part of it" : "does not deliver it"}</span>
          {g.judged.reason ? <> · {g.judged.reason}</> : null}
        </p>
      )}
      {dispute && (
        <p className="rounded-lg bg-muted/60 p-2 text-xs">
          Disputed by <span className="mono">{short(c.disputed_by)}</span>
          {dispute.read_at ? ` at ${dispute.read_at.replace("T", " ")} UTC` : ""}: read again, {dispute.verdict === "SHIPPED" ? "it stands (dismissed)" : `${CODE_LABEL[dispute.code ?? ""] ?? "it does not stand"} (upheld)`}.
        </p>
      )}
      {confirm && (
        <p className="text-xs text-muted-foreground">
          Confirmed at {confirm.read_at?.replace("T", " ")} UTC: issue {confirm.still_closed ? "still closed" : "reopened"}, App Store {confirm.app_version}; wallet in{" "}
          {c.author}&apos;s GitHub bio: {confirm.wallet ? short(confirm.wallet) : "none yet"}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {STATE_TEXT[c.state]}
        {c.state === "held" ? ` (confirmable from ${c.held_until.replace("T", " ")} UTC)` : ""}
        {Number(c.amount) > 0 ? ` · ${formatGen(c.amount, 3)} GEN` : ""}
        {wei(c.bonus) > 0n ? ` + ${formatGen(c.bonus, 3)} GEN from a dismissed dispute` : ""} · claimed by <span className="mono">{short(c.claimer)}</span>
      </p>
      {isConnected && (
        <div className="flex flex-wrap gap-2">
          {ripe && (
            <Button size="sm" onClick={() => write({ kind: "confirm", claimId: c.id })} disabled={!!pending}>
              {busy("confirm") && <Loader2 className="w-4 h-4 animate-spin" />} Confirm (validators check it again)
            </Button>
          )}
          {c.state === "held" && !c.disputed_by && (
            <Button size="sm" variant="outline" onClick={() => write({ kind: "dispute", claimId: c.id })} disabled={!!pending}>
              {busy("dispute") && <Loader2 className="w-4 h-4 animate-spin" />} Dispute (stake {formatGen(wei(c.amount) / STAKE_DIVISOR, 3)} GEN)
            </Button>
          )}
          {c.state === "awaiting_wallet" && (
            <Button size="sm" variant="outline" onClick={() => write({ kind: "collect", claimId: c.id })} disabled={!!pending}>
              {busy("collect") && <Loader2 className="w-4 h-4 animate-spin" />} Send to the wallet in {c.author}&apos;s GitHub bio
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function BountyCard({ bounty: b, claims, highlight }: { bounty: Bounty; claims: Claim[]; highlight?: boolean }) {
  const { isConnected } = useWallet();
  const { write, pending } = useShipWrite();
  const [more, setMore] = useState("0.1");
  const net = currentNetwork();
  const ordered = [...claims].sort((x, y) => Number(y.id.split("_")[1]) - Number(x.id.split("_")[1]));
  const open = b.state === "open" && todayUtc() <= b.deadline;
  const total = wei(b.pot) + wei(b.reserved);
  const backers = backersOf(b);
  const extra = parseGen(more);
  return (
    <article className={`brand-card overflow-hidden ${highlight ? "ring-2 ring-[#0A84FF]" : ""}`}>
      <div className="p-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mono text-muted-foreground">{b.id}</span>
          <span className={`rounded-full border px-2 py-0.5 font-medium ${b.state === "paid" ? "bg-[#E2F1E8] text-[#2E7D4F] border-[#B9DBC6]" : b.state === "held" ? "bg-[#E6F0FF] text-[#0A5BC4] border-[#BCD6FB]" : open ? "bg-white text-foreground border-border" : "bg-muted text-muted-foreground"}`}>
            {b.state === "paid" ? "shipped & confirmed" : b.state === "held" ? "shipped: confirming" : b.state === "refunded" ? "refunded" : open ? "open" : "deadline passed"}
          </span>
          {b.retro && <span className="rounded-full bg-muted px-2 py-0.5">retroactive</span>}
        </div>
        <h3 className="display text-xl leading-snug">
          <a href={issueUrl(b)} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {b.title} <ExternalLink className="inline w-4 h-4" />
          </a>
        </h3>
        <p className="text-sm text-muted-foreground">
          {b.repo}#{String(b.issue)} ·{" "}
          <a href={appUrl(b.apple_id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 align-middle hover:underline">
            <Smartphone className="w-3.5 h-3.5" /> {b.app}
          </a>{" "}
          · claims until {b.deadline} · paid once the App Store version is out {String(b.survival_days)} days
          {b.prefix ? ` · tags ${b.prefix}…` : ""}
        </p>
        <dl className="grid grid-cols-3 gap-2 text-xs pt-1">
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-muted-foreground">bounty</dt>
            <dd className="display text-xl">{formatGen(total + wei(b.paid_total), 3)} GEN</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-muted-foreground">backers</dt>
            <dd className="display text-xl">{backers.length}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <dt className="text-muted-foreground">paid / returned</dt>
            <dd className="display text-xl">
              {formatGen(b.paid_total, 2)} / {formatGen(b.returned_total, 2)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Opened by{" "}
          <a href={addressUrl(net, b.opener)} target="_blank" rel="noopener noreferrer" className="mono hover:underline">
            {short(b.opener)}
          </a>{" "}
          on {b.opened_at.slice(0, 10)}
        </p>
        {isConnected && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {open && (
              <>
                <Button size="sm" onClick={() => write({ kind: "claim", bountyId: b.id })} disabled={!!pending}>
                  {pending === `claim:${b.id}` && <Loader2 className="w-4 h-4 animate-spin" />} Claim (validators read GitHub and the App Store)
                </Button>
                <div className="flex items-center gap-1">
                  <Input className="h-8 w-20" value={more} onChange={(e) => setMore(e.target.value)} inputMode="decimal" aria-label="Amount to add" />
                  <Button size="sm" variant="outline" disabled={!!pending || !extra || extra < 10n ** 16n} onClick={() => write({ kind: "back", bountyId: b.id, amount: extra! })}>
                    {pending === `back:${b.id}` && <Loader2 className="w-4 h-4 animate-spin" />} Add GEN
                  </Button>
                </div>
              </>
            )}
            {b.state === "open" && todayUtc() > b.deadline && (
              <Button size="sm" variant="outline" onClick={() => write({ kind: "refund", bountyId: b.id })} disabled={!!pending}>
                {pending === `refund:${b.id}` && <Loader2 className="w-4 h-4 animate-spin" />} Refund the backers
              </Button>
            )}
          </div>
        )}
      </div>
      {ordered.length > 0 && (
        <div className="border-t border-border bg-[#F7F9FC] p-5">
          <ul className="space-y-3">
            {ordered.map((c) => (
              <ClaimRow key={c.id} claim={c} bounty={b} />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
