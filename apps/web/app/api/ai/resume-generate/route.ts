import { deepseekJson, errorResponse } from "../_deepseek";
import { getResumeKnowledgeContext, getResumeTemplatePreset, RESUME_TEMPLATE_REFERENCES, resolveResumeMethodology, resolveResumeStructure, sortResumeEntries } from "../../../lib/resume-methodology";
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

const list = (value: unknown, limit: number) => (Array.isArray(value) ? value : [])
  .map(String)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, limit);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      job?: Record<string, unknown>;
      selectedArchives?: unknown[];
    };
    if (!body.job || typeof body.job !== "object") return json({ error: "缺少目标岗位" }, { status: 400 });
    if (!Array.isArray(body.selectedArchives) || !body.selectedArchives.length) {
      return json({ error: "请至少选择一条真实经历" }, { status: 400 });
    }
    assertInputSize({ job: body.job, selectedArchives: body.selectedArchives }, 90_000, "岗位与档案内容");
    const methodology = resolveResumeMethodology(body.job);
    const structure = resolveResumeStructure(body.job, body.selectedArchives);
    const knowledge = getResumeKnowledgeContext(body.job, body.selectedArchives);
    const templateCatalog = RESUME_TEMPLATE_REFERENCES.map((item) => `${item.id}=${item.name}（${item.suitable}）`).join("；");

    const prompt = `你是专业中文简历编辑。根据具体目标岗位 JD，将候选人允许使用的真实档案素材重组为一份高度定制化、ATS 友好的岗位专属简历。
只输出严格 JSON：
{"title":"简历名称","targetRole":"目标岗位","headline":"不超过24字的职业定位","summary":"80至140字个人简介","skills":["与岗位相关的技能"],"experiences":[{"sourceIndex":0,"type":"工作经历|项目经历|教育经历|成果证明","title":"原经历标题，可做简洁规范化","subtitle":"公司、项目或学校及角色","date":"原时间","bullets":["以行动和结果为主的简历要点"]}],"template":"${RESUME_TEMPLATE_REFERENCES.map((item) => item.id).join("|")}"}

规则：
1. 只能重写 selectedArchives 中已有的事实，不得增加不存在的公司、职位、项目、技能、数字、证书或成果。
2. 目标是内容充足的一页 A4 中文简历：summary 90至140字，通常保留3至6段最有说服力的经历、总计8至14条 bullets。素材不足时如实缩短，绝不编造填充。
3. selectedArchives 是“允许使用的素材池”，不是必须逐条照搬。先尽量使用更多真实经历保证篇幅；只有预计超过一页、内容明显重复或与 JD 无关时才省略较弱素材。
4. 每个 experience 的 sourceIndex 必须对应输入数组下标，每项2至4条 bullets。按 JD 调整描述顺序和措辞：优先呈现与岗位职责、工具、业务场景和成果指标直接相关的内容。
5. skills 只保留档案已有且与目标岗位有关的技能，按 JD 重要性排序，8至14项；不要把岗位要求冒充成候选人技能。
6. headline 与 summary 必须针对本岗位说明候选人能解决什么问题，但不能夸大资历。bullet 使用“动作 + 场景/方法 + 真实结果”的表达，保留输入中的量化事实。
7. 使用自然、具体、克制的中文，不输出求职建议、匹配分数、Markdown 或额外解释。
8. 输出经历和章节必须严格遵循下方结构引擎给出的“最终章节顺序”。不要自行把教育经历固定放在最前：只有结构引擎判断为在校/应届、科研学术或学历强筛选场景时才前置；有经验候选人以近期工作成果优先。不得把所有内容混在“相关经历”中。
9. 教育经历保留学校、专业、学历和日期；工作与项目经历突出职责、方法、工具和真实成果；成果证明用于奖项、证书、论文或作品。
10. 首次生成时从工作台已核验开源来源与许可证的真实 Typst 源模板中选择：${templateCatalog}。当前岗位推荐 ${methodology.recommendedTemplate}，除非候选人经历量或使用场景明显更适合其他模板。
11. 只选择模板，不自行决定字体、字号或颜色。工作台会严格应用该开源模板对应的推荐排版预设。
12. 首次生成按“发布前质量门禁”处理：完成初稿后静默复核岗位证据覆盖、事实可追溯、章节归位、日期与数字一致性、关键词自然覆盖、ATS 可读性及一页纸预算；发现问题必须在输出前修正。不要输出评分或复核过程。

${knowledge}`;

    const raw = await deepseekJson(request, prompt, {
      job: body.job,
      selectedArchives: body.selectedArchives,
    }, 2600);

    const sourceCount = body.selectedArchives.length;
    const parsedExperiences = (Array.isArray(raw.experiences) ? raw.experiences : [])
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        sourceIndex: Math.round(Number(item.sourceIndex)),
        type: String(item.type || "相关经历").trim().slice(0, 30),
        title: String(item.title || "未命名经历").trim().slice(0, 100),
        subtitle: String(item.subtitle || "").trim().slice(0, 140),
        date: String(item.date || "").trim().slice(0, 40),
        bullets: list(item.bullets, 4).map((bullet) => bullet.slice(0, 220)),
      }))
      .filter((item) => Number.isInteger(item.sourceIndex) && item.sourceIndex >= 0 && item.sourceIndex < sourceCount)
      .filter((item, index, values) => values.findIndex((candidate) => candidate.sourceIndex === item.sourceIndex) === index);
    const experiences = sortResumeEntries(parsedExperiences, structure)
      .map((item) => ({
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        date: item.date,
        bullets: item.bullets,
      }));
    if (!experiences.length) throw new Error("AI 未返回可用经历，已阻止生成空白简历");

    const allowedTemplates = RESUME_TEMPLATE_REFERENCES.map((item) => item.id);
    const template = allowedTemplates.includes(String(raw.template)) ? String(raw.template) : methodology.recommendedTemplate;

    const result = {
      title: String(raw.title || `${String(body.job.title || "目标岗位")}专属简历`).trim().slice(0, 100),
      targetRole: String(raw.targetRole || body.job.title || "目标岗位").trim().slice(0, 100),
      headline: String(raw.headline || body.job.title || "").trim().slice(0, 100),
      summary: String(raw.summary || "").trim().slice(0, 600),
      skills: list(raw.skills, 14).map((skill) => skill.slice(0, 60)),
      experiences,
      template,
      design: getResumeTemplatePreset(template),
      methodologyId: methodology.id,
      methodologyName: methodology.name,
    };
    return json(result);
  } catch (error) {
    const response = errorResponse(error);
    const body = await response.json();
    return json(body, { status: response.status });
  }
}
