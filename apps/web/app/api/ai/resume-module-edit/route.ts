import { deepseekJson, errorResponse } from "../_deepseek";
import { getResumeKnowledgeContext, resolveResumeStructure, sortResumeEntries } from "../../../lib/resume-methodology";
import { assertInputSize } from "../_guardrails";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key", "Cache-Control": "no-store" };
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...cors, ...init.headers } });
const list = (value: unknown, limit: number) => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];

export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { instruction?: unknown; currentResume?: unknown; sourceDraft?: unknown; job?: unknown };
    const instruction = String(body.instruction || "").trim().slice(0, 1200);
    if (!instruction) return json({ error: "请输入希望 AI 如何优化" }, { status: 400 });
    assertInputSize({ currentResume: body.currentResume, sourceDraft: body.sourceDraft, job: body.job }, 100_000, "简历编辑上下文");
    const knowledge = getResumeKnowledgeContext(body.job, body.sourceDraft);
    const prompt = `你是严谨的中文简历编辑助手。用户可以用自然语言编辑整份模块化简历，不是 LaTeX 源码。请只输出严格 JSON：
{"resume":{"title":"简历名称","targetRole":"目标岗位","headline":"职业定位","personalInfo":{"name":"姓名","phone":"电话","email":"邮箱","city":"城市"},"summary":"个人优势","skills":["技能"],"experiences":[{"type":"工作经历|项目经历|教育经历|成果证明","title":"名称","subtitle":"角色或单位","date":"原时间","bullets":["要点"]}]},"message":"一句话说明修改"}

规则：
1. 只能重组或润色档案与当前简历中已有的事实；不得创造学校、公司、职位、项目、技能、数字、证书或成果。
2. 保留所有仍相关的经历模块；每个经历 2—4 条要点，采用“动作 + 场景/方法 + 真实结果”。
3. “填满一页 / 填满一整页”是明确的视觉目标：单页 A4 的正文末尾应接近可用页面高度的 82%—95%，不能把“内容不超过一页”误解为“尽量压缩”。应先保留全部相关经历，再从 currentResume 和 sourceDraft 中补回已存在但未展示的真实职责、技术细节和结果；每段保留 2—4 条最有价值的真实要点。不得为了凑篇幅编造内容。
4. 用户说“填满一页”时，不要把个人优势机械压缩成两行，不要删除相关经历来换取单页；只有内容确实会溢出 A4 时才删除重复表达。若所有可验证素材仍不足以达到该高度，保持真实内容，并在 message 中清楚说明“现有真实素材不足以填满页面”，不要声称已经填满。
5. 每次修改后静默复核：个人优势不得混入经历；每条要点可追溯到已有事实；日期、数字和技能名称前后一致；关键词自然匹配 JD；不得为了填满一页而堆砌或虚构。
6. 输出只包含可直接写回编辑器的内容，不输出 LaTeX、HTML、Markdown、代码围栏或解释。

${knowledge}`;
    const raw = await deepseekJson(request, prompt, { instruction, currentResume: body.currentResume, sourceDraft: body.sourceDraft, job: body.job }, 4200);
    const data = raw.resume && typeof raw.resume === "object" ? raw.resume as Record<string, unknown> : {};
    const experiences = (Array.isArray(data.experiences) ? data.experiences : []).map((item) => item as Record<string, unknown>).map((item) => ({ type: String(item.type || "项目经历").slice(0, 30), title: String(item.title || "未命名经历").slice(0, 100), subtitle: String(item.subtitle || "").slice(0, 140), date: String(item.date || "").slice(0, 40), bullets: list(item.bullets, 5).map((bullet) => bullet.slice(0, 240)) })).filter((item) => item.title && item.bullets.length);
    if (!experiences.length) throw new Error("AI 未返回可用的经历模块");
    const orderedExperiences = sortResumeEntries(experiences, resolveResumeStructure(body.job, experiences));
    const personalInfo = data.personalInfo && typeof data.personalInfo === "object" ? Object.fromEntries(Object.entries(data.personalInfo as Record<string, unknown>).map(([key, value]) => [key.slice(0, 40), String(value || "").slice(0, 120)])) : {};
    const resume = { title: String(data.title || "").slice(0, 120), targetRole: String(data.targetRole || "").slice(0, 100), headline: String(data.headline || "").slice(0, 100), personalInfo, summary: String(data.summary || "").slice(0, 600), skills: list(data.skills, 18).map((skill) => skill.slice(0, 60)), experiences: orderedExperiences };
    return json({ resume, message: String(raw.message || "已更新简历内容").slice(0, 200) });
  } catch (error) { const response = errorResponse(error); return json(await response.json(), { status: response.status }); }
}
