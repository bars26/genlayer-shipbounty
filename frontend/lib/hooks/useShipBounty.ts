"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import ShipBounty, { type OpenBountyInput, type TxProgress, type TxResult } from "../contracts/ShipBounty";
import { STAKE_DIVISOR, formatGen, nowIso, parseJson, todayUtc, wei, type Bounty, type Claim, type Reading } from "../contracts/types";
import { isOnGenLayerNetwork, switchToGenLayerNetwork } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { currentNetwork } from "../network";
import { TxError, classifyError } from "../utils/errors";
import { error, success } from "../utils/toast";
import { startTx, updateTx, type TxKind } from "./useTxLog";

export function useShipContract(): ShipBounty | null {
  const { address } = useWallet();
  const network = currentNetwork();
  return useMemo(() => (/^0x[0-9a-fA-F]{40}$/.test(network.contract) ? new ShipBounty(network, address) : null), [network, address]);
}

const registryKey = () => ["registry", currentNetwork().id];

type Registry = { bounties: Bounty[]; claims: Claim[]; fetchedAt?: string };

async function fetchJson(url: string, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/** Every bounty and claim, from the CDN-cached server snapshot (app/api/registry); falls back to direct reads. */
export function useRegistry() {
  const contract = useShipContract();
  const query = useQuery<Registry, Error>({
    queryKey: registryKey(),
    queryFn: async () => {
      try {
        const body = await fetchJson(`/api/registry?network=${currentNetwork().id}`);
        if (!Array.isArray(body.bounties) || !Array.isArray(body.claims)) throw new Error("Malformed snapshot");
        return body as Registry;
      } catch (snapshotErr) {
        if (!contract) throw classifyError(snapshotErr, "read");
        const [bounties, claims] = await Promise.all([contract.getBounties(), contract.getClaims()]);
        return { bounties, claims, fetchedAt: new Date().toISOString() };
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  return {
    bounties: query.data?.bounties ?? [],
    claims: query.data?.claims ?? [],
    fetchedAt: query.data?.fetchedAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

async function mergeFresh(qc: ReturnType<typeof useQueryClient>, contract: ShipBounty, bountyId?: string, claimId?: string) {
  try {
    const [bounty, claim] = await Promise.all([bountyId ? contract.getBounty(bountyId) : null, claimId ? contract.getClaim(claimId) : null]);
    qc.setQueryData<Registry>(registryKey(), (prev) => {
      let bounties = prev?.bounties ?? [];
      let claims = prev?.claims ?? [];
      if (bounty) bounties = bounties.some((b) => b.id === bounty.id) ? bounties.map((b) => (b.id === bounty.id ? bounty : b)) : [...bounties, bounty];
      if (claim) claims = claims.some((c) => c.id === claim.id) ? claims.map((c) => (c.id === claim.id ? claim : c)) : [...claims, claim];
      return { bounties, claims, fetchedAt: prev?.fetchedAt };
    });
  } catch {
    // Already confirmed on chain; the next snapshot refresh picks it up.
  }
}

export type WriteVars =
  | { kind: "open"; input: OpenBountyInput }
  | { kind: "back"; bountyId: string; amount: bigint }
  | { kind: "claim"; bountyId: string }
  | { kind: "confirm"; claimId: string }
  | { kind: "dispute"; claimId: string }
  | { kind: "collect"; claimId: string }
  | { kind: "refund"; bountyId: string }
  | { kind: "reclaim"; claimId: string }
  | { kind: "withdraw" };

export const WRITE_LABEL: Record<TxKind, string> = {
  open: "Open a bounty",
  back: "Back the bounty",
  claim: "Claim the bounty",
  confirm: "Confirm the claim",
  dispute: "Dispute the claim",
  collect: "Send to the author",
  refund: "Refund the backers",
  reclaim: "Return to the backers",
  withdraw: "Withdraw your GEN",
};

export function useShipWrite() {
  const contract = useShipContract();
  const { address } = useWallet();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: WriteVars) => {
      const target =
        vars.kind === "withdraw" ? "your credited GEN" : vars.kind === "open" ? `${vars.input.repo}#${vars.input.issue}` : "claimId" in vars ? vars.claimId : vars.bountyId;
      const logId = startTx(vars.kind, target);
      setPending(vars.kind === "open" || vars.kind === "withdraw" ? vars.kind : `${vars.kind}:${"claimId" in vars ? vars.claimId : vars.bountyId}`);
      const onProgress = (p: TxProgress) =>
        updateTx(logId, {
          state: p.step === "awaiting_wallet" ? "awaiting_wallet" : p.step === "accepted" ? "accepted" : "confirming",
          txHash: p.txHash,
          progress: p.message,
        });
      const refuse = (message: string): never => {
        throw new TxError({ kind: "contract_revert", phase: "estimate", message, hint: "The data was refreshed; nothing was sent." });
      };
      const topUp = async (needed: bigint, what: string) => {
        const owed = await contract!.owedTo(address!);
        if (owed < needed) {
          onProgress({ step: "awaiting_wallet", message: `First, deposit ${what}: approve it in your wallet.` });
          await contract!.deposit(needed - owed, onProgress);
        }
      };
      try {
        if (!contract) throw new TxError({ kind: "unknown", phase: "send", message: "The contract address is not configured." });
        if (!address) throw new TxError({ kind: "wallet_missing", phase: "send", message: "No wallet is connected." });
        if (!(await isOnGenLayerNetwork())) {
          try {
            await switchToGenLayerNetwork();
          } catch (err) {
            throw classifyError(err, "send");
          }
        }
        let result: TxResult;
        let bountyId = "bountyId" in vars ? vars.bountyId : undefined;
        let claimId = "claimId" in vars ? vars.claimId : undefined;
        let note = "Done.";
        switch (vars.kind) {
          case "open": {
            const existing = await contract.bountyFor(vars.input.repo, vars.input.issue);
            if (existing) {
              const b = await contract.getBounty(existing);
              if (b.state === "open" || b.state === "held") refuse(`This issue already has ${existing}: back it instead.`);
            }
            await topUp(vars.input.amount, "the backing");
            result = await contract.openBounty(vars.input, onProgress);
            bountyId = typeof result.returned === "string" ? result.returned : await contract.bountyFor(vars.input.repo, vars.input.issue);
            note = bountyId ? `${bountyId} is open until ${vars.input.deadline}.` : "Bounty opened.";
            break;
          }
          case "back": {
            const b = await contract.getBounty(vars.bountyId);
            if (b.state !== "open" || todayUtc() > b.deadline) refuse("This bounty takes no more backing.");
            await topUp(vars.amount, "the backing");
            result = await contract.back(vars.bountyId, vars.amount, onProgress);
            note = `Backed with ${formatGen(vars.amount, 4)} GEN.`;
            break;
          }
          case "claim": {
            const b = await contract.getBounty(vars.bountyId);
            if (b.state !== "open") refuse("This bounty is not open for claims.");
            if (todayUtc() > b.deadline) refuse(`This bounty took claims until ${b.deadline}.`);
            result = await contract.claim(vars.bountyId, onProgress);
            claimId = typeof result.returned === "string" ? result.returned : undefined;
            if (!claimId) claimId = (await contract.getClaims(0, 1000)).filter((c) => c.bounty_id === vars.bountyId).at(-1)?.id;
            if (claimId) note = `${claimId}: ${(await contract.getClaim(claimId)).why}`;
            break;
          }
          case "confirm": {
            const c = await contract.getClaim(vars.claimId);
            bountyId = c.bounty_id;
            if (c.state !== "held") refuse("This claim is not waiting for confirmation.");
            if (nowIso() < c.held_until) refuse(`The claim is confirmed from ${c.held_until.replace("T", " ")} UTC.`);
            result = await contract.confirm(vars.claimId, onProgress);
            const state = result.returned ?? (await contract.getClaim(vars.claimId)).state;
            note =
              state === "paid"
                ? "Confirmed: paid to the wallet in the author's GitHub bio."
                : state === "awaiting_wallet"
                  ? "Confirmed: held until the author adds a GenLayer wallet to their GitHub bio."
                  : "The issue was reopened or the release is gone: the GEN went back to the bounty.";
            break;
          }
          case "dispute": {
            const c = await contract.getClaim(vars.claimId);
            bountyId = c.bounty_id;
            if (c.state !== "held") refuse("Only a claim waiting for confirmation can be disputed.");
            if (c.disputed_by) refuse("This claim has been disputed already.");
            const stake = wei(c.amount) / STAKE_DIVISOR;
            await topUp(stake, `the ${formatGen(stake, 4)} GEN stake`);
            result = await contract.dispute(vars.claimId, onProgress);
            const after = await contract.getClaim(vars.claimId);
            const d = parseJson<Reading>(after.dispute_json, {});
            note =
              after.state === "disputed"
                ? `Upheld (${d.code ?? "it does not stand"}): your stake and 10% of the amount are credited to you.`
                : after.disputed_by
                  ? "Dismissed: read again, the fix still shipped and delivers. Your stake goes to the author."
                  : "The claim could not be read again right now; nothing was staked.";
            break;
          }
          case "collect": {
            const c = await contract.getClaim(vars.claimId);
            bountyId = c.bounty_id;
            if (c.state !== "awaiting_wallet") refuse("This claim is not waiting for a wallet.");
            result = await contract.collect(vars.claimId, onProgress);
            note = `Sent to ${String(result.returned ?? "the author's wallet")}, credited for it to withdraw.`;
            break;
          }
          case "refund": {
            const b = await contract.getBounty(vars.bountyId);
            if (b.state !== "open") refuse("Only an open bounty can be refunded.");
            if (todayUtc() <= b.deadline) refuse(`The bounty takes claims until ${b.deadline}.`);
            result = await contract.refund(vars.bountyId, onProgress);
            note = "Each backer is credited what they put in.";
            break;
          }
          case "reclaim":
            result = await contract.reclaim(vars.claimId, onProgress);
            note = "Credited back to the backers.";
            break;
          case "withdraw": {
            const owed = await contract.owedTo(address);
            if (owed === 0n) refuse("Nothing is credited to this wallet.");
            result = await contract.withdraw(onProgress);
            note = `${formatGen(owed, 4)} GEN sent to your wallet (it arrives once the transaction finalizes: a few minutes).`;
            break;
          }
        }
        updateTx(logId, { state: "accepted", txHash: result.txHash, status: result.status, executionResult: result.executionResult, progress: note });
        return { bountyId, claimId, txHash: result.txHash, kind: vars.kind, note };
      } catch (err) {
        const e = classifyError(err, "send");
        if (contract) mergeFresh(qc, contract, "bountyId" in vars ? vars.bountyId : undefined, "claimId" in vars ? vars.claimId : undefined);
        updateTx(logId, { state: "failed", txHash: e.txHash, error: { kind: e.kind, message: e.message, hint: e.hint, detail: e.detail, phase: e.phase } });
        error(`${WRITE_LABEL[vars.kind]} failed`, { description: [e.message, e.hint].filter(Boolean).join(" "), duration: 12000 });
        throw err;
      } finally {
        setPending(null);
      }
    },
    onSuccess: ({ bountyId, claimId, txHash, kind, note }) => {
      if (contract) mergeFresh(qc, contract, bountyId, claimId);
      qc.invalidateQueries({ queryKey: ["genBalance"] });
      qc.invalidateQueries({ queryKey: ["owed"] });
      success(`${WRITE_LABEL[kind]} confirmed`, { description: `${note} Tx ${txHash.slice(0, 10)}... is ACCEPTED by validator consensus.`, duration: 10000 });
    },
  });

  return { write: mutation.mutate, writeAsync: mutation.mutateAsync, pending, isPending: mutation.isPending };
}
