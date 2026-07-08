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

  constructor(bearerToken?: string) {
    // Bearer tokens contain +/=/ which are often pasted URL-encoded
    // (%2B, %3D, %2F). Decode defensively so a copy-paste from the console
    // that kept the encoding still authenticates.
    this.token = bearerToken && /%2[BF]|%3D/i.test(bearerToken)
      ? decodeURIComponent(bearerToken)
      : bearerToken;
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  async posts(q: SocialQuery): Promise<SocialPost[]> {
    if (!this.token) return [];

    // X API v2 recent search. The cashtag ($SYMBOL) is the primary signal
    // for token discussion; X search is case-insensitive so we normalize to
    // uppercase. No lang filter (KOLs post in many languages). Retweets out.
    const sym = q.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const addrClause = q.tokenAddress ? ` OR "${q.tokenAddress}"` : "";
    const query = `($${sym} OR #${sym}${addrClause}) -is:retweet`;
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "50");
    url.searchParams.set("tweet.fields", "public_metrics,created_at");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "public_metrics,name,username,profile_image_url");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as {
      data?: XTweet[];
      includes?: { users?: XUser[] };
    };
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
