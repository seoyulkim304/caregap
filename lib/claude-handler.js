// Vercel · Cloudflare · 로컬 서버가 함께 쓰는 Claude API 중계 핸들러 (Web 표준 Request → Response)
// API 키는 서버 환경변수 ANTHROPIC_API_KEY 에만 둡니다. 브라우저로는 보내지 않아요.
import Anthropic from "@anthropic-ai/sdk";

const MAX_PROMPT_CHARS = 60_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// 다른 사이트의 페이지가 브라우저에서 이 엔드포인트를 쓰지 못하게 막음 (같은 출처만 허용)
function sameOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function handleClaude(request, env) {
  // GET: 페이지가 AI 연결 가능 여부를 확인. 키가 없으면 503 → 페이지는 '준비된 대화'로 동작
  if (request.method === "GET") {
    return env.ANTHROPIC_API_KEY ? json({ ok: true }) : json({ ok: false, error: "not_configured" }, 503);
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!sameOrigin(request, env)) return json({ error: "forbidden_origin" }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { prompt, modelTier } = body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    return json({ error: "invalid_prompt" }, 400);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  // 페이지의 modelTier → effort. quick: 인계 질문·부탁 문장 피드백, default: 원인 대화·AI 해설·비교 해설
  const effort = modelTier === "quick" ? env.CLAUDE_EFFORT_QUICK || "low" : env.CLAUDE_EFFORT_DEFAULT || "medium";

  const stream = client.beta.messages.stream({
    model: env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort },
    // 안전 분류기가 거절하면 서버에서 다른 모델로 자동 재시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  });

  const enc = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            send({ type: "delta", text: ev.delta.text });
          }
        }
        const final = await stream.finalMessage();
        send(final.stop_reason === "refusal" ? { type: "error", code: "refusal" } : { type: "done" });
      } catch (err) {
        const code =
          err instanceof Anthropic.RateLimitError ? "rate_limited"
          : err instanceof Anthropic.AuthenticationError ? "server_auth"
          : err instanceof Anthropic.APIConnectionError ? "network"
          : "server_error";
        console.error("[claude]", code, err?.message);
        try { send({ type: "error", code }); } catch {}
      }
      try { controller.close(); } catch {}
    },
    cancel() {
      stream.abort(); // 브라우저가 연결을 끊으면 Claude 호출도 중단
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
