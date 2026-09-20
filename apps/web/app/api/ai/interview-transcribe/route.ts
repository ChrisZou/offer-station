import { errorResponse } from "../_deepseek";

export async function POST(request: Request) {
  try {
    const key = request.headers.get("X-DashScope-API-Key")?.trim();
    if (!key) return Response.json({ error: "请先在设置中接入阿里云百炼 API Key，用于录音转写" }, { status: 401 });
    if (Number(request.headers.get("content-length")) > 11_000_000) return Response.json({ error: "录音片段过大" }, { status: 413 });
    const { audio } = await request.json();
    if (typeof audio !== "string" || audio.length > 10_500_000 || !/^data:audio\/wav;base64,[A-Za-z0-9+/]+=*$/.test(audio)) return Response.json({ error: "请上传有效的 WAV 录音片段" }, { status: 400 });
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST", signal: request.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "qwen3-asr-flash", messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: audio } }] }], stream: false, asr_options: { enable_itn: false } }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `录音转写失败（${response.status}）`);
    const transcript = body.choices?.[0]?.message?.content;
    if (typeof transcript !== "string" || !transcript.trim()) throw new Error("未识别到语音，请检查录音是否清晰");
    return Response.json({ transcript }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
