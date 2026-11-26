"use client";

import { useState } from "react";
import { FileText, Loader2, Mic, Radio, RefreshCw, Wallet } from "lucide-react";
import { DealCard } from "@/components/DealCard";
import { EpisodeCheck } from "@/components/EpisodeCheck";
import { Navbar } from "@/components/Navbar";
import { OpenDealModal, type DealPrefill } from "@/components/OpenDealModal";
import { OwedCard } from "@/components/OwedCard";
import { TransactionPanel } from "@/components/TransactionPanel";
import { Button } from "@/components/ui/button";
import { formatGen, wei } from "@/lib/contracts/types";
import { useRegistry } from "@/lib/hooks/useShipBounty";

const STEPS = [
  { icon: Wallet, title: "Book reads", body: "A sponsor funds host-read messages on a show: its brand, an optional promo code, the talking points, a publication window, a price per read." },
  { icon: Mic, title: "The host reads it", body: "The episode goes out with its Podcasting 2.0 transcript. Anyone submits it: the episode's guid in the show's feed." },
  { icon: FileText, title: "Validators read the episode", body: "The feed, Apple's directory and the transcript. Code finds the brand and the code; the model judges if the passage is a sponsor message with every point." },
  { icon: Radio, title: "Paid once it stays up", body: "Anyone may dispute a held read with a stake. After the survival period the episode is read again and the show is paid at the wallet its own feed declares." },
];

export default function HomePage() {
  const { deals, reads, isLoading, isError, error, isFetching, refetch, fetchedAt } = useRegistry();
  const [modal, setModal] = useState(false);
  const [prefill, setPrefill] = useState<DealPrefill | null>(null);
  const ordered = [...deals].sort((a, b) => Number(b.id.split("_")[1]) - Number(a.id.split("_")[1]));
  const booked = deals.filter((d) => d.state === "open").reduce((t, d) => t + wei(d.budget) + wei(d.reserved), 0n);
  const delivered = reads.filter((r) => r.verdict === "DELIVERED").length;
  const paid = deals.reduce((t, d) => t + wei(d.paid_total), 0n);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onOpen={() => { setPrefill(null); setModal(true); }} />
      <main className="flex-grow pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4 lg:pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E4503F]">● Host-read podcast ads, paid when they air</p>
              <h1 className="display text-5xl md:text-6xl leading-[1.02]">Did the host actually read it?</h1>
              <p className="text-lg text-muted-foreground">
                Independent shows sell host-read ads on trust and invoices; sponsors check by listening. ReadProof escrows the fee in GEN, and
                GenLayer validators read the episode&apos;s own transcript, the show&apos;s feed and Apple&apos;s directory before the show is paid.
              </p>
              <dl className="flex gap-8 pt-1">
                <div>
                  <dt className="text-xs text-muted-foreground">GEN in open deals</dt>
                  <dd className="display text-3xl">{formatGen(booked, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">reads delivered</dt>
                  <dd className="display text-3xl">{delivered}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GEN paid</dt>
                  <dd className="display text-3xl">{formatGen(paid, 2)}</dd>
                </div>
              </dl>
            </div>
            <div className="lg:col-span-7">
              <EpisodeCheck deals={deals} onBook={(p) => { setPrefill(p); setModal(true); }} />
            </div>
          </section>

          <section>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="rounded-2xl border border-border bg-white/60 p-4">
                  <div className="flex items-center gap-2">
                    <span className="display flex h-7 w-7 items-center justify-center rounded-full bg-[#1F1A33] text-sm text-white">{i + 1}</span>
                    <Icon className="w-4 h-4 text-[#E4503F]" />
                    <span className="font-semibold">{title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Looking needs no wallet. To book reads or submit an episode, connect MetaMask and press Test GEN for free GenLayer Studio tokens. The deals
              below are demo deals funded by test wallets with test GEN, not offers from these sponsors or to these shows; the feeds, episodes and
              transcripts they check are real.
            </p>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="display text-3xl">Deals</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {fetchedAt && <span>updated {new Date(fetchedAt).toLocaleTimeString()}</span>}
                  <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                    {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {isLoading && <p className="text-sm text-muted-foreground">Reading the deals from GenLayer Studio…</p>}
              {isError && <p className="rounded-xl border border-[#EEC3B6] bg-[#FBEFEA] p-3 text-sm">Could not read the deals: {error?.message}. Try Refresh in a minute.</p>}
              {!isLoading && !isError && ordered.length === 0 && <p className="text-sm text-muted-foreground">No deal is booked yet. Book the first one.</p>}
              {ordered.map((d) => (
                <div id={d.id} key={d.id}>
                  <DealCard deal={d} reads={reads.filter((r) => r.deal_id === d.id)} />
                </div>
              ))}
            </div>
            <aside className="lg:col-span-4 space-y-6">
              <div className="brand-card p-5 space-y-3 text-sm">
                <h3 className="display text-xl">How a read is checked</h3>
                <p>
                  <strong>One show, two directories.</strong> When a deal is booked, validators check that Apple Podcasts lists the given id with exactly
                  the given feed, so the feed and Apple describe the same show.
                </p>
                <p>
                  <strong>The episode, from both.</strong> The submitted guid must be in the show&apos;s own feed, published inside the window, and
                  Apple must list the same episode (by guid, by audio file, or by title within two days) with a date within two days of the
                  feed&apos;s. A backdated or invented episode does not match.
                </p>
                <p>
                  <strong>The transcript, in code first.</strong> The episode&apos;s Podcasting 2.0 transcript (WebVTT, SRT, JSON, text or HTML) is
                  fetched; code finds the sponsor&apos;s name and the promo code (spaces and punctuation ignored, as transcription splits codes).
                </p>
                <p>
                  <strong>The model judges only the passage.</strong> On up to three passages around the mentions, it says whether this is a sponsor
                  message (not a passing or mocking mention) and which talking points it conveys. Every validator must reach the same answers.
                </p>
                <p>
                  <strong>It must stay up.</strong> The price is reserved, then paid once the episode has stood the survival period and is still in
                  the feed with the read in its transcript. Anyone can dispute before that with 10% of the price at stake: validators make the
                  whole ruling again; upheld pays the disputer, dismissed pays the show.
                </p>
                <p>
                  <strong>The show is paid where it says.</strong> The price goes to the GenLayer wallet the show declares in its own feed
                  (<span className="mono">&lt;podcast:txt purpose=&quot;genlayer&quot;&gt;</span>, the Podcasting 2.0 ownership tag), held until
                  it does; only Withdraw sends GEN.
                </p>
              </div>
              <OwedCard />
              <TransactionPanel />
            </aside>
          </section>
        </div>
      </main>
      <footer className="border-t border-border py-4 px-4 text-center text-sm text-muted-foreground">
        Data: the shows&apos; own RSS feeds and transcripts, and Apple&apos;s public podcast directory, as published ·{" "}
        <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
          Built on GenLayer
        </a>
        {" · "}
        <a href="https://github.com/bars26/genlayer-readproof" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
          Source
        </a>
      </footer>
      <OpenDealModal open={modal} onOpenChange={setModal} prefill={prefill} />
    </div>
  );
}
