from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
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


OUTPUT = "output/pdf/中国AI算法工程师_演示简历.pdf"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

pdfmetrics.registerFont(TTFont("CN", FONT_REGULAR, subfontIndex=0))
pdfmetrics.registerFont(TTFont("CN-Bold", FONT_BOLD, subfontIndex=0))

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#16324F")
BLUE = colors.HexColor("#1E6F9F")
TEXT = colors.HexColor("#232A31")
MUTED = colors.HexColor("#65727E")
PALE = colors.HexColor("#EEF5F8")
LINE = colors.HexColor("#CFDCE4")


def pstyle(name, **kwargs):
    defaults = {"fontName": "CN", "textColor": TEXT}
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)


name_style = pstyle("Name", fontName="CN-Bold", fontSize=24, leading=28, textColor=NAVY)
role_style = pstyle("Role", fontName="CN-Bold", fontSize=10.5, leading=14, textColor=BLUE)
contact_style = pstyle("Contact", fontSize=8.3, leading=11, textColor=MUTED)
summary_style = pstyle("Summary", fontSize=8.7, leading=13, textColor=TEXT)
section_style = pstyle("Section", fontName="CN-Bold", fontSize=11.5, leading=15, textColor=NAVY)
job_style = pstyle("Job", fontName="CN-Bold", fontSize=9.4, leading=12, textColor=TEXT)
date_style = pstyle("Date", fontSize=8.2, leading=11, textColor=MUTED, alignment=TA_RIGHT)
body_style = pstyle("Body", fontSize=8.35, leading=12.5, leftIndent=7, firstLineIndent=-7, bulletIndent=0)
small_style = pstyle("Small", fontSize=7.9, leading=11.5, textColor=TEXT)
tag_style = pstyle("Tag", fontSize=7.7, leading=10, textColor=NAVY, alignment=TA_CENTER)
footer_style = pstyle("Footer", fontSize=6.5, leading=8, textColor=colors.HexColor("#8A969F"), alignment=TA_CENTER)


def section(title):
    return [
        Spacer(1, 3 * mm),
        Paragraph(title, section_style),
        HRFlowable(width="100%", thickness=0.8, color=BLUE, spaceBefore=1.2 * mm, spaceAfter=2.1 * mm),
    ]


