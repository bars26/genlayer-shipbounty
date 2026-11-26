import type { IssuePreview } from "@/lib/contracts/types";

/**
 * What the contract will find for an issue, before anyone pays for a transaction: the issue, the change that closed it,
 * the release the App Store's version corresponds to, and the App Store app the repository names. The same rules the
 * contract applies, run here without validators or the model.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GH = "https://api.github.com";
const UA = "ShipBounty/1.0 (github.com/bars26/genlayer-shipbounty)";

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": UA };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh(path: string): Promise<any> {
  const res = await fetch(`${GH}${path}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 403 ? "GitHub's rate limit was reached; try again in a few minutes" : `GitHub answered ${res.status}`);
  return res.json();
}

const version = (t: string) => (t.match(/(\d+(?:\.\d+)+)/)?.[1] ?? "").split(".").filter(Boolean).map(Number);
const atLeast = (a: number[], b: number[]) => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
};
const cmp = (a: number[], b: number[]) => (atLeast(a, b) ? (atLeast(b, a) ? 0 : 1) : -1);
const host = (u: string) => (u.trim().toLowerCase().match(/^https?:\/\/(?:www\.)?([^/:?#]+)/) ?? [])[1] ?? "";

/** "owner/repo#123", "owner/repo 123" or a github.com issue link. */
function parse(q: string): { repo: string; n: number } | null {
  const m = q.trim().match(/(?:github\.com\/)?([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}?)(?:\/issues\/|#|\s+)(\d{1,9})\b/);
  return m ? { repo: m[1], n: Number(m[2]) } : null;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = parse(q.get("q") ?? "");
  const appleId = (q.get("apple") ?? "").trim();
  const prefix = (q.get("prefix") ?? "").trim();
  if (!parsed) return Response.json({ error: "Paste a GitHub issue, like github.com/Dimillian/IceCubesApp/issues/2512" }, { status: 400 });
  const { repo, n } = parsed;
  try {
    const [r, issue] = await Promise.all([gh(`/repos/${repo}`), gh(`/repos/${repo}/issues/${n}`)]);
    if (!r) return Response.json({ error: `GitHub has no repository ${repo}` }, { status: 404 });
    if (!issue || issue.pull_request) return Response.json({ error: `${repo} has no issue #${n}` }, { status: 404 });
    const preview: IssuePreview = {
      repo: r.full_name, number: n, title: issue.title, state: issue.state, reason: issue.state_reason ?? "", url: issue.html_url,
      app: null, change: null, release: null, shipped: false, wallet: "", note: "",
    };

    // The App Store app the repository names: an id in its homepage or README, or the one given.
    let id = /^\d{6,12}$/.test(appleId) ? appleId : "";
    let how = "";
    const idIn = (t: string) => t.match(/(?:apps|itunes)\.apple\.com\/[^\s)"']*id(\d{6,12})(?!\d)/i)?.[1] ?? "";
    if (idIn(r.homepage ?? "")) [id, how] = [id || idIn(r.homepage), id && idIn(r.homepage) !== id ? "" : "homepage"];
    if (!how) {
      const readme = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`, { headers: { "user-agent": UA }, cache: "no-store" }).then((x) => (x.ok ? x.text() : ""));
      const found = idIn(readme);
      if (found && (!id || found === id)) [id, how] = [found, "readme"];
    }
    if (id) {
      const a = await fetch(`https://itunes.apple.com/lookup?id=${id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const app = (a?.results ?? []).find((x: any) => x.kind === "software");
      if (app) {
        if (!how && host(r.homepage ?? "") && host(r.homepage) === host(app.sellerUrl ?? "")) how = "seller_url";
        preview.app = { id, name: app.trackName, version: app.version, released: String(app.currentVersionReleaseDate ?? "").slice(0, 19), how };
      }
    }

    if (issue.state === "closed") {
      const timeline: any[] = (await gh(`/repos/${repo}/issues/${n}/timeline?per_page=100`)) ?? [];
      const closed = timeline.filter((e) => e.event === "closed").at(-1);
      let sha = closed?.commit_id ?? "";
      let pr: any = null;
      if (sha) pr = ((await gh(`/repos/${repo}/commits/${sha}/pulls`)) ?? []).find((p: any) => p.merged_at) ?? null;
      else {
        const rx = new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\\b[: ]+(?:[\\w.-]+/[\\w.-]+)?#${n}\\b`, "i");
        const x = timeline.find((e) => e.event === "cross-referenced" && e.source?.issue?.pull_request?.merged_at && rx.test(`${e.source.issue.title}\n${e.source.issue.body ?? ""}`));
        if (x) {
          pr = await gh(`/repos/${repo}/pulls/${x.source.issue.number}`);
          sha = pr?.merge_commit_sha ?? "";
        }
      }
      if (sha) {
        let author = pr?.user?.login ?? "";
        let merged = String(pr?.merged_at ?? "").slice(0, 19);
        let title = pr?.title ?? "";
        if (!pr) {
          const c = await gh(`/repos/${repo}/commits/${sha}`);
          author = c?.author?.login ?? "";
          merged = String(c?.commit?.committer?.date ?? "").slice(0, 19);
          title = String(c?.commit?.message ?? "").split("\n")[0];
        }
        preview.change = { kind: pr ? "pr" : "commit", number: pr?.number ?? 0, sha, title, author, merged_at: merged,
          url: pr ? pr.html_url : `https://github.com/${repo}/commit/${sha}` };
        const live = preview.app ? version(preview.app.version) : [];
        const releases: any[] = ((await gh(`/repos/${repo}/releases?per_page=30`)) ?? [])
          .filter((x: any) => !x.draft && !x.prerelease && String(x.tag_name).startsWith(prefix) && version(x.tag_name).length && String(x.published_at).slice(0, 10) >= merged.slice(0, 10))
          .sort((x: any, y: any) => cmp(version(x.tag_name), version(y.tag_name)));
        const have = releases.filter((x) => live.length && atLeast(live, version(x.tag_name)));
        const target = have.at(-1);
        if (target) {
          preview.release = { tag: target.tag_name, published: String(target.published_at).slice(0, 19) };
          const comparison = await gh(`/repos/${repo}/compare/${encodeURIComponent(target.tag_name)}...${sha}`);
          preview.shipped = ["behind", "identical"].includes(comparison?.status) && !!preview.app && preview.app.released >= merged;
        }
        if (author) {
          const u = await gh(`/users/${author}`);
          const w = [...String(u?.bio ?? "").matchAll(/genlayer[^0-9a-zA-Z]{0,24}(?:wallet|address)?[^0-9a-zA-Z]{0,8}(0x[0-9a-fA-F]{40})/gi)].map((m) => m[1].toLowerCase());
          preview.wallet = new Set(w).size === 1 ? w[0] : "";
        }
      }
    }
    preview.note =
      issue.state !== "closed" ? "Open: a bounty now pays a fix merged later, once it is in the App Store."
      : issue.state_reason !== "completed" ? "Closed as not planned: a claim would be refused."
      : !preview.change ? "No commit or merged PR closed it: a claim would be refused."
      : preview.shipped ? "Fixed, released and live in the App Store: a bounty opened now is retroactive and can be claimed at once (the model then reads the change against the issue)."
      : "Fixed, but the App Store does not have it yet: a claim would wait.";
    return Response.json(preview, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
