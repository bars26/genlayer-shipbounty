import type { ShowPreview } from "@/lib/contracts/types";

/**
 * A show's latest episodes as its own RSS feed lists them, with Apple's matching record and, when a sponsor's name (and
 * code) is given, how often each episode's transcript names it. The same rules the contract applies, run here without
 * validators or a model, so a sponsor or a show can see what will be submitted before paying for a transaction.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = { "user-agent": "ReadProof/1.0 (github.com/bars26/genlayer-readproof)" };
const TYPES = ["text/vtt", "application/x-subrip", "application/srt", "application/json", "text/plain", "text/html"];
const MAX_EPISODES = 12;
const MAX_TRANSCRIPTS = 6;

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (xml: string, name: string) => decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "");
const attrs = (t: string) => Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1].toLowerCase(), decode(m[2])]));
const norm = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function rfc822(text: string): string {
  const t = Date.parse(text);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 19);
}

function brandPattern(brand: string) {
  const w = brand.toLowerCase().match(/[a-z0-9]+/g);
  return w ? new RegExp(`(?<![a-z0-9])${w.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^a-z0-9]{1,3}")}(?![a-z0-9])`, "gi") : null;
}

function transcriptText(body: string, kind: string): string {
  if (kind.includes("json")) {
    try {
      return (JSON.parse(body).segments ?? []).map((s: any) => String(s?.body ?? "")).join(" ").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }
  if (kind.includes("html")) return decode(body.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.includes("-->") && !/^\d+$/.test(l) && !/^(WEBVTT|NOTE|STYLE)/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function get(url: string, timeoutMs = 20_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: HEADERS, cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const feed = (q.get("feed") ?? "").trim();
  const appleId = (q.get("apple") ?? "").trim();
  const brand = (q.get("brand") ?? "").trim().slice(0, 60);
  const code = (q.get("code") ?? "").trim().slice(0, 40);
  if (!/^https?:\/\/\S{4,300}$/.test(feed)) return Response.json({ error: "Paste the show's RSS feed URL" }, { status: 400 });
  try {
    const res = await get(feed);
    if (!res.ok) return Response.json({ error: `The feed answered ${res.status}` }, { status: 502 });
    const xml = await res.text();
    const [head, ...rest] = xml.split(/<item[\s>]/i);
    const items = rest.map((r) => r.split(/<\/item>/i)[0]).slice(0, MAX_EPISODES);
    const title = tag(head, "title");
    const txt = [...head.matchAll(/<podcast:txt[^>]*purpose="genlayer"[^>]*>\s*(?:<!\[CDATA\[)?\s*(0x[0-9a-fA-F]{40})/gi)].map((m) => m[1].toLowerCase());
    const desc = `${tag(head, "description")} ${tag(head, "itunes:summary")}`;
    const lines = [...desc.matchAll(/genlayer[^0-9a-zA-Z]{0,24}(?:wallet|address)?[^0-9a-zA-Z]{0,8}(0x[0-9a-fA-F]{40})/gi)].map((m) => m[1].toLowerCase());
    const found = new Set(txt.length ? txt : lines);

    // Apple: the given id, or a search by the show's title, kept only if Apple's record points at this exact feed.
    let apple: ShowPreview["apple"] = null;
    let appleEpisodes: any[] = [];
    // Apple sometimes keeps a duplicate record of a show (same feed, no episodes): try each match, keep one with episodes.
    let ids = /^\d{4,12}$/.test(appleId) ? [appleId] : [];
    if (!ids.length && title) {
      const s = await get(`https://itunes.apple.com/search?entity=podcast&limit=10&term=${encodeURIComponent(title.slice(0, 80))}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      ids = (s?.results ?? []).filter((r: any) => norm(String(r.feedUrl ?? "")) === norm(feed)).map((r: any) => String(r.collectionId)).slice(0, 3);
    }
    for (const id of ids) {
      const a = await get(`https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=200`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const show = (a?.results ?? []).find((r: any) => r.kind === "podcast");
      if (!show) continue;
      const eps = (a.results ?? []).filter((r: any) => r.kind === "podcast-episode");
      if (!apple || (eps.length && !appleEpisodes.length)) {
        apple = { id, name: String(show.collectionName ?? ""), feed: String(show.feedUrl ?? ""), same: norm(String(show.feedUrl ?? "")) === norm(feed) };
        appleEpisodes = eps;
      }
      if (eps.length) break;
    }

    const pat = brand ? brandPattern(brand) : null;
    let fetched = 0;
    const episodes: ShowPreview["episodes"] = [];
    for (const it of items) {
      const guid = tag(it, "guid");
      const epTitle = tag(it, "title");
      const published = rfc822(tag(it, "pubDate"));
      const audio = attrs(it.match(/<enclosure\s[^>]*>/i)?.[0] ?? "").url ?? "";
      const trs = [...it.matchAll(/<podcast:transcript\s[^>]*>/gi)].map((m) => attrs(m[0]));
      const best = trs
        .map((t) => ({ url: t.url ?? "", type: (t.type ?? "").split(";")[0].trim().toLowerCase() }))
        .filter((t) => TYPES.includes(t.type) && /^https?:\/\//.test(t.url))
        .sort((x, y) => TYPES.indexOf(x.type) - TYPES.indexOf(y.type))[0] ?? null;
      const bare = (u: string) => u.split("?")[0].trim().toLowerCase();
      const ap =
        appleEpisodes.find((e) => e.episodeGuid && e.episodeGuid === guid) ? "guid"
        : appleEpisodes.find((e) => audio && bare(String(e.episodeUrl ?? "")) === bare(audio)) ? "audio"
        : appleEpisodes.find((e) => {
            const a = words(String(e.trackName ?? "")).trim(), b = words(epTitle).trim();
            return Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)) && Math.abs(Date.parse(e.releaseDate) - Date.parse(`${published}Z`)) <= 2 * 86_400_000;
          }) ? "title" : "";
      let mentions: number | null = null, codeFound: boolean | null = null, excerpt = "";
      if (pat && best && fetched < MAX_TRANSCRIPTS) {
        fetched++;
        const body = await get(best.url).then((r) => (r.ok ? r.text() : "")).catch(() => "");
        const text = transcriptText(body, best.type);
        if (text) {
          const ms = [...text.matchAll(pat)];
          mentions = ms.length;
          codeFound = code ? alnum(text).includes(alnum(code)) : null;
          const cue = ms.find((m) => /sponsor|brought to you|supported by|thanks to|promo code|use (the )?code/i.test(text.slice(Math.max(0, m.index! - 200), m.index! + 200))) ?? ms[0];
          if (cue) excerpt = text.slice(Math.max(0, cue.index! - 120), cue.index! + 280);
        }
      }
      episodes.push({ guid, title: epTitle, published, transcript: best, apple: ap, mentions, codeFound, excerpt });
    }
    const preview: ShowPreview = { feed, title, wallet: found.size === 1 ? [...found][0] : "", apple, episodes };
    return Response.json(preview, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (err: any) {
    return Response.json({ error: err?.name === "AbortError" ? "The feed took too long to answer" : err?.message ?? String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
