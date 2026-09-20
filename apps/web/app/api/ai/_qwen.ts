import { assertInputSize } from "./_guardrails";

const QWEN_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
export const QWEN_VL_MODEL = "qwen3-vl-flash";

type QwenPayload = {
  id?: string;
  error?: { message?: string };
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
};

function extractJson(value: string) {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean) as Record<string, unknown>; } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("Qwen 返回内容不是可解析的 JSON");
  }
}

export function validateResumeImages(images: unknown) {
  if (!Array.isArray(images) || !images.length) throw new Error("没有收到可识别的简历页面");
  if (images.length > 6) throw new Error("一次最多识别 6 页简历");
  let total = 0;
  const valid = images.map((value) => {
    const image = String(value);
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(image)) throw new Error("仅支持 JPG、PNG 或 WebP 页面图片");
    total += image.length;
    return image;
  });
  if (total > 24_000_000) throw new Error("简历图片总大小超过 18MB，请降低分辨率后重试");
  return valid;
}

export async function qwenVisionJson(request: Request, system: string, input: unknown, images: string[], maxTokens = 4200) {
  const apiKey = request.headers.get("X-DashScope-API-Key")?.trim();
  if (!apiKey) throw new Error("缺少阿里云百炼 API Key，请先到设置页接入 Qwen3-VL-Flash");
  assertInputSize(input, 90_000, "视觉 AI 上下文");
  if (system.length > 20_000) throw new Error("视觉 AI 系统规则过长");
  const content: Array<Record<string, unknown>> = [
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
    { type: "text", text: `请阅读以上简历页面。输入上下文：${JSON.stringify(input)}` },
  ];
  const response = await fetch(QWEN_URL, {
    method: "POST",
    signal: request.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: QWEN_VL_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content }],
      response_format: { type: "json_object" },
      enable_thinking: false,
      temperature: 0.05,
      max_tokens: Math.min(8_000, Math.max(80, Math.round(maxTokens))),
    }),
  });
  const text = await response.text();
  let payload: QwenPayload = {};
  try { payload = JSON.parse(text) as QwenPayload; } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload.error?.message || `Qwen 请求失败（${response.status}）`);
  const result = payload.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error("Qwen 未返回识别结果，请稍后重试");
  return extractJson(result);
}

export function qwenErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Qwen 视觉服务暂时不可用";
  return Response.json({ error: message }, { status: /API Key|401|认证|Authentication/i.test(message) ? 401 : 502 });
}
