from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "2027秋招_AI产品经理_演示简历.pdf"

FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

PAGE_W, PAGE_H = A4
LEFT = 42
RIGHT = PAGE_W - 42
CONTENT_W = RIGHT - LEFT

INK = HexColor("#111111")
MUTED = HexColor("#777777")
RULE = HexColor("#D7D7D7")
TAB = HexColor("#DEDEDE")


def register_fonts():
    pdfmetrics.registerFont(TTFont("CN", FONT_REGULAR, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("CN-Bold", FONT_BOLD, subfontIndex=0))


def text_width(text, font="CN", size=8.2):
    return pdfmetrics.stringWidth(text, font, size)


def wrap_text(text, max_width, font="CN", size=8.2):
    lines = []
    current = ""
    for char in text:
        candidate = current + char
        if current and text_width(candidate, font, size) > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_section(c, y, title):
    tab_w = 103
    tab_h = 18
    c.setFillColor(RULE)
    c.rect(LEFT, y - 1, CONTENT_W, 2, fill=1, stroke=0)
    c.setFillColor(TAB)
    c.setStrokeColor(TAB)
    c.setLineWidth(0)
    c.saveState()
    path = c.beginPath()
    path.moveTo(LEFT, y + 1)
    path.lineTo(LEFT + tab_w, y + 1)
    path.lineTo(LEFT + tab_w - 10, y - tab_h)
    path.lineTo(LEFT, y - tab_h)
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    c.restoreState()
    c.setFillColor(INK)
    c.setFont("CN-Bold", 10.2)
    c.drawString(LEFT + 16, y - 12.5, title)
    return y - tab_h - 7


def draw_role_title(c, y, org, role, dates):
    c.setFillColor(INK)
    c.setFont("CN-Bold", 9.2)
    c.drawString(LEFT, y, org)
    org_w = text_width(org, "CN-Bold", 9.2)
    c.setFont("CN-Bold", 8.8)
    c.drawString(LEFT + org_w + 16, y, role)
    c.setFont("CN", 8.1)
    c.drawRightString(RIGHT, y, dates)
    return y - 14.2


def draw_bullet(c, y, prefix, body, size=8.35, leading=12.25):
    bullet_x = LEFT + 4
    text_x = LEFT + 18
    max_width = RIGHT - text_x

    c.setFillColor(INK)
    c.circle(bullet_x + 1.4, y + 2.0, 1.4, fill=1, stroke=0)
    c.setFont("CN-Bold", size)
    c.drawString(text_x, y, prefix)
    prefix_w = text_width(prefix, "CN-Bold", size)

    first_width = max_width - prefix_w
    first_lines = wrap_text(body, first_width, "CN", size)
    first = first_lines[0] if first_lines else ""
    c.setFont("CN", size)
    c.drawString(text_x + prefix_w, y, first)

    remainder = body[len(first):]
    y -= leading
    for line in wrap_text(remainder, max_width, "CN", size):
        c.drawString(text_x, y, line)
        y -= leading
    return y + 1.2


def draw_plain_bullet(c, y, body, size=8.35, leading=12.25):
    bullet_x = LEFT + 4
    text_x = LEFT + 18
    c.setFillColor(INK)
    c.circle(bullet_x + 1.4, y + 2.0, 1.4, fill=1, stroke=0)
    c.setFont("CN", size)
    for line in wrap_text(body, RIGHT - text_x, "CN", size):
        c.drawString(text_x, y, line)
        y -= leading
    return y + 1.2


def build():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    c.setTitle("2027秋招 AI产品经理演示简历")
    c.setAuthor("演示候选人（虚构信息）")

    # Header: mirrors the public reference's two-zone information hierarchy,
    # with the portrait and school mark intentionally removed.
    c.setFillColor(INK)
    c.setFont("CN-Bold", 24)
    c.drawString(LEFT, PAGE_H - 55, "陈嘉航")
    c.setFont("CN-Bold", 9.6)
    c.drawString(LEFT, PAGE_H - 76, "AI 产品经理｜Agent 产品经理")
    c.setFont("CN", 8.2)
    c.drawString(LEFT, PAGE_H - 92, "2 年工作经验｜杭州｜2027 届秋招")

    contact_x = 305
    contact_y = PAGE_H - 50
    contact_rows = [
        ("经验", "2 年", "手机", "138-0000-5721"),
        ("邮箱", "cjh.pm@example.com", "微信", "CJH_PM_DEMO"),
        ("意向", "AI 产品经理 / Agent 产品经理", "到岗", "1 个月内"),
    ]
    for label1, value1, label2, value2 in contact_rows:
        c.setFillColor(RULE)
        c.circle(contact_x, contact_y + 2, 7, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("CN-Bold", 7.4)
        c.drawString(contact_x + 12, contact_y, f"{label1}：")
        c.setFont("CN", 7.4)
        c.drawString(contact_x + 36, contact_y, value1)
        c.setFont("CN-Bold", 7.4)
        c.drawString(458, contact_y, f"{label2}：")
        c.setFont("CN", 7.4)
        c.drawString(485, contact_y, value2)
        contact_y -= 18

    c.setFillColor(RULE)
    c.rect(LEFT, PAGE_H - 113, CONTENT_W, 2, fill=1, stroke=0)
    y = PAGE_H - 119

    y = draw_section(c, y, "教育背景")
    y = draw_role_title(c, y, "浙江大学", "本科  计算机科学与技术学院  计算机科学与技术", "2020.09-2024.06")
    y = draw_bullet(c, y, "成绩表现：", "GPA 3.62 / 4.00，专业前 25%；浙江大学优秀学生三等奖、校级优秀毕业设计。")
    y = draw_bullet(c, y, "相关课程：", "人工智能、软件工程、数据结构、数据库系统、用户研究与交互设计、产品创新与创业实践。")
    y -= 1

    y = draw_section(c, y, "项目经历")
    y = draw_role_title(c, y, "企业知识库问答 Agent", "产品负责人（内部创新项目）", "2026.02-2026.07")
    y = draw_bullet(c, y, "需求定义与 MVP：", "访谈 18 家中小企业的一线销售与客服，归纳“制度查询、方案检索、客户问答”三类高频任务；输出 PRD、任务流程和 MVP 边界，6 周完成首版上线。")
    y = draw_bullet(c, y, "Agent 方案设计：", "设计“意图识别-知识检索-工具调用-答案校验-人工接管”五段式工作流，补充来源引用、低置信度追问与权限隔离，降低幻觉对业务决策的影响。")
    y = draw_bullet(c, y, "评测与迭代：", "与算法团队搭建 480 条场景评测集，定义准确率、引用完整率、任务完成率和平均响应时长；通过召回策略与 Prompt 迭代，将有效回答率从 61% 提升至 78%。")
    y = draw_bullet(c, y, "业务结果：", "灰度覆盖 6 个团队、120 余名用户，周活跃率 64%，单次资料检索平均耗时由 9 分钟降至 3 分钟，人工咨询量下降 31%。")
    y -= 1

    y = draw_role_title(c, y, "智能招聘工作台", "AI 产品经理", "2025.08-2026.01")
    y = draw_bullet(c, y, "用户研究：", "围绕招聘专员“读简历慢、信息分散、面试准备重复”问题完成 15 次深访和 2 轮可用性测试，明确简历解析、岗位匹配、面试题生成三项核心能力。")
    y = draw_bullet(c, y, "产品设计：", "负责信息架构、端到端流程、Figma 高保真原型及异常兜底；将模型生成结果拆解为证据卡片，支持回溯原文、人工修改与一键采纳。")
    y = draw_bullet(c, y, "数据验证：", "设计任务完成率、报告采纳率、编辑率和生成耗时等指标；A/B 测试后首日关键任务完成率提升 18%，单份候选人报告制作时间由 12 分钟缩短至 4 分钟。")
    y -= 1

    y = draw_role_title(c, y, "多 Agent 销售线索研究工具", "产品策划", "2025.03-2025.06")
    y = draw_bullet(c, y, "场景与方案：", "针对销售前期行业研究耗时、结论难追溯的问题，梳理公司检索、人物识别、动态追踪和机会判断四类任务，完成产品流程、低保真原型与功能优先级。")
    y = draw_bullet(c, y, "协作机制：", "设计 Planner、Researcher、Reviewer 三角色协作方式，在前台展示执行计划、信息来源和失败重试状态；加入人工确认节点，避免错误信息直接进入销售结论。")
    y = draw_bullet(c, y, "效果验证：", "基于 60 家目标企业进行任务测试，研究报告平均生成时间由 25 分钟缩短至 8 分钟，关键信息引用完整率达到 91%，内测用户采纳率 72%。")
    y -= 1

    y = draw_section(c, y, "工作经历")
    y = draw_role_title(c, y, "杭州灵犀云科技有限公司", "AI 产品经理", "2025.07-至今")
    y = draw_bullet(c, y, "产品规划与需求管理：", "负责企业级 AI 助手从需求池、优先级、Roadmap 到版本验收的完整流程；累计管理 80 余项需求，推动 7 个核心版本按期上线。")
    y = draw_bullet(c, y, "跨团队协作：", "协同算法、研发、设计、实施与销售共 20 余人，建立需求澄清、技术预研、评测验收和上线复盘机制；关键版本平均延期天数下降 40%。")
    y = draw_bullet(c, y, "客户反馈闭环：", "整合客服工单、埋点与客户访谈建立 Voice of Customer 看板，按场景拆解失败原因并推动专项优化，使核心流程月留存提升 9 个百分点。")
    y = draw_bullet(c, y, "模型效果治理：", "建立离线评测、线上 Bad Case 标注与周度复盘机制，沉淀 320 条核心场景用例；推动提示词、检索与兜底策略迭代，高风险错误率下降 24%。")
    y -= 1

    y = draw_role_title(c, y, "杭州星舟信息技术有限公司", "产品经理（AI 方向）", "2024.07-2025.06")
    y = draw_bullet(c, y, "0-1 产品落地：", "参与搭建面向销售团队的智能内容生成工具，负责竞品分析、用户故事、原型及验收标准；首版 8 周上线，覆盖 4 类营销内容与 3 个发布渠道。")
    y = draw_bullet(c, y, "增长与体验优化：", "基于漏斗数据定位模板选择和结果编辑环节流失，推动推荐默认值、示例引导和批量改写功能上线，核心功能周使用率提升 22%。")
    y = draw_bullet(c, y, "交付标准化：", "沉淀 PRD、模型效果评测表、灰度方案和上线检查清单，支持后续 5 个客户项目复用，平均交付周期缩短约 20%。")
    y = draw_bullet(c, y, "业务协同：", "支持销售演示、客户共创与上线培训，将一线反馈结构化沉淀至需求池；协助完成 3 个重点客户 PoC，其中 2 个进入正式交付阶段。")
    y -= 1

    y = draw_section(c, y, "个人技能")
    y = draw_bullet(c, y, "产品能力：", "用户研究、需求分析、竞品分析、产品规划、PRD、原型设计、埋点与数据分析、版本与项目管理。")
    y = draw_bullet(c, y, "AI 能力：", "理解 LLM、Prompt Engineering、RAG、Agent、模型评测与安全兜底；能与算法团队共同定义能力边界和验收标准。")
    y = draw_bullet(c, y, "工具能力：", "Figma、Axure、墨刀、XMind、Jira、飞书、SQL、Python、Excel；CET-6，具备英文技术资料阅读能力。")
    y = draw_bullet(c, y, "个人特点：", "善于把模糊业务问题拆成可验证的产品假设，重视数据证据与真实用户反馈，能在多角色协作中持续推动方案落地。")

    if y < 25:
        raise RuntimeError(f"Content overflow: final y={y:.1f}")

    c.setFillColor(MUTED)
    c.setFont("CN", 5.7)
    c.drawRightString(RIGHT, 15, "演示素材｜姓名、联系方式、公司与业绩数据均为虚构示例")
    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
