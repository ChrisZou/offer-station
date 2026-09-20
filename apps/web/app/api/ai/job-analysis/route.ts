import { deepseekJson, errorResponse } from "../_deepseek";
import { assertInputSize } from "../_guardrails";

const list = (value: unknown) => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
type HardRiskType = "certificate" | "age" | "experience" | "degree" | "major" | "student_status" | "language" | "availability" | "other";
const degreeCondition = /(学历|本科|硕士|博士|大专|专科|研究生)(?!不限)/;
const majorCondition = /((?:计算机|软件工程|统计学|数学|应用数学|运筹学|自动化|金融|会计|法学|医学|护理|市场营销|新闻传播|设计|人力资源)[^，。；\n]{0,18}(?:相关)?专业|专业(?:要求|背景|方向)|相关专业)/i;
const studentStatusCondition = /(在校(?:生|大学生)?|应届(?:生|毕业生)?|\d{2,4}\s*届|毕业(?:时间|年限)|毕业\s*\d+\s*年内)/;
const certificateCondition = /(CPA|CFA|PMP|FRM|ACCA|注册会计师|法律职业资格|司法考试|教师资格(?:证)?|医师资格(?:证)?|护士执业(?:证)?|资格证|证书|执照)/i;
const ageCondition = /(年龄|\d{2}\s*岁)/;
const experienceCondition = /(工作经验|从业经验|行业经验|\d+\s*(?:-|–|—|至)\s*\d+\s*年|\d+\s*年以上|至少\s*\d+\s*年)/;
const languageCondition = /(英语|日语|韩语|法语|德语|雅思|托福|IELTS|TOEFL|CET[-\s]?[46]|英语[四六]级|专八|TEM[-\s]?8)/i;
const availabilityCondition = /(每周(?:至少)?\s*\d+\s*天|实习\s*\d+\s*个月|连续实习|到岗时间|立即到岗|出差|夜班|轮班|驻场)/;
const otherCondition = /(驾照|驾驶证|工作许可|签证|无犯罪记录|保密资格|政治面貌|党员|户籍|国籍)/;
const hardRiskCondition = new RegExp(`${degreeCondition.source}|${majorCondition.source}|${studentStatusCondition.source}|${certificateCondition.source}|${ageCondition.source}|${experienceCondition.source}|${languageCondition.source}|${availabilityCondition.source}|${otherCondition.source}`, "i");
const negativeEvidence = /(未提及|未体现|未明确|未找到|没有|无直接|无相关|缺少|缺乏|不具备|不符合|不匹配|尚未|无法确认|信息不足|待补充|待确认|不能证明|不足以证明)/;
const satisfiedEvidence = /(已满足|明确具备|持有有效|已经通过|已通过|符合要求|专业相符|学历满足)/;
const capabilityList = (value: unknown) => list(value).filter((item) => !hardRiskCondition.test(item));

const skillKey = (value: string) => value
  .toLowerCase()
  .replace(/python编程/g, "python")
  .replace(/(?:相关)?(?:能力|技能|知识|基础|经验|水平|应用)$/g, "")
  .replace(/[\s·、，,。；;：:（）()\-_/]/g, "");

function inferHardRiskType(value: string): HardRiskType | null {
  if (certificateCondition.test(value)) return "certificate";
  if (ageCondition.test(value)) return "age";
  if (studentStatusCondition.test(value)) return "student_status";
  if (experienceCondition.test(value)) return "experience";
  if (degreeCondition.test(value)) return "degree";
  if (majorCondition.test(value)) return "major";
  if (languageCondition.test(value)) return "language";
  if (availabilityCondition.test(value)) return "availability";
  if (otherCondition.test(value)) return "other";
  return null;
}