def job_header(company, role, date):
    table = Table(
        [[Paragraph(f"{company}  ·  {role}", job_style), Paragraph(date, date_style)]],
        colWidths=[142 * mm, 34 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def bullet(text):
    return Paragraph(f"• {text}", body_style)


def build():
    doc = BaseDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=14 * mm,
        bottomMargin=11 * mm,
        title="中国AI算法工程师演示简历",
        author="Codex Demo",
        subject="视频演示用虚构候选人简历",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates(PageTemplate(id="resume", frames=[frame]))

    story = []
    header = Table(
        [
            [Paragraph("刘明远", name_style), Paragraph("高级算法工程师 / 大模型应用", role_style)],
            [
                Paragraph("杭州 · 138-0000-5826 · liu.mingyuan@example.com", contact_style),
                Paragraph("GitHub: github.com/demo-liu · 期望城市：杭州 / 北京", contact_style),
            ],
        ],
        colWidths=[82 * mm, 94 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 2 * mm))

    summary = Table(
        [[Paragraph("6 年互联网算法经验，聚焦推荐系统、多模态理解与生成式 AI。具备从数据治理、模型训练、离线评估到在线推理和监控的完整落地经验，能够推动算法指标转化为业务结果。", summary_style)]],
        colWidths=[176 * mm],
    )
    summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.6 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6 * mm),
            ]
        )
    )
    story.append(summary)

    story.extend(section("工作经历"))
    story.append(job_header("字节跳动 · 抖音电商", "高级算法工程师", "2023.08 - 至今"))
    story.extend(
        [
            bullet("负责商品理解与推荐排序，构建 CLIP + 中文 Transformer 多模态模型，将核心类目识别准确率由 88% 提升至 95.6%。"),
            bullet("设计向量召回、粗排与精排一体化链路，优化特征实时性与模型蒸馏策略，重点场景 CTR 提升 16.8%。"),
            bullet("推动大模型商品文案生成上线，引入 RAG、规则校验与人工评测闭环，使商家平均编辑时长下降 63%。"),
            bullet("带领 4 人项目组完成训练、评估、灰度和监控平台建设，模型迭代周期从 14 天缩短至 6 天。"),
        ]
    )
    story.append(Spacer(1, 1.8 * mm))
    story.append(job_header("快手 · 推荐算法中心", "算法工程师", "2020.07 - 2023.07"))
    story.extend(
        [
            bullet("参与短视频推荐与新用户冷启动，基于双塔召回和 Self-Attention 重排优化兴趣建模，新用户次日留存提升 10.9%。"),
            bullet("搭建完播、点赞、关注和评论的多目标学习框架，通过 MMOE 与动态权重调整，使整体互动率提升 8.4%。"),
            bullet("建设特征漂移和在线效果监控，覆盖 20+ 核心模型，将异常发现时间从小时级降低至 15 分钟内。"),
        ]
    )

    story.extend(section("代表项目"))
    story.append(job_header("多模态商品理解与检索平台", "项目负责人", "2024.03 - 2024.10"))
    story.extend(
        [
            bullet("面向亿级商品库设计图文联合表征、向量检索和类目预测服务；使用 PyTorch、Faiss、Milvus 与 TensorRT。"),
            bullet("建立覆盖准确率、召回率、时延与安全性的评测集，8 卡训练 38 小时收敛，在线 P95 时延控制在 65ms。"),
        ]
    )

    story.extend(section("教育背景"))
    edu = Table(
        [
            [Paragraph("浙江大学 · 计算机科学与技术 · 硕士", job_style), Paragraph("2017.09 - 2020.06", date_style)],
            [Paragraph("华中科技大学 · 软件工程 · 本科", job_style), Paragraph("2013.09 - 2017.06", date_style)],
        ],
        colWidths=[142 * mm, 34 * mm],
    )
    edu.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1.0 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.0 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(edu)

    story.extend(section("专业能力"))
    tags = [
        "Python / SQL / C++",
        "PyTorch / Transformers",
        "LLM / RAG / Agent",
        "推荐系统 / 多模态",
        "Faiss / Milvus",
        "Spark / Flink",
        "Docker / Kubernetes",
        "TensorRT / Triton",
    ]
    tag_table = Table(
        [[Paragraph(t, tag_style) for t in tags[:4]], [Paragraph(t, tag_style) for t in tags[4:]]],
        colWidths=[44 * mm] * 4,
    )
    tag_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.white),
                ("INNERGRID", (0, 0), (-1, -1), 1.4, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(tag_table)

    story.extend(section("技术成果与语言"))
    achievements = Table(
        [
            [Paragraph("发明专利", job_style), Paragraph("推荐与多模态方向 3 项（演示数据）", small_style), Paragraph("语言能力", job_style), Paragraph("中文母语 · 英语可作为工作语言", small_style)],
            [Paragraph("论文与分享", job_style), Paragraph("CCF-A 类会议论文 1 篇 · 内部技术分享 8 次", small_style), Paragraph("协作能力", job_style), Paragraph("项目规划 · 跨团队沟通 · 技术评审", small_style)],
        ],
        colWidths=[23 * mm, 65 * mm, 23 * mm, 65 * mm],
    )
    achievements.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("BACKGROUND", (0, 0), (0, -1), PALE),
                ("BACKGROUND", (2, 0), (2, -1), PALE),
                ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(achievements)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("演示样例 · 人物、联系方式及业绩数据均为虚构；字节跳动、抖音电商、快手等为真实公司或业务名称。", footer_style))

    doc.build(story)


if __name__ == "__main__":
    build()
