"use client";

import { useState } from "react";
import { ExternalLink, GitPullRequest, Loader2, Search, Smartphone, Tag } from "lucide-react";
import { appUrl, type Bounty, type IssuePreview } from "@/lib/contracts/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const EXAMPLES = [
  { label: "Ice Cubes #2512", q: "https://github.com/Dimillian/IceCubesApp/issues/2512" },
  { label: "Mastodon #511", q: "https://github.com/mastodon/mastodon-ios/issues/511" },
  { label: "Ice Cubes #2551 (open)", q: "https://github.com/Dimillian/IceCubesApp/issues/2551" },
];

export type OpenPrefill = { repo: string; issue: number; appleId: string };

/** Look at an issue before paying for a transaction: the fix, its release, the App Store version, the author's wallet. */
export function IssueCheck({ bounties, onOpen, onBack }: { bounties: Bounty[]; onOpen: (p: OpenPrefill) => void; onBack: (b: Bounty) => void }) {
  const [q, setQ] = useState(EXAMPLES[0].q);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [it, setIt] = useState<IssuePreview | null>(null);

  const look = async (query = q) => {
    setLoading(true);
    setErr("");
    setIt(null);
    try {
      const res = await fetch(`/api/issue?${new URLSearchParams({ q: query.trim() })}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setIt(body);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };
  const existing = it && bounties.find((b) => b.repo.toLowerCase() === it.repo.toLowerCase() && Number(b.issue) === it.number && (b.state === "open" || b.state === "held"));
  const step = (ok: boolean | null, label: string, detail: React.ReactNode, Icon: any) => (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ok === null ? "bg-muted text-muted-foreground" : ok ? "bg-[#E2F1E8] text-[#2E7D4F]" : "bg-[#FBE7E4] text-[#A7342A]"}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <div className="text-xs text-muted-foreground break-words">{detail}</div>
      </div>
    </li>
  );

  return (
    <div className="brand-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="display text-xl font-semibold flex items-center gap-2">
          <Search className="w-5 h-5" /> Check an issue
        </h2>
        <span className="text-xs text-muted-foreground">no wallet needed</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((x) => (
          <button
            key={x.label}
            type="button"
            className="rounded-full border border-border bg-white px-3 py-1 text-xs hover:bg-muted"
            onClick={() => {
              setQ(x.q);
              look(x.q);
            }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="github.com/owner/repo/issues/123" aria-label="GitHub issue" />
        <Button onClick={() => look()} disabled={loading} variant="outline">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Read
        </Button>
      </div>
      {err && <p className="text-sm text-[#A7342A]">{err}</p>}
      {it && (
        <div className="space-y-3">
          <p className="font-semibold">
            <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {it.repo}#{it.number}: {it.title} <ExternalLink className="inline w-3 h-3" />
            </a>
          </p>
          <ol className="space-y-2.5">
            {step(it.state === "closed" && it.reason === "completed", "Issue", it.state === "closed" ? `closed as ${it.reason || "closed"}` : "open", Search)}
            {step(
              it.change ? true : it.state === "closed" ? false : null,
              "The change that closed it",
              it.change ? (
                <a href={it.change.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {it.change.kind === "pr" ? `PR #${it.change.number}` : `commit ${it.change.sha.slice(0, 10)}`} by {it.change.author}: {it.change.title}, merged{" "}
                  {it.change.merged_at.replace("T", " ")} UTC
                </a>
              ) : (
                "none yet"
              ),
              GitPullRequest
            )}
            {step(it.release ? it.shipped : it.change ? false : null, "Release users have", it.release ? `${it.release.tag} (published ${it.release.published.slice(0, 10)})${it.shipped ? ", contains the change" : ""}` : "no release with the change for the App Store version", Tag)}
            {step(
              it.app ? it.shipped : null,
              "App Store",
              it.app ? (
                <a href={appUrl(it.app.id)} target="_blank" rel="noopener noreferrer" className="underline">
                  {it.app.name} {it.app.version} since {it.app.released.slice(0, 10)}
                  {it.app.how ? ` · the repo names this app (${it.app.how.replace("_", " ")})` : " · the repo does not name this app"}
                </a>
              ) : (
                "no App Store app named by the repository"
              ),
              Smartphone
            )}
          </ol>
          <p className="text-xs rounded-lg bg-muted/70 p-2">
            {it.note}
            {it.change ? ` Pays ${it.change.author}${it.wallet ? ` at ${it.wallet.slice(0, 6)}…${it.wallet.slice(-4)}` : " (no GenLayer wallet in their GitHub bio yet: held until they add one)"}.` : ""}
          </p>
          {existing ? (
            <Button size="sm" variant="outline" onClick={() => onBack(existing)}>
              Back {existing.id}
            </Button>
          ) : (
            it.app?.how && (
              <Button size="sm" onClick={() => onOpen({ repo: it.repo, issue: it.number, appleId: it.app!.id })}>
                Open a bounty on this issue
              </Button>
            )
          )}
          <p className="text-xs text-muted-foreground">This preview runs the contract&apos;s rules without validators or the model. A claim asks the validators for the real ruling.</p>
        </div>
      )}
    </div>
  );
}