function jobHasExplicitHardRequirement(type: HardRiskType, jobText: string) {
  if (type === "certificate") return certificateCondition.test(jobText);
  if (type === "age") return ageCondition.test(jobText);
  if (type === "experience") return experienceCondition.test(jobText) && !/(经验不限|不限经验|工作经验不限)/.test(jobText);
  if (type === "degree") return degreeCondition.test(jobText) && !/(学历不限|不限学历)/.test(jobText);
  if (type === "major") return majorCondition.test(jobText) && !/(专业不限|不限专业)/.test(jobText);
  if (type === "student_status") return studentStatusCondition.test(jobText);
  if (type === "language") return languageCondition.test(jobText);
  if (type === "availability") return availabilityCondition.test(jobText);
  if (type === "other") return otherCondition.test(jobText);
  return false;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key",
  "Cache-Control": "no-store",
};
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...cors, ...init.headers } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { job?: unknown; profile?: unknown; mode?: unknown };
    if (!body.job || typeof body.job !== "object") return json({ error: "缺少岗位信息" }, { status: 400 });
    assertInputSize({ job: body.job, profile: body.profile }, 100_000, "岗位分析内容");
    const compact = body.mode === "compact";
    const compactPrompt = `你是求职岗位分析助手。用最少输出让候选人一眼看懂：岗位实际做什么、自己已经具备什么、不具备或尚未证实什么，以及是否存在会影响简历筛选的门槛或重要偏好。
只输出严格 JSON：
{"summary":"一句话说明岗位核心工作，不超过80字","hardRisks":[{"type":"certificate|age|experience|degree|major|student_status|language|availability|other","severity":"hard|preference","status":"unmet|uncertain","label":"门槛或重要偏好","requirement":"JD 原文的具体条件","reason":"档案为什么不满足或无法确认"}],"matched":[{"skill":"岗位要求的具体能力","requirement":"JD 对该能力的具体要求或使用场景","evidence":"档案中的直接证据"}],"gaps":[{"skill":"岗位要求的具体能力","requirement":"JD 对该能力的具体要求或使用场景","reason":"档案缺少什么","status":"missing|uncertain","importance":"高|中|低"}]}
matched 和 gaps 各不超过6项，每项必须对应岗位的一项实际能力，技能名称短句化、去重。没有档案证据不得放入 matched；明确缺少填 missing，档案信息不足无法判断填 uncertain。
逐条核对：学历层级、专业、在校/应届身份、证书/执照、年龄、工作或行业年限、语言成绩、实习到岗时间/每周天数/出差轮班，以及驾照、工作许可等明确条件。JD 用“必须、要求、限、需、本科及以上、相关专业”等明确措辞时 severity=hard；用“优先、加分”时 severity=preference。档案明确冲突时 status=unmet，档案缺少判断信息时 status=uncertain。已确认满足的条件不要输出。专业不一致必须识别，不能降级为普通技能缺口。不要输出分数、推荐结论、职责列表、薪资地点、福利、解释或 Markdown。`;
    const fullPrompt = `你是求职岗位分析助手。目标不是给候选人打分，而是让人一眼看懂：岗位实际做什么、需要哪些能力、候选人已经具备哪些、还缺少或尚未证实哪些。
请根据岗位正文提取具体、去重、短句化的信息，并根据职业档案逐项关联证据。没有档案证据时必须标为待补足或待确认，不能把通用能力当作已具备。
输出严格 JSON：
{"summary":"一句话说明岗位的核心目标，不超过100字","responsibilities":["主要工作或交付结果"],"requirements":["岗位真正需要的工具、技术、业务知识、作品或协作能力"],"hardRisks":[{"type":"certificate|age|experience|degree|major|student_status|language|availability|other","severity":"hard|preference","status":"unmet|uncertain","label":"例如：专业要求不符","requirement":"JD 的具体原文条件","reason":"职业档案中的缺失、冲突或待确认点"}],"matched":[{"skill":"已具备的能力","requirement":"JD 对该能力的具体要求或使用场景","evidence":"职业档案中的具体证据"}],"gaps":[{"skill":"缺少或尚未证实的能力","requirement":"JD 对该能力的具体要求或使用场景","reason":"档案中缺少什么证据","status":"missing|uncertain","importance":"高|中|低"}],"caveats":["岗位信息中需要进一步向招聘方确认的事项"]}
先建立“筛选条件清单”，逐项核对学历层级、专业、在校/应届身份、证书/执照、年龄、工作/行业年限、语言成绩、实习到岗与出勤、出差/轮班，以及驾照、工作许可等明确条件。岗位明确提出且候选人不满足或档案无法确认时必须进入 hardRisks：明确必需 severity=hard，“优先/加分” severity=preference；档案明确不符 status=unmet，没有足够信息 status=uncertain。已经确认满足或岗位没有提及的条件不输出。尤其不能遗漏“相关专业”与候选人教育专业不一致。
不要输出匹配分数、推荐结论、薪资地点或公司福利。门槛项不得再放入 requirements、matched 或 gaps。不要在 summary 和 responsibilities 中重复同一句话。requirements 只保留影响实际工作的能力要求。`;
    const raw = await deepseekJson(request, compact ? compactPrompt : fullPrompt, { job: body.job, profile: body.profile }, compact ? 1200 : 3000);

    const jobRecord = body.job as Record<string, unknown>;
    const jobText = [jobRecord.title, jobRecord.educationText, jobRecord.experienceText, jobRecord.jobDescription, ...(Array.isArray(jobRecord.skillTags) ? jobRecord.skillTags : [])].map(String).join("\n");
    const rawMatched = (Array.isArray(raw.matched) ? raw.matched : []).slice(0, 10).map((item) => {
      const value = item as Record<string, unknown>;
      return {
        skill: String(value.skill || "").slice(0, 60),
        requirement: String(value.requirement || `岗位要求具备${String(value.skill || "该项能力")}`).slice(0, 180),
        evidence: String(value.evidence || "待补充证据").slice(0, 180),
      };
    }).filter((item) => item.skill && !hardRiskCondition.test(item.skill));
    const rawGaps = (Array.isArray(raw.gaps) ? raw.gaps : []).slice(0, 12).map((item) => {
      const value = item as Record<string, unknown>;
      return {
        skill: String(value.skill || "").slice(0, 60),
        requirement: String(value.requirement || `岗位要求具备${String(value.skill || "该项能力")}`).slice(0, 180),
        reason: String(value.reason || "需要进一步确认").slice(0, 180),
        status: ["missing", "uncertain"].includes(String(value.status)) ? String(value.status) : /尚未|未体现|无法确认|信息不足|待确认/.test(String(value.reason || "")) ? "uncertain" : "missing",
        importance: ["高", "中", "低"].includes(String(value.importance)) ? String(value.importance) : "中",
      };
    }).filter((item) => item.skill);
    const rejectedMatched = rawMatched.filter((item) => negativeEvidence.test(item.evidence)).map((item) => ({
      skill: item.skill,
      requirement: item.requirement,
      reason: item.evidence,
      status: /未提及|未体现|未明确|未找到|无直接|无法确认|信息不足|待确认/.test(item.evidence) ? "uncertain" : "missing",
      importance: "高",
    }));
    const positiveMatched = rawMatched.filter((item) => !negativeEvidence.test(item.evidence));
    const modelHardRisks = (Array.isArray(raw.hardRisks) ? raw.hardRisks : []).slice(0, 6).map((item) => {
      const value = item as Record<string, unknown>;
      const combined = `${String(value.label || "")} ${String(value.reason || "")}`;
      const declaredType = ["certificate", "age", "experience", "degree", "major", "student_status", "language", "availability", "other"].includes(String(value.type)) ? String(value.type) as HardRiskType : null;
      const type = declaredType && inferHardRiskType(combined) === declaredType ? declaredType : inferHardRiskType(combined);
      return {
        type,
        severity: ["hard", "preference"].includes(String(value.severity)) ? String(value.severity) as "hard" | "preference" : "hard" as const,
        status: ["unmet", "uncertain"].includes(String(value.status)) ? String(value.status) as "unmet" | "uncertain" : negativeEvidence.test(String(value.reason || "")) ? "unmet" as const : "uncertain" as const,
        label: String(value.label || "存在硬性门槛待确认").slice(0, 80),
        requirement: String(value.requirement || value.label || "岗位存在明确筛选条件").slice(0, 180),
        reason: String(value.reason || "职业档案中缺少可验证信息").slice(0, 180),
      };
    }).filter((item): item is { type: HardRiskType; severity: "hard" | "preference"; status: "unmet" | "uncertain"; label: string; requirement: string; reason: string } => Boolean(
      item.type
      && item.label
      && jobHasExplicitHardRequirement(item.type, jobText)
      && (negativeEvidence.test(item.reason) || !satisfiedEvidence.test(item.reason)),
    ));
    const allGapCandidates = [...rawGaps, ...rejectedMatched];
    const misplacedHardRisks = allGapCandidates.filter((item) => {
      const type = inferHardRiskType(`${item.skill} ${item.requirement} ${item.reason}`);
      return type && jobHasExplicitHardRequirement(type, jobText);
    }).map((item) => ({
      type: inferHardRiskType(`${item.skill} ${item.requirement} ${item.reason}`) as HardRiskType,
      severity: "hard" as const,
      status: item.status === "missing" ? "unmet" as const : "uncertain" as const,
      label: item.skill,
      requirement: item.requirement,
      reason: item.reason,
    }));
    const hardRisks = [...modelHardRisks, ...misplacedHardRisks]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.type === item.type && skillKey(candidate.label) === skillKey(item.label)) === index)
      .slice(0, 6);
    const hardRiskKeys = new Set(hardRisks.map((item) => skillKey(item.label)));
    const gapCandidates = allGapCandidates.filter((item) => {
      const hardType = inferHardRiskType(`${item.skill} ${item.requirement} ${item.reason}`);
      return !(hardType && jobHasExplicitHardRequirement(hardType, jobText));
    });
    const gapKeys = new Set(gapCandidates.map((item) => skillKey(item.skill)));
    const matched = positiveMatched
      .filter((item, index, items) => items.findIndex((candidate) => skillKey(candidate.skill) === skillKey(item.skill)) === index)
      .filter((item) => !gapKeys.has(skillKey(item.skill)) && !hardRiskKeys.has(skillKey(item.skill)))
      .slice(0, 10);
    const matchedKeys = new Set(matched.map((item) => skillKey(item.skill)));
    const gaps = gapCandidates
      .filter((item) => !matchedKeys.has(skillKey(item.skill)) && !hardRiskKeys.has(skillKey(item.skill)))
      .filter((item, index, items) => items.findIndex((candidate) => skillKey(candidate.skill) === skillKey(item.skill)) === index)
      .slice(0, 10);

    const result = {
      summary: String(raw.summary || "AI 暂未生成岗位总结").slice(0, 500),
      responsibilities: capabilityList(raw.responsibilities).slice(0, 8),
      requirements: capabilityList(raw.requirements).slice(0, 10),
      hardRisks,
      matched,
      gaps,
      caveats: capabilityList(raw.caveats).slice(0, 6),
    };
    if (compact) return json({
      summary: result.summary,
      hardRisks: result.hardRisks.slice(0, 6),
      matched: result.matched.slice(0, 6),
      gaps: result.gaps.slice(0, 6),
    });
    return json(result);
  } catch (error) {
    const response = errorResponse(error);
    const body = await response.json();
    return json(body, { status: response.status });
  }
}
