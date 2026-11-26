"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import ReadProof, { type OpenDealInput, type TxProgress, type TxResult } from "../contracts/ReadProof";
import { STAKE_DIVISOR, formatGen, lastDay, nowIso, parseJson, sameAddress, todayUtc, wei, type Deal, type Read, type Reading } from "../contracts/types";
import { isOnGenLayerNetwork, switchToGenLayerNetwork } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { currentNetwork } from "../network";
import { TxError, classifyError } from "../utils/errors";
import { error, success } from "../utils/toast";
import { startTx, updateTx, type TxKind } from "./useTxLog";

export function useShipContract(): ReadProof | null {
  const { address } = useWallet();
  const network = currentNetwork();
  return useMemo(() => (/^0x[0-9a-fA-F]{40}$/.test(network.contract) ? new ReadProof(network, address) : null), [network, address]);
}

const registryKey = () => ["registry", currentNetwork().id];

type Registry = { deals: Deal[]; reads: Read[]; fetchedAt?: string };

async function fetchJson(url: string, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/** Every deal and read, from the CDN-cached server snapshot (app/api/registry); falls back to direct reads. */
export function useRegistry() {
  const contract = useShipContract();
  const query = useQuery<Registry, Error>({
    queryKey: registryKey(),
    queryFn: async () => {
      try {
        const body = await fetchJson(`/api/registry?network=${currentNetwork().id}`);
        if (!Array.isArray(body.deals) || !Array.isArray(body.reads)) throw new Error("Malformed snapshot");
        return body as Registry;
      } catch (snapshotErr) {
        if (!contract) throw classifyError(snapshotErr, "read");
        const [deals, reads] = await Promise.all([contract.getDeals(), contract.getReads()]);
        return { deals, reads, fetchedAt: new Date().toISOString() };
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  return {
    deals: query.data?.deals ?? [],
    reads: query.data?.reads ?? [],
    fetchedAt: query.data?.fetchedAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

async function mergeFresh(qc: ReturnType<typeof useQueryClient>, contract: ReadProof, dealId?: string, readId?: string) {
  try {
    const [deal, read] = await Promise.all([dealId ? contract.getDeal(dealId) : null, readId ? contract.getRead(readId) : null]);
    qc.setQueryData<Registry>(registryKey(), (prev) => {
      let deals = prev?.deals ?? [];
      let reads = prev?.reads ?? [];
      if (deal) deals = deals.some((d) => d.id === deal.id) ? deals.map((d) => (d.id === deal.id ? deal : d)) : [...deals, deal];
      if (read) reads = reads.some((r) => r.id === read.id) ? reads.map((r) => (r.id === read.id ? read : r)) : [...reads, read];
      return { deals, reads, fetchedAt: prev?.fetchedAt };
    });
  } catch {
    // Already confirmed on chain; the next snapshot refresh picks it up.
  }
}

export type WriteVars =
  | { kind: "open"; input: OpenDealInput }
  | { kind: "deliver"; dealId: string; guid: string }
  | { kind: "confirm"; readId: string }
  | { kind: "dispute"; readId: string }
  | { kind: "claim"; readId: string }
  | { kind: "close"; dealId: string }
  | { kind: "reclaim"; readId: string }
  | { kind: "withdraw" };

export const WRITE_LABEL: Record<TxKind, string> = {
  open: "Book reads",
  deliver: "Submit an episode",
  confirm: "Confirm the read",
  dispute: "Dispute the read",
  claim: "Send to the show",
  close: "Close the deal",
  reclaim: "Return to the sponsor",
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
        vars.kind === "withdraw" ? "your credited GEN" : vars.kind === "open" ? `${vars.input.brand} on a show` : vars.kind === "deliver" ? vars.guid : "readId" in vars ? vars.readId : vars.dealId;
      const logId = startTx(vars.kind, target);
      setPending(vars.kind === "open" || vars.kind === "withdraw" ? vars.kind : `${vars.kind}:${"readId" in vars ? vars.readId : vars.kind === "deliver" ? `${vars.dealId}|${vars.guid}` : vars.dealId}`);
      const onProgress = (p: TxProgress) =>
        updateTx(logId, {
          state: p.step === "awaiting_wallet" ? "awaiting_wallet" : p.step === "accepted" ? "accepted" : "confirming",
          txHash: p.txHash,
          progress: p.message,
        });
      const refuse = (message: string): never => {
        throw new TxError({ kind: "contract_revert", phase: "estimate", message, hint: "The data was refreshed; nothing was sent." });
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
        let dealId = "dealId" in vars ? vars.dealId : undefined;
        let readId = "readId" in vars ? vars.readId : undefined;
        let note = "Done.";
        switch (vars.kind) {
          case "open": {
            const budget = vars.input.price * BigInt(vars.input.slots);
            const owed = await contract.owedTo(address);
            if (owed < budget) {
              onProgress({ step: "awaiting_wallet", message: "First, deposit the budget: approve it in your wallet." });
              await contract.deposit(budget - owed, onProgress);
            }
            result = await contract.openDeal(vars.input, onProgress);
            dealId = typeof result.returned === "string" ? result.returned : undefined;
            if (!dealId) {
              // Bradbury reports no return value: the newest deal this wallet funded for this show and brand.
              const mine = (await contract.getDeals(0, 500)).filter((d) => sameAddress(d.sponsor, address) && d.feed === vars.input.feed && d.brand === vars.input.brand);
              dealId = mine.at(-1)?.id;
            }
            note = dealId
              ? `${dealId} is booked: episodes published ${vars.input.start} to ${vars.input.end} can be submitted until ${new Date(Date.parse(`${vars.input.end}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10)}.`
              : "Reads booked.";
            break;
          }
          case "deliver": {
            const d = await contract.getDeal(vars.dealId);
            if (d.state !== "open" || todayUtc() > lastDay(d)) refuse(`This deal took episodes until ${lastDay(d)}.`);
            if (wei(d.budget) < wei(d.price)) refuse("Every slot of this deal is taken.");
            result = await contract.deliver(vars.dealId, vars.guid, onProgress);
            readId = typeof result.returned === "string" ? result.returned : undefined;
            if (!readId) {
              const mine = (await contract.getReads(0, 1000)).filter((r) => r.deal_id === vars.dealId && r.guid === vars.guid && sameAddress(r.submitter, address));
              readId = mine.at(-1)?.id;
            }
            if (readId) note = `${readId}: ${(await contract.getRead(readId)).why}`;
            break;
          }
          case "confirm": {
            const r = await contract.getRead(vars.readId);
            dealId = r.deal_id;
            if (r.state !== "held") refuse("This read is not waiting for confirmation.");
            if (nowIso() < r.held_until) refuse(`The read is confirmed from ${r.held_until.replace("T", " ")} UTC.`);
            result = await contract.confirm(vars.readId, onProgress);
            const state = result.returned ?? (await contract.getRead(vars.readId)).state;
            note =
              state === "paid"
                ? "Confirmed: the price is credited to the wallet the show's feed declares."
                : state === "awaiting_wallet"
                  ? "Confirmed: the price is held until the show declares a GenLayer wallet in its feed."
                  : "The episode or the read was gone: the price went back to the deal.";
            break;
          }
          case "dispute": {
            const r = await contract.getRead(vars.readId);
            dealId = r.deal_id;
            if (r.state !== "held") refuse("Only a read waiting for confirmation can be disputed.");
            if (r.disputed_by) refuse("This read has been disputed already.");
            const stake = wei(r.price) / STAKE_DIVISOR;
            const owed = await contract.owedTo(address);
            if (owed < stake) {
              onProgress({ step: "awaiting_wallet", message: `First, deposit the ${formatGen(stake, 4)} GEN stake: approve it in your wallet.` });
              await contract.deposit(stake - owed, onProgress);
            }
            result = await contract.dispute(vars.readId, onProgress);
            const after = await contract.getRead(vars.readId);
            const d = parseJson<Reading>(after.dispute_json, {});
            note =
              after.state === "disputed"
                ? `Upheld (${d.code ?? "the read is gone"}): your stake and 10% of the price are credited to you.`
                : after.disputed_by
                  ? "Dismissed: read again, the episode still carries the read. Your stake joins the show's price."
                  : "The validators could not read the episode right now; nothing was staked.";
            break;
          }
          case "claim": {
            const r = await contract.getRead(vars.readId);
            dealId = r.deal_id;
            if (r.state !== "awaiting_wallet") refuse("This read is not waiting for a wallet.");
            result = await contract.claim(vars.readId, onProgress);
            note = `Sent to ${String(result.returned ?? "the show's wallet")}, credited for it to withdraw.`;
            break;
          }
          case "close": {
            const d = await contract.getDeal(vars.dealId);
            if (d.state !== "open") refuse("This deal is already closed.");
            if (todayUtc() <= lastDay(d)) refuse(`The deal takes episodes until ${lastDay(d)}.`);
            result = await contract.closeDeal(vars.dealId, onProgress);
            note = "The unreserved budget is credited back to the sponsor.";
            break;
          }
          case "reclaim":
            result = await contract.reclaim(vars.readId, onProgress);
            note = "Credited back to the sponsor.";
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
        return { dealId, readId, txHash: result.txHash, kind: vars.kind, note };
      } catch (err) {
        const e = classifyError(err, "send");
        if (contract) mergeFresh(qc, contract, "dealId" in vars ? vars.dealId : undefined, "readId" in vars ? vars.readId : undefined);
        updateTx(logId, { state: "failed", txHash: e.txHash, error: { kind: e.kind, message: e.message, hint: e.hint, detail: e.detail, phase: e.phase } });
        error(`${WRITE_LABEL[vars.kind]} failed`, { description: [e.message, e.hint].filter(Boolean).join(" "), duration: 12000 });
        throw err;
      } finally {
        setPending(null);
      }
    },
    onSuccess: ({ dealId, readId, txHash, kind, note }) => {
      if (contract) mergeFresh(qc, contract, dealId, readId);
      qc.invalidateQueries({ queryKey: ["genBalance"] });
      qc.invalidateQueries({ queryKey: ["owed"] });
      success(`${WRITE_LABEL[kind]} confirmed`, { description: `${note} Tx ${txHash.slice(0, 10)}... is ACCEPTED by validator consensus.`, duration: 10000 });
    },
  });

  return { write: mutation.mutate, writeAsync: mutation.mutateAsync, pending, isPending: mutation.isPending };
}
