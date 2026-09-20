import { deepseekJson, errorResponse } from "../_deepseek";
import { getResumeKnowledgeContext, resolveResumeStructure } from "../../../lib/resume-methodology";
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

const textList = (value: unknown, limit: number) => (Array.isArray(value) ? value : [])
  .map(String)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, limit);

const score = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const fitStatus = (value: unknown) => value === "covered" || value === "partial" || value === "missing" ? value : "partial";

const priority = (value: unknown) => value === "high" || value === "medium" || value === "low" ? value : "medium";

const coverageCategory = (value: unknown) => ["硬性要求", "核心职责", "加分条件", "量化成果"].includes(String(value)) ? String(value) : "核心职责";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      job?: Record<string, unknown>;
      profile?: { archives?: unknown[] } & Record<string, unknown>;
    };
    if (!body.job || typeof body.job !== "object") return json({ error: "请先选择目标岗位" }, { status: 400 });
    if (!body.profile || !Array.isArray(body.profile.archives) || !body.profile.archives.length) {
      return json({ error: "职业档案中还没有可分析的经历" }, { status: 400 });
    }
    assertInputSize(body, 100_000, "简历规划内容");
    const structure = resolveResumeStructure(body.job, body.profile);
    const knowledge = getResumeKnowledgeContext(body.job, body.profile);

    const prompt = `你是严谨的求职简历策略助手。请比较目标岗位与候选人的职业档案，为“岗位专属简历”选择最相关的真实素材。
只输出严格 JSON：
{"jobSummary":"一句话说明这个岗位实际要解决什么问题，不超过60字","requiredSkills":["岗位明确或强烈隐含的具体技能、工具、业务能力"],"requiredExperience":["岗位期望的经历类型、场景或交付成果"],"overallMatch":0,"scoreReason":"用一句话解释综合匹配度","recruitmentLogic":[{"dimension":"硬性门槛","status":"covered|partial|missing","conclusion":"简短结论","basis":"JD 条件与档案证据的对照依据"}],"requirementCoverage":[{"requirement":"JD 中的一项具体要求","category":"硬性要求|核心职责|加分条件|量化成果","status":"covered|partial|missing","evidence":"档案中的直接证据；没有则说明未体现"}],"improvementPriorities":[{"action":"可执行的补强动作","priority":"high|medium|low","reason":"它对应的具体缺口"}],"materials":[{"archiveIndex":0,"score":0,"reason":"命中：具体能力；缺口：具体不足。不超过35字","recommended":true}]}

规则：
1. requiredSkills 保留4至8项；requiredExperience 保留2至5项。不要包含薪资、福利、地点、性别等无关信息。
2. overallMatch 必须基于档案中的直接证据计算，满分100：核心技能40分、相关经历35分、可验证成果15分、岗位明确硬性条件10分。信息缺失不能视为满足，也不能为了鼓励候选人虚增分数。
3. materials 必须覆盖职业档案中的每一项，archiveIndex 与输入数组下标严格一致。每项 score 表示它写入这份简历的相关度，不是内容质量分。
4. recommended 表示允许进入本次简历生成的候选素材。默认应尽量多选：先保证一页 A4 简历有足够内容，再删除明显无关、严重重复或会挤占更强证据的素材。不要为了“精简”而过早少选。
5. 推荐数量规则：档案不超过6项时，除非明显无关，优先全部推荐；超过6项时通常推荐4至7项。若素材本身不足，可以全部推荐。教育经历只要真实存在且不会造成明显误导，通常应保留。
6. 选择必须服务于具体岗位 JD：优先能够证明 JD 核心职责、工具、业务场景和成果要求的素材；弱相关素材只能用于补足简历长度。
7. 素材推荐不仅看单项相关度，还要服务于结构引擎给出的最终章节顺序；需要教育前置时保留完整教育素材，需要工作前置时优先保留近期相关成果。
8. materials.reason 必须使用“命中：…；缺口：…”的短句格式；没有明确缺口时写“缺口：无明显缺口”。
9. 只能引用输入中存在的事实，不得编造技能、经历、数字或成果。不要输出 Markdown 或额外解释。
10. recruitmentLogic 固定输出5项且按此顺序：硬性门槛、核心职责、能力证据、相关项目、量化成果。covered 表示有直接证据，partial 表示只有间接或不完整证据，missing 表示未体现。basis 必须说明判断依据，不能只重复 conclusion。
11. requirementCoverage 逐项拆解影响筛选的 JD 要求，保留6至12项并去重；category 只能是“硬性要求、核心职责、加分条件、量化成果”。每项必须能追溯到 JD，status 必须基于档案证据，不能用主观概率代替。
12. improvementPriorities 保留最多3项，优先处理 requirementCoverage 中 partial 或 missing 且影响较大的要求。动作不得建议编造经历，只能补充真实证据、量化已有成果或调整表达。

${knowledge}`;

    const raw = await deepseekJson(request, prompt, { job: body.job, profile: body.profile }, 1800);
    const archiveCount = body.profile.archives.length;
    const materials = (Array.isArray(raw.materials) ? raw.materials : [])
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        archiveIndex: Math.round(Number(item.archiveIndex)),
        score: score(item.score),
        reason: String(item.reason || "AI 未提供关联说明").trim().slice(0, 120),
        recommended: Boolean(item.recommended),
      }))
      .filter((item) => Number.isInteger(item.archiveIndex) && item.archiveIndex >= 0 && item.archiveIndex < archiveCount)
      .filter((item, index, values) => values.findIndex((candidate) => candidate.archiveIndex === item.archiveIndex) === index)
      .sort((a, b) => a.archiveIndex - b.archiveIndex);

    const completedMaterials = Array.from({ length: archiveCount }, (_, archiveIndex) => materials.find((item) => item.archiveIndex === archiveIndex) ?? { archiveIndex, score: 0, reason: "AI 未单独分析该素材，默认保留供人工确认", recommended: archiveCount <= 6 });
    const requestedRecommendations = completedMaterials.filter((item) => item.recommended).sort((a, b) => b.score - a.score);
    const minimumRecommended = Math.min(archiveCount, archiveCount <= 6 ? archiveCount : 4);
    const expandedRecommendations = requestedRecommendations.length >= minimumRecommended
      ? requestedRecommendations
      : [...requestedRecommendations, ...completedMaterials.filter((item) => !item.recommended).sort((a, b) => b.score - a.score)]
        .slice(0, minimumRecommended);
    const recommendedIndexes = new Set(expandedRecommendations.slice(0, 7).map((item) => item.archiveIndex));

    return json({
      jobSummary: String(raw.jobSummary || "AI 暂未生成岗位说明").trim().slice(0, 300),
      requiredSkills: textList(raw.requiredSkills, 8),
      requiredExperience: textList(raw.requiredExperience, 5),
      overallMatch: score(raw.overallMatch),
      scoreReason: String(raw.scoreReason || "根据职业档案中的技能、经历与成果证据综合判断").trim().slice(0, 180),
      recruitmentLogic: (Array.isArray(raw.recruitmentLogic) ? raw.recruitmentLogic : [])
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
          dimension: String(item.dimension || "招聘判断").trim().slice(0, 20),
          status: fitStatus(item.status),
          conclusion: String(item.conclusion || "待确认").trim().slice(0, 40),
          basis: String(item.basis || "当前档案信息不足，需进一步确认").trim().slice(0, 140),
        }))
        .slice(0, 5),
      requirementCoverage: (Array.isArray(raw.requirementCoverage) ? raw.requirementCoverage : [])
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
          requirement: String(item.requirement || "未命名要求").trim().slice(0, 80),
          category: coverageCategory(item.category),
          status: fitStatus(item.status),
          evidence: String(item.evidence || "职业档案中未体现直接证据").trim().slice(0, 160),
        }))
        .filter((item) => item.requirement)
        .slice(0, 12),
      improvementPriorities: (Array.isArray(raw.improvementPriorities) ? raw.improvementPriorities : [])
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
          action: String(item.action || "补充对应岗位要求的真实证据").trim().slice(0, 90),
          priority: priority(item.priority),
          reason: String(item.reason || "当前档案中的相关证据不足").trim().slice(0, 120),
        }))
        .filter((item) => item.action)
        .slice(0, 3),
      structure: {
        stage: structure.stage,
        stageLabel: structure.stageLabel,
        sectionOrder: structure.sectionOrder,
        reason: structure.reason,
      },
      materials: completedMaterials.map((item) => ({ ...item, recommended: recommendedIndexes.has(item.archiveIndex) })),
    });
  } catch (error) {
    const response = errorResponse(error);
    const body = await response.json();
    return json(body, { status: response.status });
  }
}
