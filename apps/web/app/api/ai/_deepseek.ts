import { assertInputSize } from "./_guardrails";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";

function extractJson(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("DeepSeek 返回内容不是可解析的 JSON");
  }
}

type CompletionPayload = {
  id?: string;
  error?: { message?: string };
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; reasoning_content?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function logEmptyResult(payload: CompletionPayload, response: Response, attempt: number, mode: "json" | "text") {
  const choice = payload.choices?.[0];
  console.warn("[DeepSeek] Empty or invalid result", {
    attempt,
    mode,
    responseId: payload.id ?? response.headers.get("x-request-id") ?? undefined,
    finishReason: choice?.finish_reason ?? "missing_choice",
    hasReasoningContent: Boolean(choice?.message?.reasoning_content?.trim()),
    usage: payload.usage,
  });
}

export async function deepseekJson(request: Request, system: string, input: unknown, maxTokens = 3200) {
  const apiKey = request.headers.get("X-DeepSeek-API-Key")?.trim();
  if (!apiKey) throw new Error("缺少 DeepSeek API Key，请先到设置页接入");
  assertInputSize(input, 120_000);
  if (system.length > 24_000) throw new Error("AI 系统规则过长");
  const safeMaxTokens = Math.min(20_000, Math.max(80, Math.round(maxTokens)));

  const attempts: Array<{ mode: "json" | "text"; reminder: string }> = [
    { mode: "json", reminder: "" },
    { mode: "json", reminder: "\n再次强调：请直接返回一个完整的 JSON 对象，不要输出空内容、解释或 Markdown。" },
    { mode: "text", reminder: "\n请用纯文本返回完整 JSON 对象；不要使用 Markdown 代码块，也不要添加任何解释。" },
  ];
  let lastFailure: "empty" | "invalid" = "empty";

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      signal: request.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `${system}${attempt.reminder}` },
          { role: "user", content: JSON.stringify(input) },
        ],
        ...(attempt.mode === "json" ? { response_format: { type: "json_object" } } : {}),
        thinking: { type: "disabled" },
        temperature: 0.15,
        max_tokens: safeMaxTokens,
      }),
    });
    const rawPayload = await response.text();
    let payload: CompletionPayload;
    try {
      payload = JSON.parse(rawPayload) as CompletionPayload;
    } catch {
      if (!response.ok) throw new Error(`DeepSeek 请求失败（${response.status}）`);
      payload = {};
    }
    if (!response.ok) throw new Error(payload.error?.message || `DeepSeek 请求失败（${response.status}）`);

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      lastFailure = "empty";
      logEmptyResult(payload, response, index + 1, attempt.mode);
      continue;
    }
    try {
      return extractJson(content);
    } catch {
      lastFailure = "invalid";
      logEmptyResult(payload, response, index + 1, attempt.mode);
    }
  }

  if (lastFailure === "invalid") throw new Error("DeepSeek 返回格式异常，已自动重试，请稍后再试");
  throw new Error("DeepSeek 本次返回为空，已自动重试，请稍后再试");
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "AI 服务暂时不可用";
  return Response.json({ error: message }, { status: /API Key|401|认证|Authentication/i.test(message) ? 401 : 502 });
}
