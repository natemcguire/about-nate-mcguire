/**
 * POST /api/tldr — accepts { slug }, returns { summaries: { anthropic, openai, grok } }.
 *
 * Reads the article body from /tldr-manifest.json (shipped with the static
 * site). Calls all three LLM providers in parallel. Caches the result in KV
 * keyed by slug + content hash so subsequent visits don't re-charge tokens.
 *
 * Bindings expected (set via wrangler):
 *   env.ANTHROPIC_API_KEY  (secret)
 *   env.OPENAI_API_KEY     (secret)
 *   env.GROK_API_KEY       (secret)
 *   env.TLDR_CACHE         (KV namespace)
 */

const SHARED_PROMPT = `Summarize this opinionated essay in 3-4 sentences. Capture the
author's main argument and POV — do not soften opinions. Be specific, not generic.
Write in third person, as if introducing the article. No throat-clearing. No
"in this article" or "the author argues" — just state what's claimed.`;

async function callAnthropic(article, key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `${SHARED_PROMPT}\n\nArticle title: ${article.title}\n\n${article.text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() || "";
}

async function callOpenAI(article, key) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `${SHARED_PROMPT}\n\nArticle title: ${article.title}\n\n${article.text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`openai ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callGrok(article, key) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4.3",
      max_tokens: 400,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `${SHARED_PROMPT}\n\nArticle title: ${article.title}\n\n${article.text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`grok ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function sha256Hex(s) {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function settled(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export const onRequestPost = async ({ request, env }) => {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const slug = (payload?.slug || "").toString().replace(/[^a-z0-9-]/g, "");
  if (!slug) {
    return Response.json({ error: "missing slug" }, { status: 400 });
  }

  // Load manifest from the same site (edge-cached after the first hit).
  const manifestUrl = new URL("/tldr-manifest.json", request.url).toString();
  const manifestRes = await fetch(manifestUrl, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!manifestRes.ok) {
    return Response.json({ error: "manifest missing" }, { status: 500 });
  }
  const manifest = await manifestRes.json();
  const article = manifest[slug];
  if (!article) {
    return Response.json({ error: "unknown slug" }, { status: 404 });
  }

  const hash = await sha256Hex(article.text);
  const cacheKey = `tldr:${slug}:${hash}`;

  if (env.TLDR_CACHE) {
    const cached = await env.TLDR_CACHE.get(cacheKey, { type: "json" });
    if (cached) {
      return Response.json({ cached: true, summaries: cached });
    }
  }

  const [anthropic, openai, grok] = await Promise.all([
    settled(callAnthropic(article, env.ANTHROPIC_API_KEY)),
    settled(callOpenAI(article, env.OPENAI_API_KEY)),
    settled(callGrok(article, env.GROK_API_KEY)),
  ]);

  const summaries = {
    anthropic: anthropic.ok ? anthropic.value : `(error: ${anthropic.error})`,
    openai: openai.ok ? openai.value : `(error: ${openai.error})`,
    grok: grok.ok ? grok.value : `(error: ${grok.error})`,
  };

  // Only cache if at least two of three succeeded — otherwise we'd be
  // pinning a half-broken response forever.
  const okCount = [anthropic, openai, grok].filter((r) => r.ok).length;
  if (env.TLDR_CACHE && okCount >= 2) {
    await env.TLDR_CACHE.put(cacheKey, JSON.stringify(summaries), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return Response.json({ cached: false, summaries });
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
};
