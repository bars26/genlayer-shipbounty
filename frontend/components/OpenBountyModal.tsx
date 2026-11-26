"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MIN_BACKING_WEI, addDays, parseGen, todayUtc } from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { useShipWrite } from "@/lib/hooks/useShipBounty";
import type { OpenPrefill } from "./IssueCheck";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function OpenBountyModal({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: OpenPrefill | null }) {
  const { isConnected } = useWallet();
  const { writeAsync, pending } = useShipWrite();
  const [f, setF] = useState({ repo: "Dimillian/IceCubesApp", issue: "2512", apple: "6444915884", prefix: "", deadline: "", survival: "7", amount: "0.1" });
  useEffect(() => {
    if (!open) return;
    setF((x) => ({
      ...x,
      ...(prefill ? { repo: prefill.repo, issue: String(prefill.issue), apple: prefill.appleId } : {}),
      deadline: x.deadline || addDays(todayUtc(), 60),
    }));
  }, [open, prefill]);
  const amount = parseGen(f.amount);
  const problems = [
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(f.repo.trim()) && "The repository is owner/name on GitHub.",
    !(Number.isInteger(Number(f.issue)) && Number(f.issue) >= 1) && "The issue is its number.",
    !/^\d{6,12}$/.test(f.apple.trim()) && "The App Store id is the number in the app's apps.apple.com link (…/id6444915884).",
    !/^[A-Za-z0-9._/-]{0,40}$/.test(f.prefix) && "A tag prefix has letters, digits, . _ / - (or leave it empty).",
    (!f.deadline || f.deadline < addDays(todayUtc(), 7) || f.deadline > addDays(todayUtc(), 365)) && "The deadline is 7 to 365 days ahead.",
    !(Number(f.survival) >= 1 && Number(f.survival) <= 60) && "The shipping version is out 1 to 60 days before payment.",
    (!amount || amount < MIN_BACKING_WEI) && "Back with at least 0.01 GEN.",
  ].filter(Boolean) as string[];
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    try {
      await writeAsync({
        kind: "open",
        input: { repo: f.repo.trim(), issue: Number(f.issue), appleId: f.apple.trim(), tagPrefix: f.prefix.trim(), deadline: f.deadline, survivalDays: Number(f.survival), amount: amount! },
      });
      onOpenChange(false);
    } catch {
      // the toast and the transaction panel explain it
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="brand-card max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-2xl">Open a bounty on an issue</DialogTitle>
          <DialogDescription>
            Your GEN goes to whoever writes the change that closes the issue, once that change is in the version the App Store offers and has
            been out the survival period. On an issue already fixed and shipped, the bounty is retroactive: a thank-you for work done. If nobody
            claims it by the deadline, every backer gets their GEN back.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ob-repo">GitHub repository</Label>
            <Input id="ob-repo" value={f.repo} onChange={set("repo")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-issue">Issue number</Label>
            <Input id="ob-issue" value={f.issue} onChange={set("issue")} inputMode="numeric" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-apple">App Store id</Label>
            <Input id="ob-apple" value={f.apple} onChange={set("apple")} inputMode="numeric" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-prefix">Release tags start with (optional)</Label>
            <Input id="ob-prefix" value={f.prefix} onChange={set("prefix")} placeholder="iOS-" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-deadline">Claims until</Label>
            <Input id="ob-deadline" type="date" value={f.deadline} onChange={set("deadline")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-surv">Version out (days)</Label>
            <Input id="ob-surv" value={f.survival} onChange={set("survival")} inputMode="numeric" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="ob-amount">Your backing (GEN)</Label>
            <Input id="ob-amount" value={f.amount} onChange={set("amount")} inputMode="decimal" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Validators check the repository names this App Store app (its README or homepage links the app&apos;s id, or the app&apos;s seller
          website is the repository&apos;s homepage). GitHub&apos;s keyless API is rate limited: if the validators cannot read GitHub, nothing is
          taken and you can try again a little later.
        </p>
        {problems.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-[#A7342A]">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <Button className="w-full" disabled={!isConnected || problems.length > 0 || pending === "open"} onClick={submit}>
          {pending === "open" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isConnected ? `Deposit and open (${f.amount || 0} GEN)` : "Connect a wallet first"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
