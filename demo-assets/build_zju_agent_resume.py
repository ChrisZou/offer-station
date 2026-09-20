from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "output/pdf/浙江大学毕业_两年经验_Agent工程师_秋招演示简历.pdf"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

pdfmetrics.registerFont(TTFont("CN", FONT_REGULAR, subfontIndex=0))
pdfmetrics.registerFont(TTFont("CN-Bold", FONT_BOLD, subfontIndex=0))

BLACK = colors.HexColor("#111111")
GRAY = colors.HexColor("#555555")
ZJU_BLUE = colors.HexColor("#1B4F8A")


def style(name, **kwargs):
    base = {"fontName": "CN", "textColor": BLACK}
    base.update(kwargs)
    return ParagraphStyle(name, **base)


name_s = style("name", fontName="CN-Bold", fontSize=20, leading=23, alignment=TA_CENTER)
header_s = style("header", fontSize=9.5, leading=13.2, alignment=TA_CENTER)
school_s = style("school", fontName="CN-Bold", fontSize=11.5, leading=13, textColor=ZJU_BLUE, alignment=TA_CENTER)
school_en_s = style("school_en", fontSize=5.7, leading=7, textColor=ZJU_BLUE, alignment=TA_CENTER)
section_s = style("section", fontName="CN-Bold", fontSize=13.5, leading=15.5)
body_s = style("body", fontSize=9.2, leading=13.4)
bullet_s = style(
    "bullet",
    fontSize=9.2,
    leading=13.4,
    leftIndent=9,
    firstLineIndent=0,
    bulletIndent=0,
    bulletFontName="CN",
    bulletFontSize=9.2,
)
item_s = style("item", fontName="CN-Bold", fontSize=9.4, leading=13)
date_s = style("date", fontSize=8.8, leading=12.5, alignment=TA_RIGHT, textColor=GRAY)
footer_s = style("footer", fontSize=6.2, leading=8, alignment=TA_CENTER, textColor=colors.HexColor("#929292"))


def section(title):
    return [
        Spacer(1, 3.0 * mm),
        Paragraph(title, section_s),
        HRFlowable(width="100%", thickness=0.55, color=colors.HexColor("#555555"), spaceBefore=0.7 * mm, spaceAfter=1.5 * mm),
    ]


def bullet(text):
    return Paragraph(text, bullet_s, bulletText="•")


def dated_item(left, right):
    table = Table(
        [[Paragraph(left, item_s), Paragraph(right, date_s)]],
        colWidths=[143 * mm, 33 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.7 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def build():
    doc = BaseDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=13 * mm,
        bottomMargin=9 * mm,
        title="浙江大学毕业两年经验Agent工程师秋招演示简历",
        author="Codex Demo",
        subject="秋招求职工作台视频演示素材",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates(PageTemplate(id="resume", frames=[frame]))

    story = []
    center = Table(
        [
            [Paragraph("陈嘉航", name_s)],
            [Paragraph("138-0000-4137 | chenjiahang.demo@example.com", header_s)],
            [Paragraph("浙江大学计算机本科 | 2 年工作经验 | 杭州", header_s)],
            [Paragraph("求职意向：Agent 开发工程师 / 大模型应用工程师", header_s)],
        ],
        colWidths=[176 * mm],
    )
    center.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    header = Table([[center]], colWidths=[176 * mm])
    header.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 3.5 * mm))

    story.extend(section("教育经历"))
    story.append(dated_item("浙江大学 | 计算机科学与技术 | 工学学士", "2020.09 - 2024.06"))
    story.append(bullet("主修课程：数据结构与算法、操作系统、计算机网络、数据库系统、人工智能、机器学习、软件工程。"))
    story.append(bullet("英语水平：CET-6 535 分，能够阅读大模型、Agent 框架和云服务英文技术文档。"))

    story.extend(section("个人总结"))
    story.extend(
        [
            bullet("浙江大学计算机本科毕业，2 年企业级 AI 应用开发经验，目标岗位为 Agent 开发工程师 / 大模型应用工程师。"),
            bullet("熟悉 Python、FastAPI、LangGraph、RAG、MCP 与工具调用，能够完成需求拆解、流程编排、服务部署和效果迭代。"),
            bullet("具备知识库问答、流程自动化 Agent 和回归评测实践，重视结构化输出、权限校验、人工确认及操作审计。"),
            bullet("习惯编写设计文档与自动化测试，能够通过日志、链路追踪和评测指标定位问题并推动版本稳定交付。"),
        ]
    )

    story.extend(section("工作经历"))
    story.append(dated_item("杭州实在智能科技有限公司 | AI 应用工程师", "2024.07 - 至今"))
    story.extend(
        [
            bullet("参与企业流程自动化 Agent 平台研发，使用 Python、FastAPI 与 LangGraph 编排任务规划、工具调用、结果校验和人工确认节点，支持财务、客服与运营场景。"),
            bullet("负责企业知识库问答模块，完成文档解析、分段、混合检索和重排链路；结合引用校验与拒答策略，将内部测试集答案可采纳率由 71% 提升至 84%。"),
            bullet("接入 12 个内部 API 与 RPA 工具，设计统一工具 Schema、权限校验、超时重试和操作审计，月均执行约 4 万次自动化任务。"),
            bullet("搭建包含 600 余条样本的回归评测集，跟踪任务完成率、引用正确率、工具调用成功率和 P95 时延，人工验收时间减少约 40%。"),
        ]
    )

    story.extend(section("项目经历"))
    story.append(dated_item("售后工单处理 Agent | 核心开发", "2025.10 - 2026.03"))
    story.extend(
        [
            bullet("根据用户描述完成意图识别、订单查询、知识检索和解决方案生成；对退款、改址等高风险操作增加规则校验与人工审批。"),
            bullet("通过状态机约束、结构化输出和失败回退降低流程中断，灰度期任务一次完成率达到 78%，客服平均处理时长下降 26%。"),
        ]
    )
    story.append(Spacer(1, 0.8 * mm))
    story.append(dated_item("个人求职研究助手 | 独立项目", "2026.04 - 2026.06"))
    story.extend(
        [
            bullet("基于 LangGraph + MCP 构建岗位搜索、JD 解析、简历要点匹配和投递记录更新工作流，支持中断恢复与人工确认。"),
            bullet("使用 PostgreSQL + pgvector 保存岗位与简历片段，结合混合检索和交叉编码器重排，生成可追溯的岗位匹配说明。"),
        ]
    )

    story.extend(section("专业技能"))
    story.extend(
        [
            bullet("编程与后端：Python、SQL、FastAPI、AsyncIO、PostgreSQL、Redis；熟悉 REST API 设计与异步任务处理。"),
            bullet("Agent 与大模型：LangGraph、LlamaIndex、RAG、Tool Calling、MCP、Structured Output、Prompt Engineering。"),
            bullet("工程化与质量：Docker、Kubernetes、Git、pytest、日志与链路追踪、LLM Evaluation、Guardrails。"),
        ]
    )
    story.append(Spacer(1, 1.6 * mm))
    story.append(Paragraph("视频演示样例：候选人、联系方式、任职经历与项目数据均为虚构；学校及公司名称为真实名称。", footer_s))

    doc.build(story)


if __name__ == "__main__":
    build()
