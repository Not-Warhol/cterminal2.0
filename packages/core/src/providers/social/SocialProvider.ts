import type { MappingConfidence, SocialFilter, SocialPost } from "../../types";
import type { ChainId } from "../../chains";

/**
 * SocialProvider — the "Alpha / X Posts" feature (spec Fase 2 §1.5).
 *
 * HONEST SCOPE NOTE (master spec §4.7). Two hard problems shape this:
 *  1. The X API v2 is paid + rate-limited → cache hard, fetch on-open only.
 *  2. Mapping an X handle → on-chain wallet is largely UNSOLVED. Every post
 *     carries a `MappingConfidence`. We currently have NO mapping source, so
 *     confidence is always "none" and we never show a fabricated PnL. When a
 *     tier-1 signature-link table exists, this is the only thing that changes.
 */
export interface SocialQuery {
  chain: ChainId;
  tokenAddress: string;
  /** ticker without the $, used to build the search query */
  symbol: string;
  filter: SocialFilter;
}

export interface SocialProvider {
  readonly id: "twitter";
  isConfigured(): boolean;
  posts(q: SocialQuery): Promise<SocialPost[]>;
}

interface XUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: { followers_count?: number };
  profile_image_url?: string;
}
interface XTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  };
}

const KOL_FOLLOWER_THRESHOLD = 50_000;

export class TwitterProvider implements SocialProvider {
  readonly id = "twitter" as const;
  private readonly token?: string;
  /** Learned once per process: does this account's access level allow the
   *  $cashtag operator? null = not yet known. Avoids a wasted call each time. */
  private cashtagSupported: boolean | null = null;
  /** Which query mode the last search actually used (for an honest UI hint). */
  lastMode: "cashtag" | "keyword" | null = null;

  constructor(bearerToken?: string) {
    this.token = TwitterProvider.normalizeToken(bearerToken);
  }

  /**
   * Bearer tokens are fragile to copy-paste. This defends against the three
   * things that cause a 401 even when the token is "right":
   *  - surrounding whitespace / newlines (env editors love to add them)
   *  - an accidental "Bearer " prefix pasted into the value
   *  - percent-encoding (%2B %2F %3D) left in from a URL-encoded copy — X
   *    then receives a malformed token and rejects it as Unauthorized.
   */
  static normalizeToken(raw?: string): string | undefined {
    if (!raw) return undefined;
    let t = raw.trim().replace(/\s+/g, "");
    if (/^Bearer/i.test(t)) t = t.replace(/^Bearer/i, "").trim();
    if (/%2[BF]|%3D/i.test(t)) {
      try { t = decodeURIComponent(t); } catch { /* keep as-is */ }
    }
    return t || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  /** One recent-search request. Builds a $cashtag or keyword query and returns
   *  a discriminated result so the caller can fall back on a cashtag rejection. */
  private async search(
    sym: string,
    tokenAddress: string,
    useCashtag: boolean,
  ): Promise<
    | { ok: true; usedCashtag: boolean; body: { data?: XTweet[]; includes?: { users?: XUser[] } } }
    | { ok: false; usedCashtag: boolean; status: number; text: string }
  > {
    const addrClause = tokenAddress ? ` OR "${tokenAddress}"` : "";
    const head = useCashtag ? `$${sym} OR #${sym}` : `"${sym}" OR #${sym}`;
    const query = `(${head}${addrClause}) -is:retweet`;
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    // COST GUARD: recent search bills PER TWEET RETURNED (~$0.005 each). We
    // render 15, so never fetch more — that would burn credits on rows we drop.
    url.searchParams.set("max_results", "15");
    url.searchParams.set("tweet.fields", "public_metrics,created_at");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "public_metrics,name,username,profile_image_url");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token!}` } });
    if (!res.ok) return { ok: false, usedCashtag: useCashtag, status: res.status, text: await res.text() };
    return { ok: true, usedCashtag: useCashtag, body: await res.json() };
  }

  async posts(q: SocialQuery): Promise<SocialPost[]> {
    if (!this.token) return [];

    const sym = q.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // X API v2 recent search. The RIGHT signal for a crypto ticker is the
    // $cashtag ($WOLFI) — that's how tokens are actually discussed. But the
    // cashtag operator is an ADVANCED operator that lower access levels
    // (Basic / standard pay-per-use) reject with a 400 "invalid operator
    // 'cashtag'", failing the whole query. So we try $cashtag first and, only
    // if THIS account can't use it, fall back to keyword+hashtag. The result
    // is learned once per process so we don't waste a call every time.
    const useCashtag = this.cashtagSupported !== false;
    let result = await this.search(sym, q.tokenAddress, useCashtag);

    if (useCashtag && !result.ok && result.status === 400 && /invalid operator|cashtag/i.test(result.text)) {
      this.cashtagSupported = false; // this tier has no cashtag → stop trying
      result = await this.search(sym, q.tokenAddress, false);
    } else if (useCashtag && result.ok) {
      this.cashtagSupported = true;
    }
    if (!result.ok) throw new Error(`X API ${result.status}: ${result.text}`);
    this.lastMode = result.usedCashtag ? "cashtag" : "keyword";

    const body = result.body;
    const tweets = body.data ?? [];
    const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));

    const now = Date.now();
    const scored = tweets.map((t) => {
      const u = users.get(t.author_id);
      const followers = u?.public_metrics?.followers_count ?? 0;
      const m = t.public_metrics ?? {};
      const engagement = (m.like_count ?? 0) + (m.retweet_count ?? 0) * 2 + (m.reply_count ?? 0);
      const ageH = (now - Date.parse(t.created_at)) / 3.6e6;
      const recency = Math.max(0.1, 1 - ageH / 24); // decays over 24h
      // relevance = engagement × reach × recency
      const score = (engagement + 1) * Math.log10(followers + 10) * recency;
      return { t, u, followers, m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const mapped: SocialPost[] = scored.map(({ t, u, followers, m }) => {
      const confidence: MappingConfidence = "none"; // no wallet-mapping source yet
      const tags: SocialFilter[] = ["all"];
      if (followers >= KOL_FOLLOWER_THRESHOLD) tags.push("kol");
      return {
        id: t.id,
        author: {
          handle: u?.username ?? "unknown",
          name: u?.name ?? "Unknown",
          followers,
          avatarUrl: u?.profile_image_url,
        },
        text: t.text,
        createdAt: Date.parse(t.created_at),
        metrics: {
          likes: m.like_count ?? 0,
          reposts: m.retweet_count ?? 0,
          replies: m.reply_count ?? 0,
          views: m.impression_count ?? 0,
        },
        url: `https://x.com/${u?.username ?? "i"}/status/${t.id}`,
        mapping: { confidence, wallet: null, tokenPnlUsd: null },
        tags,
      };
    });

    // Filter tabs. smart_money needs on-chain wallet mapping we don't have
    // yet → honest empty rather than mislabelling KOLs as smart money.
    if (q.filter === "kol") return mapped.filter((p) => p.tags.includes("kol")).slice(0, 15);
    if (q.filter === "smart_money") return [];
    return mapped.slice(0, 15);
  }
}
