/**
 * LLM provider abstraction for the AI features (analyst + market read).
 *
 * Provider is chosen by which key is present, Gemini preferred (cheaper +
 * built-in Google Search grounding for the news step). Anthropic is the
 * automatic fallback. Both expose web search so the "news" section works
 * regardless of provider. Model overridable via ANALYST_MODEL.
 *
 * Server-only — keys never reach the browser.
 */

interface CompleteOpts {
  maxTokens?: number;
}

export function analystProvider(): "gemini" | "anthropic" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export async function analystComplete(prompt: string, opts: CompleteOpts = {}): Promise<string> {
  const provider = analystProvider();
  if (provider === "gemini") return geminiComplete(prompt, process.env.GEMINI_API_KEY!, opts);
  if (provider === "anthropic") return anthropicComplete(prompt, process.env.ANTHROPIC_API_KEY!, opts);
  throw new Error("No LLM provider configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY).");
}

/** Google Gemini with Search grounding — cheap + news-capable. */
async function geminiComplete(prompt: string, key: string, opts: CompleteOpts): Promise<string> {
  const model = process.env.ANALYST_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }], // grounding = live web/news search
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1500, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (body.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/** Anthropic Claude with web_search — fallback. */
async function anthropicComplete(prompt: string, key: string, opts: CompleteOpts): Promise<string> {
  const model = process.env.ANALYST_MODEL ?? "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}
