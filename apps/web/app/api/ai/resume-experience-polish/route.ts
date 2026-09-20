import { deepseekJson, errorResponse } from "../_deepseek";
import { assertInputSize } from "../_guardrails";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DeepSeek-API-Key",
  "Cache-Control": "no-store",
};

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...cors, ...init.headers } });
const text = (value: unknown, limit: number) => String(value || "").trim().slice(0, limit);
const list = (value: unknown, limit: number) => Array.isArray(value)
  ? value.map((item) => text(item, 240)).filter(Boolean).slice(0, limit)
  : [];

export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      candidate?: unknown;
      sourceArchive?: unknown;
      currentResume?: unknown;
      job?: unknown;
    };
    assertInputSize(body, 80_000, "待添加经历");

    const candidate = body.candidate && typeof body.candidate === "object"
      ? body.candidate as Record<string, unknown>
      : {};
    const title = text(candidate.title, 100);
    const sourceBullets = list(candidate.bullets, 8);
    if (!title) return json({ error: "请先填写经历名称" }, { status: 400 });
    if (!sourceBullets.length && !body.sourceArchive) {
      return json({ error: "请至少写一条真实职责、方法或结果，AI 才能在不虚构的前提下优化" }, { status: 400 });
    }

    const prompt = `你是严谨的中文简历经历编辑器。你的唯一任务是把一段待添加经历整理成当前简历可直接使用的结构，不得改写整份简历。只输出严格 JSON：
{"experience":{"type":"工作经历|实习经历|项目经历|教育经历|成果证明","title":"名称","subtitle":"角色或单位","date":"时间","bullets":["要点"]},"message":"一句话说明"}

规则：
1. 事实边界只来自 candidate 与 sourceArchive。currentResume 和 job 只用于判断字段顺序、表达风格、去重和岗位相关性，绝不能成为新事实来源。
2. 不得创造或推断公司、学校、职位、项目、技能、数字、证书、时间、职责或成果；原素材没有量化数据时，不要补数字。
3. 保留名称、角色/单位和时间的事实含义；参考 currentResume 的既有习惯决定 title 与 subtitle 的放置，避免公司与岗位错位。
4. 统一日期分隔与空格，但不得补全未知月份或时间。信息不完整时保留原值，不写“待补充”。
5. 对要点去重并按岗位相关性排序，优先使用“动作 + 场景/方法 + 已有结果”的中文简历表达。通常输出 2—4 条；素材不足时可以少于 2 条，不能靠编造凑数。
6. 每条简洁、具体、可追溯，不写第一人称，不写空泛评价，不增加素材中没有的技术关键词。
7. 输出必须能直接写入结构化简历，不要 Markdown、代码围栏或额外解释。`;

    const raw = await deepseekJson(request, prompt, {
      candidate: body.candidate,
      sourceArchive: body.sourceArchive,
      currentResume: body.currentResume,
      job: body.job,
    }, 1800);
    const value = raw.experience && typeof raw.experience === "object"
      ? raw.experience as Record<string, unknown>
      : {};
    const bullets = list(value.bullets, 5);
    const experience = {
      type: text(value.type || candidate.type || "项目经历", 30),
      title: text(value.title || candidate.title, 100),
      subtitle: text(value.subtitle || candidate.subtitle, 140),
      date: text(value.date || candidate.date, 40),
      bullets,
    };
    if (!experience.title || !experience.bullets.length) {
      throw new Error("AI 未返回可写入简历的经历内容，请补充更多真实素材后重试");
    }
    return json({ experience, message: text(raw.message || "已按当前简历格式优化并添加", 180) });
  } catch (error) {
    const response = errorResponse(error);
    return json(await response.json(), { status: response.status });
  }
}
