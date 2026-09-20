import { deepseekJson, errorResponse } from "../_deepseek";
import { getResumeKnowledgeContext, resolveResumeMethodology } from "../../../lib/resume-methodology";
import { assertInputSize } from "../_guardrails";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key",
  "Cache-Control": "no-store",
};

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, {
  ...init,
  headers: { ...cors, ...init.headers },
});

function sanitizeResumeHtml(value: unknown) {
  const allowed = /^(?:h1|h2|h3|p|ul|ol|li|strong|em|u|s|a|hr|br)$/i;
  return String(value || "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?:script|style|iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/<([^>]+)>/g, (tag, inside: string) => {
      const closing = inside.startsWith("/");
      const name = inside.replace(/^\//, "").trim().split(/[\s/>]/)[0];
      if (!allowed.test(name)) return "";
      if (closing) return `</${name.toLowerCase()}>`;
      if (name.toLowerCase() === "a") {
        const href = inside.match(/href=["']([^"']+)["']/i)?.[1] || "";
        return href && /^(?:https?:|mailto:|tel:)/i.test(href) ? `<a href="${href.replace(/["<>]/g, "")}">` : "<a>";
      }
      return `<${name.toLowerCase()}>`;
    })
    .slice(0, 50000);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      instruction?: unknown;
      currentHtml?: unknown;
      job?: unknown;
      sourceDraft?: unknown;
      design?: unknown;
    };
    const instruction = String(body.instruction || "").trim().slice(0, 1000);
    const currentHtml = sanitizeResumeHtml(body.currentHtml);
    if (!instruction) return json({ error: "请输入希望 AI 如何修改" }, { status: 400 });
    if (!currentHtml) return json({ error: "当前简历没有可编辑内容" }, { status: 400 });
    assertInputSize({ currentHtml, job: body.job, sourceDraft: body.sourceDraft }, 110_000, "简历编辑内容");
    const methodology = resolveResumeMethodology(body.job);
    const knowledge = getResumeKnowledgeContext(body.job, body.sourceDraft);

    const prompt = `你是严谨的中文简历编辑与排版助手。用户会提供当前简历 HTML、目标岗位和修改要求。请直接修改简历，并只输出严格 JSON：
{"html":"修改后的完整简历 HTML","message":"用一句话说明具体修改","design":{"fontFamily":"保持 currentDesign.fontFamily","fontSize":9至12,"lineHeight":1.4至1.75,"pageMargin":36至56,"accentColor":"保持或使用允许颜色"}}

必须遵守：
1. 当前简历和 sourceDraft 中已有的信息都可使用；不得创造不存在的学校、公司、职位、项目、技能、数字、证书或成果。
2. 简历结构必须遵循下方中央结构引擎给出的“最终章节顺序”；没有内容的小节不输出，不得仅凭固定习惯移动教育经历。
3. 每段经历使用“标题/单位/角色/日期 + 2至4条要点”，要点优先呈现动作、方法和真实结果；不写空泛自我评价。
4. 在校/应届、科研学术和学历强筛选岗位前置教育经历；三年以上相关经验者优先工作成果，将教育经历放到工作或项目之后；职场早期按结构引擎判断。只有用户明确要求时才能覆盖这一顺序。
5. 默认控制为一页 A4：删除重复内容、压缩空话，但不能删掉关键事实。用户要求“更紧凑、放进一页、调整排版”时可同步返回 design。
6. 允许的 HTML 标签只有 h1、h2、h3、p、ul、ol、li、strong、em、u、s、a、hr、br；不输出 class、style、Markdown、解释文字或代码块。
7. 如果用户要求会导致信息造假，拒绝执行该部分，在 message 中说明，并保持原事实。
8. design 未被修改时原样返回，不要自行替换模板推荐字体。accentColor 只能使用 currentDesign 中的颜色或工作台专业模板色。
9. 当前使用工作台的“${methodology.name}”方法库；用户说“按方法库优化”时，重排小节、压缩弱要点并强化岗位证据，但仍不得添加事实。

${knowledge}`;

    const raw = await deepseekJson(request, prompt, {
      instruction,
      currentHtml,
      job: body.job,
      sourceDraft: body.sourceDraft,
      currentDesign: body.design,
    }, 3000);
    const rawDesign = raw.design && typeof raw.design === "object" ? raw.design as Record<string, unknown> : {};
    const currentDesign = body.design && typeof body.design === "object" ? body.design as Record<string, unknown> : {};
    const allowedFonts = ["source-han-sans", "source-han-serif", "deedy-source", "lato-source", "ibm-plex-sans", "ibm-plex-serif", "pingfang", "st-serif", "ctex-default", "xiaobiaosong-mono"];
    const fontFamily = allowedFonts.includes(String(rawDesign.fontFamily)) ? String(rawDesign.fontFamily) : String(currentDesign.fontFamily || "source-han-sans");
    const fontSize = Math.min(12, Math.max(9, Number(rawDesign.fontSize) || Number(currentDesign.fontSize) || 10.5));
    const lineHeight = Math.min(1.75, Math.max(1.4, Number(rawDesign.lineHeight) || Number(currentDesign.lineHeight) || 1.5));
    const pageMargin = Math.min(56, Math.max(36, Number(rawDesign.pageMargin) || Number(currentDesign.pageMargin) || 40));
    const allowedColors = ["#284967", "#087F7A", "#008F88", "#000066", "#2E6FA3", "#222222", "#326891", "#245A73", "#305F86", "#566A9B", "#8A1538", "#1F5F8B"];
    const accentColor = allowedColors.some((color) => color.toLowerCase() === String(rawDesign.accentColor).toLowerCase()) ? String(rawDesign.accentColor) : String(currentDesign.accentColor || "#284967");
    const html = sanitizeResumeHtml(raw.html);
    if (!html) throw new Error("AI 未返回可用的简历内容");
    return json({
      html,
      message: String(raw.message || "已按要求更新简历").slice(0, 200),
      design: { fontFamily, fontSize, lineHeight, pageMargin, accentColor },
    });
  } catch (error) {
    const response = errorResponse(error);
    const body = await response.json();
    return json(body, { status: response.status });
  }
}
