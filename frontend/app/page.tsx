"use client";

import { useState } from "react";
import { CircleDollarSign, GitMerge, Loader2, RefreshCw, Smartphone, Wallet } from "lucide-react";
import { BountyCard } from "@/components/BountyCard";
import { IssueCheck, type OpenPrefill } from "@/components/IssueCheck";
import { Navbar } from "@/components/Navbar";
import { OpenBountyModal } from "@/components/OpenBountyModal";
import { OwedCard } from "@/components/OwedCard";
import { TransactionPanel } from "@/components/TransactionPanel";
import { Button } from "@/components/ui/button";
import { formatGen, wei } from "@/lib/contracts/types";
import { useRegistry } from "@/lib/hooks/useShipBounty";

const STEPS = [
  { icon: CircleDollarSign, title: "Back an issue", body: "Users put GEN on a GitHub issue of an open-source iOS app: a bug they want fixed or a feature they want. Anyone can add to it." },
  { icon: GitMerge, title: "A developer fixes it", body: "Someone writes the change; the maintainers merge it and close the issue. Merged is not shipped yet." },
  { icon: Smartphone, title: "It ships", body: "Validators read the issue, the change, GitHub's releases and the App Store: the version users have must contain the fix. The model checks the change delivers the issue." },
  { icon: Wallet, title: "The author is paid", body: "After a week in the App Store (and a stake-backed dispute window) the bounty goes to the GenLayer wallet in the author's GitHub bio." },
];

export default function HomePage() {
  const { bounties, claims, isLoading, isError, error, isFetching, refetch, fetchedAt } = useRegistry();
  const [modal, setModal] = useState(false);
  const [prefill, setPrefill] = useState<OpenPrefill | null>(null);
  const [focus, setFocus] = useState("");
  const ordered = [...bounties].sort((a, b) => Number(b.id.split("_")[1]) - Number(a.id.split("_")[1]));
  const backed = bounties.filter((b) => b.state === "open" || b.state === "held").reduce((t, b) => t + wei(b.pot) + wei(b.reserved), 0n);
  const shipped = claims.filter((c) => c.verdict === "SHIPPED").length;
  const paid = bounties.reduce((t, b) => t + wei(b.paid_total), 0n);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onOpen={() => { setPrefill(null); setModal(true); }} />
      <main className="flex-grow pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4 lg:pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A84FF]">Issue bounties for open-source iOS apps</p>
              <h1 className="display text-5xl md:text-6xl leading-[1.02]">Paid when it ships, not when it merges.</h1>
              <p className="text-lg text-muted-foreground">
                Back a GitHub issue with GEN. GenLayer validators follow the fix from the issue to the pull request, to the release, to the
                version the App Store actually offers, and pay the developer who wrote it once users have it.
              </p>
              <dl className="flex gap-8 pt-1">
                <div>
                  <dt className="text-xs text-muted-foreground">GEN on issues</dt>
                  <dd className="display text-3xl">{formatGen(backed, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">fixes shipped</dt>
                  <dd className="display text-3xl">{shipped}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GEN paid</dt>
                  <dd className="display text-3xl">{formatGen(paid, 2)}</dd>
                </div>
              </dl>
            </div>
            <div className="lg:col-span-7">
              <IssueCheck
                bounties={bounties}
                onOpen={(p) => {
                  setPrefill(p);
                  setModal(true);
                }}
                onBack={(b) => {
                  setFocus(b.id);
                  document.getElementById(b.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            </div>
          </section>

          <section>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="rounded-2xl border border-border bg-white/60 p-4">
                  <div className="flex items-center gap-2">
                    <span className="display flex h-7 w-7 items-center justify-center rounded-full bg-[#0F1B2D] text-sm text-white">{i + 1}</span>
                    <Icon className="w-4 h-4 text-[#0A84FF]" />
                    <span className="font-semibold">{title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Looking needs no wallet. To back an issue or claim a bounty, connect MetaMask and press Test GEN for free GenLayer Studio tokens. The
              bounties below are demo bounties funded by test wallets with test GEN, not offers to these developers; the issues, changes, releases
              and App Store versions they check are real.
            </p>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="display text-3xl">Bounties</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {fetchedAt && <span>updated {new Date(fetchedAt).toLocaleTimeString()}</span>}
                  <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                    {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {isLoading && <p className="text-sm text-muted-foreground">Reading the bounties from GenLayer Studio…</p>}
              {isError && <p className="rounded-xl border border-[#EEC3B6] bg-[#FBEFEA] p-3 text-sm">Could not read the bounties: {error?.message}. Try Refresh in a minute.</p>}
              {!isLoading && !isError && ordered.length === 0 && <p className="text-sm text-muted-foreground">No bounty is open yet. Open the first one.</p>}
              {ordered.map((b) => (
                <div id={b.id} key={b.id}>
                  <BountyCard bounty={b} claims={claims.filter((c) => c.bounty_id === b.id)} highlight={focus === b.id} />
                </div>
              ))}
            </div>
            <aside className="lg:col-span-4 space-y-6">
              <div className="brand-card p-5 space-y-3 text-sm">
                <h3 className="display text-xl">How a claim is checked</h3>
                <p>
                  <strong>The app is the repo&apos;s.</strong> When a bounty is opened, validators check the repository names the App Store app:
                  its README or homepage links the app&apos;s id, or the app&apos;s seller website is the repository&apos;s homepage.
                </p>
                <p>
                  <strong>The fix, from the issue.</strong> The issue must be closed as completed. The change is the commit on its closing event
                  (and that commit&apos;s pull request), or a merged pull request that says &ldquo;fixes #N&rdquo;. On an open issue, only a change
                  merged after the bounty counts; a bounty on an issue already fixed is retroactive.
                </p>
                <p>
                  <strong>Shipped means users have it.</strong> Validators read the App Store&apos;s current version, find the GitHub release it
                  corresponds to, and check (with GitHub&apos;s compare) that the change is in it, and that the App Store build is newer than the
                  merge. Merged but unreleased, or released but not yet in the App Store, waits.
                </p>
                <p>
                  <strong>The model reads the change.</strong> Given the issue and the change&apos;s description, it says whether the change
                  delivers what was asked, in part, or not at all. Only a full delivery is paid; every validator must agree.
                </p>
                <p>
                  <strong>A week in users&apos; hands.</strong> The pot is reserved, then confirmed once the shipping version has been out the
                  survival period, if the issue is still closed and the App Store still has the release. Anyone may dispute before that with 10% at
                  stake: validators make the whole ruling again.
                </p>
                <p>
                  <strong>The author is paid where they say.</strong> The bounty goes to the GenLayer wallet in the author&apos;s GitHub bio
                  (&ldquo;GenLayer wallet: 0x…&rdquo;), held until they add one; unclaimed bounties go back to every backer after the deadline.
                </p>
              </div>
              <OwedCard />
              <TransactionPanel />
            </aside>
          </section>
        </div>
      </main>
      <footer className="border-t border-border py-4 px-4 text-center text-sm text-muted-foreground">
        Data: GitHub&apos;s public API and Apple&apos;s App Store lookup, as published ·{" "}
        <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
          Built on GenLayer
        </a>
        {" · "}
        <a href="https://github.com/bars26/genlayer-shipbounty" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
          Source
        </a>
      </footer>
      <OpenBountyModal open={modal} onOpenChange={setModal} prefill={prefill} />
    </div>
  );
}
