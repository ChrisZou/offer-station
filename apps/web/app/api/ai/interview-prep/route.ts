import { deepseekJson, errorResponse } from "../_deepseek";
import { assertInputSize } from "../_guardrails";

const categories = ["通用与动机", "岗位专业", "简历深挖", "行为与场景", "硬性风险"] as const;
type Category = typeof categories[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key",
  "Cache-Control": "no-store",
};

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...cors, ...init.headers } });
const text = (value: unknown, fallback = "") => String(value || fallback).trim();
const list = (value: unknown, limit: number) => Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean).slice(0, limit) : [];

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { job?: Record<string, unknown>; profile?: unknown; resume?: Record<string, unknown>; options?: { categories?: unknown; count?: unknown; focus?: unknown; existingQuestions?: unknown; requestedQuestions?: unknown } };
    if (!body.job || !text(body.job.id) || !text(body.job.title)) return json({ error: "缺少目标岗位信息" }, { status: 400 });
    assertInputSize(body, 100_000, "面试准备内容");

    const resume = body.resume && typeof body.resume === "object" ? body.resume : undefined;
    const requestedCategories = Array.isArray(body.options?.categories)
      ? body.options.categories.map(text).filter((item): item is Category => categories.includes(item as Category))
      : [];
    const requestedQuestions = list(body.options?.requestedQuestions, 3).map((item) => item.slice(0, 220));
    const additionalCount = requestedQuestions.length ? requestedQuestions.length : Math.min(8, Math.max(3, Math.round(Number(body.options?.count) || 5)));
    const focus = text(body.options?.focus).slice(0, 500);
    const existingQuestions = list(body.options?.existingQuestions, 40).map((item) => item.slice(0, 220));
    const isAdditional = requestedCategories.length > 0 || existingQuestions.length > 0 || Boolean(focus) || requestedQuestions.length > 0;
    const generationScope = isAdditional
      ? `本次是追加生成：只生成 ${additionalCount} 题；题型仅限 ${requestedCategories.length ? requestedCategories.join("、") : "用户选定范围"}。${requestedQuestions.length ? `必须逐字使用以下用户指定追问作为 question，不得改写问题本身：\n${requestedQuestions.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n请为它补全考察重点、回答框架、建议回答和进一步追问。` : ""}${focus ? `用户特别想准备：${focus}。` : ""}${existingQuestions.length ? `除上述用户指定追问外，不得与以下已有问题重复或只是换一种说法：\n${existingQuestions.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : ""}`
      : "本次生成一份完整题单。";
    const prompt = `你是一名面向中国求职者的面试准备教练。请根据目标岗位 JD、候选人的职业档案${resume ? "以及候选人针对该岗位定制的简历" : ""}生成一份可执行的面试问题包。
目标不是模拟语音面试，而是帮助候选人提前准备问题、回答结构、真实素材和追问。

${generationScope}

只返回严格 JSON：
{"questions":[{"category":"通用与动机|岗位专业|简历深挖|行为与场景|硬性风险","question":"面试问题","source":"问题依据，不超过30字","intent":"面试官在考察什么，不超过50字","answerFramework":[{"title":"步骤标题","guidance":"本步应该回答什么"}],"suggestedAnswer":"基于档案和简历事实写出的建议回答，120-220字","evidenceSuggestions":[{"title":"真实素材标题","detail":"可使用的具体事实或成果"}],"followUps":["向下追问的问题"]}]}

生成规则：
1. ${isAdditional ? `严格生成 ${additionalCount} 题，并遵守用户选择的题型与关注方向。` : "总计 10-14 题，通用与动机 2-3 题、岗位专业 3-5 题、简历深挖 2-3 题、行为与场景 2-3 题。"}
2. 只有 JD 存在明确门槛、重要偏好或档案存在冲突/缺失时才生成“硬性风险”问题，最多 2 题；不要凭空制造风险。
3. 岗位专业题必须来自 JD 的真实职责、工具、业务场景或交付目标；不能输出可以套用到任何岗位的空泛问题。
4. 简历深挖题必须引用定制简历或职业档案中的具体经历、表述或成果，重点挖掘简历里写的项目、数字和职责细节；两者都没有内容时不要编造公司、项目、数字。
5. 行为与场景题优先覆盖协作、判断、失败复盘和推进阻力，并结合岗位场景。
6. 每题给出 3 个回答步骤。动机题使用“选择理由-匹配证据-未来贡献”；经历和行为题使用“背景目标-关键行动-结果复盘”；专业题使用“判断框架-执行步骤-验证指标”。
7. evidenceSuggestions 只能使用定制简历或职业档案中真实存在的信息，每题 0-3 条；没有证据就返回空数组。
8. followUps 每题 2-3 条，由浅入深，业务题至少包含一个关于取舍、指标或失败情况的追问。
9. 建议回答必须基于定制简历或职业档案中的真实事实；没有事实时提供可替换的表达框架，不得编造项目、公司或数字。不输出难度、分数、公司福利、Markdown 或方法论名称。不要生成歧视性问题。`;

    const raw = await deepseekJson(request, prompt, { job: body.job, profile: body.profile, ...(resume ? { resume } : {}) }, isAdditional ? Math.min(9000, 1000 + additionalCount * 950) : 20000);
    const incoming = Array.isArray(raw.questions) ? raw.questions : [];
    const questions = incoming.slice(0, isAdditional ? additionalCount : 14).map((item, index) => {
      const value = item as Record<string, unknown>;
      const rawCategory = text(value.category);
      const category: Category = categories.includes(rawCategory as Category) ? rawCategory as Category : "岗位专业";
      const frameworks = Array.isArray(value.answerFramework) ? value.answerFramework.slice(0, 3).map((step) => {
        const record = step as Record<string, unknown>;
        return { title: text(record.title, "回答要点").slice(0, 30), guidance: text(record.guidance, "结合真实经历作答").slice(0, 160) };
      }) : [];
      const evidence = Array.isArray(value.evidenceSuggestions) ? value.evidenceSuggestions.slice(0, 3).map((entry) => {
        const record = entry as Record<string, unknown>;
        return { title: text(record.title).slice(0, 50), detail: text(record.detail).slice(0, 180) };
      }).filter((entry) => entry.title) : [];
      return {
        id: `q-${index + 1}`,
        category,
        question: text(value.question).slice(0, 220),
        source: text(value.source, "岗位 JD + 职业档案").slice(0, 80),
        intent: text(value.intent, "判断候选人与岗位的真实匹配情况").slice(0, 160),
        answerFramework: frameworks.length === 3 ? frameworks : [
          { title: "明确结论", guidance: "先直接回答问题，避免铺垫过长" },
          { title: "真实证据", guidance: "用一段本人参与的真实经历说明" },
          { title: "岗位关联", guidance: "说明这段经验如何用于目标岗位" },
        ],
        suggestedAnswer: text(value.suggestedAnswer).slice(0, 900),
        evidenceSuggestions: evidence,
        followUps: list(value.followUps, 3).map((entry) => entry.slice(0, 160)),
      };
    }).filter((item) => item.question);

    if (questions.length < (isAdditional ? Math.min(requestedQuestions.length ? 1 : 2, additionalCount) : 6)) throw new Error("AI 返回的问题数量不足，请重新生成");
    // 只把真实事实(岗位文本字段 + 职业档案)作为数字允许集合,排除 uuid 等标识符噪声。
    return json({
      job: { id: text(body.job.id), title: text(body.job.title), company: text(body.job.company) },
      questions,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const response = errorResponse(error);
    const payload = await response.json();
    return json(payload, { status: response.status });
  }
}
