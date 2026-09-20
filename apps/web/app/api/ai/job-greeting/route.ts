import { deepseekJson, errorResponse } from "../_deepseek";
import { assertInputSize } from "../_guardrails";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { job?: unknown; profile?: unknown; analysis?: unknown; audience?: unknown };
    if (!body.job || typeof body.job !== "object") return Response.json({ error: "缺少岗位信息" }, { status: 400, headers: cors });
    assertInputSize(body, 80_000, "招呼语上下文");
    const allowedAudiences = ["招聘 HR", "业务负责人", "公司负责人"] as const;
    const audience = allowedAudiences.includes(body.audience as typeof allowedAudiences[number]) ? body.audience as typeof allowedAudiences[number] : "招聘 HR";
    const prompt = `你是中文求职沟通助手。为候选人生成一段可直接发送给招聘者的首次招呼语。
只输出严格 JSON：{"greeting":"招呼语","judgment":{"strategy":"本次首句策略","highlight":"实际采用的亮点；没有强亮点则如实写暂无强亮点","reason":"为什么这个信息对当前岗位和对象有用","confidence":"明确亮点|可用亮点|暂无强亮点"}}。

先判断，后写作：
1. 结合 job、profile 和 analysis，判断候选人是否真的存在值得放在首句的亮点。亮点是“有或没有”的证据判断，不存在项目匹配度 > 成果 > 学历/背书这类固定排序；根据当前岗位与沟通对象选择最有区分度的一项。
2. 只有职业档案中的具体事实、项目、成果、学历或背书才算证据。analysis 中的 matched 只能辅助定位，不能补造档案中不存在的事实。没有强亮点时保持坦诚，以岗位意向和一项可验证的相关能力切入，不得硬凑亮点。
3. 招聘 HR：优先帮助快速初筛，先呈现明确满足的门槛、稀缺经历或可验证成果；不要把档案未知项写成已满足。
4. 业务负责人：优先看实际技术/专业适配、解决问题的深度和成果证据。技术招聘中，项目业务领域不完全一致不等于不匹配；若底层技术与解决问题方式可迁移，应强调技术适配，而不是强行声称项目场景完全匹配。
5. 公司负责人：优先看对公司、产品或阶段性机会的真实理解，以及候选人能带来的核心价值；job 没有相关信息时不要臆测公司战略。

写作要求：70—130个中文字符；自然点明目标岗位，用选中的一项真实亮点说明契合点，最后礼貌询问是否方便进一步沟通；自然、具体、不卑不亢；不能虚构经历、数字、技能、学历、公司信息或岗位判断；不要罗列关键词；不要写姓名、电话、自我介绍标题或 Markdown；如果资料不足，保持克制。
根据 audience 调整整段内容，尤其是开头前 10 个字和第一句话，不能只修改后半段：
- 招聘 HR：让对方快速看到初筛信号。
- 业务负责人：让对方快速看到专业适配和成果证据。
- 公司负责人：让对方快速看到机会理解和核心价值。
不要在正文中机械写出“招聘 HR”“业务负责人”或“公司负责人”等角色标签。`;
    const raw = await deepseekJson(request, prompt, { job: body.job, profile: body.profile, analysis: body.analysis, audience }, 700);
    const greeting = String(raw.greeting || "").trim().slice(0, 260);
    if (!greeting) throw new Error("DeepSeek 未返回可用招呼语");
    const judgmentRecord = raw.judgment && typeof raw.judgment === "object" ? raw.judgment as Record<string, unknown> : {};
    const confidence = ["明确亮点", "可用亮点", "暂无强亮点"].includes(String(judgmentRecord.confidence)) ? String(judgmentRecord.confidence) : "可用亮点";
    const judgment = {
      strategy: String(judgmentRecord.strategy || `${audience}首句策略`).trim().slice(0, 100),
      highlight: String(judgmentRecord.highlight || "从职业档案中选择与岗位最相关的真实事实").trim().slice(0, 140),
      reason: String(judgmentRecord.reason || "结合岗位要求与职业档案后选择，不使用固定亮点排序").trim().slice(0, 180),
      confidence,
    };
    return Response.json({ greeting, judgment }, { headers: cors });
  } catch (error) {
    const response = errorResponse(error);
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: cors });
  }
}
