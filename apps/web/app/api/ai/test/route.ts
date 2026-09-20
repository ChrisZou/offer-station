import { deepseekJson, errorResponse } from "../_deepseek";

export async function POST(request: Request) {
  try {
    const result = await deepseekJson(request, "你是 API 连通性检查器。只返回 JSON：{\"ok\":true,\"message\":\"连接成功\"}。", { task: "ping" }, 80);
    return Response.json({ ok: result.ok === true, message: String(result.message || "连接成功"), model: "deepseek-v4-flash" });
  } catch (error) {
    return errorResponse(error);
  }
}
