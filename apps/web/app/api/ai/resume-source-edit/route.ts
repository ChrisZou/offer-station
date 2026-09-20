import { deepseekJson, errorResponse } from "../_deepseek";
import { getResumeKnowledgeContext } from "../../../lib/resume-methodology";
import { assertInputSize } from "../_guardrails";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key", "Cache-Control": "no-store" };
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...cors, ...init.headers } });

function cleanSource(value: unknown) {
  return String(value || "").trim().replace(/^```(?:typst)?\s*/i, "").replace(/\s*```$/, "").slice(0, 24000);
}

// The injected source uses one of four entry syntaxes depending on the
// template. The model must not decide on its own what "one experience" looks
// like in the source — that is exactly how a new entry ends up appended as a
// bullet of the previous one.
function sourceStructureGuide(template: unknown) {
  const id = String(template || "");
  if (id === "habaneraa-one-page-resume-zh") {
    return `【当前模板源码结构，修改前必须先对照源码逐条确认】
- 整份简历由 "// SECTION: 章节名 — 职责" 注释 + "= 章节名" 标题 + 条目组成；// TEMPLATE CONTRACT 之前的三行（import、setup-styles、resume-header）不能动。
- 每段经历是一个独立的 #resume-entry(title: "经历名", subtitle: "单位与角色", date: "时间")[ 块，块内是以 "- " 开头的要点。
- 新增一段经历 = 在对应章节的 SECTION 区内新增一个完整的 #resume-entry 块；严禁把新经历写成已有 #resume-entry 块内的一个要点，也严禁把经历塞进"个人优势"或"专业技能"SECTION。`;
  }
  if (id === "bone-resume") {
    return `【当前模板源码结构，修改前必须先对照源码逐条确认】
- 整份简历由 import 行、#show: resume-init 行、标题行与若干 #resume-section 块组成。
- 每段经历是一个独立的 #resume-section("经历名 · 单位与角色", "时间")[ 块，块内是以 "- " 开头的要点。
- 新增一段经历 = 在摘要之后、= 专业技能 之前新增一个完整的 #resume-section 块；严禁把新经历写成已有 #resume-section 块内的一个要点。`;
  }
  if (id === "altacv") {
    return `【当前模板源码结构，修改前必须先对照源码逐条确认】
- 整份简历是一个 #let cv = (basics: (...), work: (...), skills: (...)) 数据字典，最后由 #alta(cv, ...) 渲染。
- 每段经历是 work: ( 数组中的一个条目：(name: "单位", position: "职位", startDate: "时间", highlights: ("要点1", "要点2",))。
- 新增一段经历 = 在 work: ( 数组内新增一个完整的 (name: ..., position: ..., startDate: ..., highlights: (...)) 条目；严禁把新经历写成已有条目 highlights 里的一个字符串。`;
  }
  return `【当前模板源码结构，修改前必须先对照源码逐条确认】
- 整份简历由 "#import ...: *"、#set 排版行、居中的姓名与求职意向行，以及若干 "== 章节名" 小节组成。
- 每段经历在章节内是一行 "*经历标题*\u3000单位与角色\u3000时间"，其后紧跟 2—4 行以 "- " 开头的要点。
- 新增一段经历 = 在对应 == 章节内新增一行 "*经历标题*\u3000单位与角色\u3000时间" 并紧跟其要点行；严禁把新经历写成已有经历标题下的一个 "- " 要点。`;
}

export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { instruction?: unknown; typstSource?: unknown; compileError?: unknown; currentResume?: unknown; sourceDraft?: unknown; job?: unknown; history?: unknown };
    const instruction = String(body.instruction || "").trim().slice(0, 1400);
    const typstSource = cleanSource(body.typstSource);
    if (!instruction || !typstSource) return json({ error: "缺少编辑指令或 Typst 源码" }, { status: 400 });
    assertInputSize({ typstSource, currentResume: body.currentResume, sourceDraft: body.sourceDraft, job: body.job }, 120_000, "Typst 编辑内容");
    const history = Array.isArray(body.history) ? body.history.slice(-20).map((item) => {
      const record = item as Record<string, unknown>;
      const speaker = String(record.role || "") === "assistant" ? "AI" : "用户";
      return `${speaker}：${String(record.text || "").slice(0, 400)}`;
    }).filter(Boolean) : [];
    const historyBlock = history.length ? `\n【之前的修改对话记录，供理解上下文；已完成的要求不要重复执行，除非用户再次明确提出】\n${history.join("\n")}` : "";
    const knowledge = getResumeKnowledgeContext(body.job, body.sourceDraft);
    const templateId = body.currentResume && typeof body.currentResume === "object" ? String((body.currentResume as Record<string, unknown>).template || "") : "";
    const prompt = `你是中文简历 Typst 源码编辑与编译审校专家。用户编辑的是已打包的真实 Typst 模板源码，不是 JSON 模块，也不是 LaTeX。
修改流程（必须遵守）：第一步先完整通读整份源码，对照下方"当前模板源码结构"确认每个章节的条目写法；第二步按用户指令修改；第三步输出前逐项自检下方规则。
${sourceStructureGuide(templateId)}
修改规则：
1. 个人优势只能是 2—3 行的岗位匹配概述，绝不能包含公司、任职、项目、教育、日期或 bullet 细节。
2. 工作/实习、项目、教育、成果、技能必须留在各自章节；不得把全部经历塞进个人优势。
3. 不改变 #import、setup-styles、resume-header、函数调用名和已有真实模板结构；不得输出 Markdown 或解释。
4. 只能使用当前简历/档案中已有的事实，以及用户在本条指令中明确要求添加的具体内容（如实写入，不自行扩写或改动其含义）；除此之外不得自行创造公司、学校、职位、项目、数字、证书或技能。
5. 用户要求新增一段经历（如校园活动、社团、兼职、实习等）时，必须按下方结构说明新增一个完整的独立经历条目，严禁把新经历写成已有经历条目内的一个要点（"- " 行或 highlights 字符串）；新经历按内容类型放入对应章节（项目/活动类进项目或活动章节，工作类进工作章节），时间倒序排列。
6. 遵循下方章节顺序、时间倒序和一页 A4 规则。每个章节只保留语义相符的内容，优先删重而不是混放。
7. 检查括号、方括号、引号、逗号和 Typst 函数调用配对；若收到编译错误，优先最小化修复该错误。
只输出严格 JSON：{"typstSource":"完整可编译的 Typst 源码","message":"一句话说明"}。

${knowledge}
${historyBlock}
${body.compileError ? `\n本地 Typst 编译错误（必须修复）：${String(body.compileError).slice(0, 1800)}` : ""}`;
    const raw = await deepseekJson(request, prompt, { instruction, typstSource, currentResume: body.currentResume, sourceDraft: body.sourceDraft, job: body.job }, 10000);
    const nextSource = cleanSource(raw.typstSource);
    // Some packaged templates render with `#import ...: *` and plain sections
    // instead of a `#show` rule; only the package import is a universal contract.
    if (!nextSource || !nextSource.includes("#import")) throw new Error("AI 未返回完整的 Typst 模板源码");
    return json({ typstSource: nextSource, message: String(raw.message || "已完成 Typst 源码审校").slice(0, 200) });
  } catch (error) { const response = errorResponse(error); return json(await response.json(), { status: response.status }); }
}
