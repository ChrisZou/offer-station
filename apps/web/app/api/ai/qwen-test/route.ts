import { QWEN_VL_MODEL, qwenErrorResponse, qwenVisionJson } from "../_qwen";

// Qwen3-VL-Flash rejects images whose width or height is <= 10px. Keep the
// connectivity check cheap, but use a valid transparent 16 × 16 PNG instead
// of a 1 × 1 tracking pixel.
const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVR4nGNgGAWjYBSMAggAAAQQAAFVN1rQAAAAAElFTkSuQmCC";

export async function POST(request: Request) {
  try {
    await qwenVisionJson(request, '识别图片并只返回 JSON：{"ok":true}', {}, [testImage], 80);
    return Response.json({ ok: true, message: "视觉模型连接正常", model: QWEN_VL_MODEL });
  } catch (error) { return qwenErrorResponse(error); }
}
