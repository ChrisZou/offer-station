"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import {
  IoArrowRedoOutline,
  IoArrowUndoOutline,
  IoCheckmarkCircleOutline,
  IoChatbubbleEllipsesOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoListOutline,
  IoPersonOutline,
  IoSaveOutline,
  IoSendOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import { callAi, GENERATED_RESUME_STORAGE, type GeneratedResume, type ResumeDesign } from "../lib/ai-client";
import { RESUME_METHODS, RESUME_TEMPLATE_REFERENCES, getResumeTemplatePreset, normalizeResumeSection, normalizeResumeTemplate, resolveResumeMethodology, resolveResumeStructure, sortResumeEntries } from "../lib/resume-methodology";

type ResumeTemplate = NonNullable<GeneratedResume["template"]>;

const templates = RESUME_TEMPLATE_REFERENCES as Array<(typeof RESUME_TEMPLATE_REFERENCES)[number] & { id: ResumeTemplate }>;

const fontOptions = [
  { id: "source-han-sans", name: "思源黑体 / Noto Sans CJK", category: "开源中文", css: '"Source Han Sans SC","Noto Sans CJK SC","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif' },
  { id: "source-han-serif", name: "思源宋体 / Noto Serif CJK", category: "开源中文", css: '"Source Han Serif SC","Noto Serif CJK SC","Noto Serif SC","Songti SC",STSong,serif' },
  { id: "deedy-source", name: "Source Serif + 思源宋体", category: "模板原版", css: '"Source Serif 4","Source Serif Pro","Source Han Serif SC","Noto Serif CJK SC",serif' },
  { id: "lato-source", name: "Lato + 思源黑体", category: "模板原版", css: 'Lato,"Source Sans 3","Source Sans Pro","Source Han Sans SC","Noto Sans CJK SC",sans-serif' },
  { id: "ibm-plex-sans", name: "IBM Plex Sans + 思源黑体", category: "专业无衬线", css: '"IBM Plex Sans","Source Han Sans SC","Noto Sans CJK SC","PingFang SC",sans-serif' },
  { id: "ibm-plex-serif", name: "IBM Plex Serif + 思源宋体", category: "专业衬线", css: '"IBM Plex Serif","Source Han Serif SC","Noto Serif CJK SC","Songti SC",serif' },
  { id: "pingfang", name: "苹方 / 系统黑体", category: "macOS 中文", css: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif' },
  { id: "st-serif", name: "华文宋体 + Times New Roman", category: "macOS 中文", css: '"Times New Roman","STSong","Songti SC","Source Han Serif SC",serif' },
  { id: "ctex-default", name: "CTeX 宋黑组合", category: "LaTeX 中文", css: '"Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",serif' },
  { id: "xiaobiaosong-mono", name: "小标宋 + JetBrains Mono", category: "技术双栏", css: '"FZXiaoBiaoSong-B05S","STSong","Source Han Serif SC","JetBrains Mono","Noto Serif CJK SC",serif' },
];

const defaultDesign: ResumeDesign = getResumeTemplatePreset("habaneraa-one-page-resume-zh");
const legacyFontIds = new Set(["system", "sans", "serif", "mono"]);

function normalizeDesign(template: ResumeTemplate, value: ResumeDesign | undefined) {
  const preset = getResumeTemplatePreset(template);
  if (!value || legacyFontIds.has(value.fontFamily) || !fontOptions.some((font) => font.id === value.fontFamily)) return preset;
  return { ...preset, ...value };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function draftToHtml(draft: GeneratedResume) {
  const personal = draft.personalInfo || {};
  const contact = [personal.phone, personal.email, personal.city].filter(Boolean).map(escapeHtml).join(" · ");
  const renderExperience = (experience: GeneratedResume["experiences"][number]) => `
    <h3>${escapeHtml(experience.title)}</h3>
    <p><strong>${escapeHtml(experience.subtitle)}</strong>${experience.date ? ` · ${escapeHtml(experience.date)}` : ""}</p>
    <ul>${experience.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
  `;
  const structure = resolveResumeStructure(draft.job, draft.experiences);
  const grouped = new Map<string, GeneratedResume["experiences"]>();
  sortResumeEntries(draft.experiences, structure).forEach((experience) => {
    const section = normalizeResumeSection(experience.type);
    grouped.set(section, [...(grouped.get(section) || []), experience]);
  });
  const sectionHtml = (title: string) => {
    if (title === "个人优势") return draft.summary ? `<h2>个人优势</h2><p>${escapeHtml(draft.summary)}</p>` : "";
    if (title === "专业技能") return draft.skills.length ? `<h2>专业技能</h2><p>${draft.skills.map(escapeHtml).join(" · ")}</p>` : "";
    const items = grouped.get(title) || [];
    grouped.delete(title);
    return items.length ? `<h2>${title}</h2>${items.map(renderExperience).join("")}` : "";
  };
  const orderedSections = structure.sectionOrder.map(sectionHtml);
  const remainingSections = [...grouped.entries()].map(([title, items]) => items.length ? `<h2>${title}</h2>${items.map(renderExperience).join("")}` : "");
  const sections = [...orderedSections, ...remainingSections].join("");
  return `
    <h1>${escapeHtml(personal.name || "姓名待补充")}</h1>
    <p><strong>${escapeHtml(draft.headline || draft.targetRole)}</strong></p>
    <p>${contact || "请在职业档案中补充联系方式"}</p>
    ${sections}
  `;
}

function ResumeRichEditor({ content, template, design, onUpdate }: {
  content: string;
  template: ResumeTemplate;
  design: ResumeDesign;
  onUpdate: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
    ],
    content,
    immediatelyRender: false,
    editorProps: { attributes: { class: "resume-paper-content", "aria-label": "简历正文编辑区" } },
    onUpdate: ({ editor: currentEditor }) => onUpdate(currentEditor.getHTML()),
  });

  if (!editor) return <div className="resume-editor-loading">正在载入编辑器…</div>;

  function editLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const value = window.prompt("输入链接地址", previous || "https://");
    if (value === null) return;
    if (!value.trim()) editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor?.chain().focus().extendMarkRange("link").setLink({ href: value.trim() }).run();
  }

  const font = fontOptions.find((item) => item.id === design.fontFamily) || fontOptions[0];
  const paperStyle = {
    "--resume-font": font.css,
    "--resume-font-size": `${design.fontSize}pt`,
    "--resume-line-height": String(design.lineHeight),
    "--resume-page-padding": `${design.pageMargin}px`,
    "--resume-accent": design.accentColor,
  } as CSSProperties;

  return <>
    <div className="format-toolbar" aria-label="文字格式工具栏">
      <div className="toolbar-group">
        <button className={editor.isActive("paragraph") ? "active" : ""} type="button" onClick={() => editor.chain().focus().setParagraph().run()}>正文</button>
        <button className={editor.isActive("heading", { level: 1 }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button className={editor.isActive("heading", { level: 2 }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button className={editor.isActive("heading", { level: 3 }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      </div>
      <i />
      <div className="toolbar-group">
        <button aria-label="粗体" className={editor.isActive("bold") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button aria-label="斜体" className={editor.isActive("italic") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
        <button aria-label="下划线" className={editor.isActive("underline") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <button aria-label="删除线" className={editor.isActive("strike") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
        <button className={editor.isActive("highlight") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleHighlight().run()}>高亮</button>
      </div>
      <i />
      <div className="toolbar-group">
        <button className={editor.isActive("bulletList") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}><IoListOutline /> 无序</button>
        <button className={editor.isActive("orderedList") ? "active" : ""} type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 有序</button>
        <button className={editor.isActive({ textAlign: "left" }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()}>左</button>
        <button className={editor.isActive({ textAlign: "center" }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()}>中</button>
        <button className={editor.isActive({ textAlign: "right" }) ? "active" : ""} type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()}>右</button>
      </div>
      <i />
      <div className="toolbar-group">
        <button className={editor.isActive("link") ? "active" : ""} type="button" onClick={editLink}>链接</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>分隔线</button>
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>清除格式</button>
      </div>
      <i />
      <div className="toolbar-group">
        <button aria-label="撤销" type="button" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><IoArrowUndoOutline /></button>
        <button aria-label="重做" type="button" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><IoArrowRedoOutline /></button>
      </div>
    </div>
    <div className="resume-canvas"><article className={`resume-paper resume-template-${template}`} style={paperStyle}><EditorContent editor={editor} /></article></div>
  </>;
}

function TemplatePicker({ current, recommended, onClose, onApply }: { current: ResumeTemplate; recommended: ResumeTemplate; onClose: () => void; onApply: (value: ResumeTemplate) => void }) {
  const [selected, setSelected] = useState(current);
  return <div className="template-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
      <header><div><span><IoDocumentTextOutline /></span><div><h2 id="template-modal-title">选择简历模板</h2><p>所有模板使用同一份正文，切换只改变正式排版。</p></div></div><button type="button" aria-label="关闭模板选择" onClick={onClose}><IoCloseOutline /></button></header>
      <div className="template-gallery">{templates.map((item) => <button key={item.id} className={selected === item.id ? "active" : ""} type="button" onClick={() => setSelected(item.id)}>
        <span className={`template-sheet-preview ${item.id}`}><strong>姓名</strong><small>电话 · 邮箱 · 城市</small><b>教育经历</b><i /><i /><b>实习 / 项目经历</b><i /><i /><b>专业技能</b><i /></span>
        <span className="template-card-copy"><strong>{item.name}{item.id === recommended && <em>岗位推荐</em>}</strong><small>{item.description}</small><small>{item.suitable}</small><small className="template-source">{item.sourceName} · {item.engine} · {item.license}</small></span>
        <span className="template-check">{selected === item.id && <IoCheckmarkCircleOutline />}</span>
      </button>)}</div>
      <footer><p>模板可随时更换，不会删除已经编辑的内容。</p><div><button type="button" onClick={onClose}>取消</button><button className="primary" type="button" onClick={() => onApply(selected)}>应用模板</button></div></footer>
    </section>
  </div>;
}

type AiEditMessage = { role: "user" | "assistant"; text: string };
type AiEditSuggestion = { id: string; category: string; label: string; instruction: string };

function buildAiEditSuggestions(draft: GeneratedResume, html: string, method: (typeof RESUME_METHODS)[number]): AiEditSuggestion[] {
  const plainText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const hasEducation = draft.experiences.some((item) => /教育|学校/.test(item.type));
  const hasNumbers = /\d/.test(plainText);
  const contact = draft.personalInfo || {};
  const structure = resolveResumeStructure(draft.job, draft.experiences);
  const suggestions: AiEditSuggestion[] = [
    { id: "job-focus", category: "岗位", label: `强化「${draft.job.title}」针对性`, instruction: `根据目标岗位“${draft.job.title}”重新检查整份简历：调整内容顺序，优先呈现最相关的经历、技能和成果；不要增加档案中不存在的事实。` },
    { id: "method", category: "结构", label: `按${structure.stageLabel}重排`, instruction: `按照工作台对候选人阶段“${structure.stageLabel}”的判断优化结构。必须采用顺序：${structure.sectionOrder.join(" → ")}。原因：${structure.reason} 保留真实内容并删除重复表达。` },
    { id: "evidence", category: "内容", label: "让每条经历更有证据", instruction: "逐条检查经历要点，改成“动作 + 方法/场景 + 已有真实结果”的表达。只能使用原文和档案已有的数字，不能虚构指标。" },
    { id: "skills", category: "匹配", label: "整理岗位相关技能", instruction: `根据“${draft.job.title}”的职责重新排序专业技能，只保留档案中确实具备且与岗位相关的技能，并让技能能在经历中找到证据。` },
    { id: "summary", category: "开头", label: "重写个人优势摘要", instruction: `将个人优势改为 80—120 字：说明与“${draft.job.title}”最相关的背景、能力和真实成果，删除空泛自我评价，不新增事实。` },
    { id: "language", category: "表达", label: "统一专业措辞", instruction: "统一全篇时态、标点、日期和职位写法；减少“负责、参与、协助”等模糊词，改成能体现本人边界的准确动作，但不夸大职责。" },
    { id: "ats", category: "网申", label: "检查 ATS 可读性", instruction: "按 ATS 网申标准检查正文：章节名称清楚、关键词自然出现、避免表格化表达和无意义装饰，同时保持中文阅读自然。" },
    { id: "proofread", category: "校对", label: "只做最终校对", instruction: "只校对错别字、病句、标点、日期格式和中英文空格，不改动事实、不改变内容顺序。" },
  ];

  if (plainText.length > 2600) suggestions.splice(2, 0, { id: "compact", category: "篇幅", label: "压缩到一页", instruction: "在不删除关键岗位证据的前提下压缩到一页 A4：合并重复要点，缩短弱相关内容，保留最强成果和必要教育信息。" });
  else suggestions.splice(2, 0, { id: "density", category: "篇幅", label: "补足一页信息密度", instruction: "检查当前一页内容是否过少；优先从已选档案素材中补回与岗位相关的真实经历和成果。素材不足时保持简洁，不得编造。" });
  if (!hasNumbers) suggestions.splice(4, 0, { id: "metrics", category: "成果", label: "寻找可用量化结果", instruction: "检查档案和当前简历中已有的数字、规模、效率、覆盖范围或时间结果；只把已有量化事实放到最相关的经历中，没有数据就不要补数字。" });
  if (hasEducation) suggestions.push({ id: "education", category: "顺序", label: "优化教育经历位置", instruction: "根据候选人的经验阶段判断教育经历位置：在校生和应届生放前面，有经验候选人可放工作经历之后；教育信息本身不得删改或虚构。" });
  if (!contact.phone || !contact.email) suggestions.unshift({ id: "contact", category: "必填", label: "检查联系方式", instruction: "检查简历页首联系方式是否完整。缺少手机号或邮箱时只明确标记待补充，不得猜测或生成联系方式。" });
  method.focus.slice(0, 2).forEach((focus, index) => suggestions.push({ id: `focus-${index}`, category: "行业", label: focus.slice(0, 16), instruction: `围绕方法库重点“${focus}”检查整份简历，强化已有证据、调整相关经历顺序，但不得补充档案中不存在的事实。` }));
  return suggestions.slice(0, 12);
}

function AiResumeEditorDialog({ messages, suggestions, instruction, loading, error, onInstructionChange, onSend, onClose }: {
  messages: AiEditMessage[];
  suggestions: AiEditSuggestion[];
  instruction: string;
  loading: boolean;
  error: string;
  onInstructionChange: (value: string) => void;
  onSend: (instruction?: string) => void;
  onClose: () => void;
}) {
  return <div className="ai-resume-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-resume-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-resume-dialog-title">
      <header><div><span><IoSparklesOutline /></span><div><h2 id="ai-resume-dialog-title">AI 编辑简历</h2><p>用自然语言调整内容顺序、表达和页面密度。</p></div></div><button type="button" aria-label="关闭 AI 编辑" onClick={onClose}><IoCloseOutline /></button></header>
      <div className="ai-resume-chat">
        <div className="ai-message assistant"><span>AI</span><p>告诉我想怎么修改。我会直接更新当前简历，同时保留所有真实事实。</p></div>
        {messages.map((message, index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "AI" : "你"}</span><p>{message.text}</p></div>)}
        {loading && <div className="ai-message assistant loading"><span>AI</span><p>正在整理内容与版式…</p></div>}
      </div>
      <div className="ai-suggestion-heading"><div><strong>根据当前简历即时建议</strong><span>本地生成 · 点击后才调用 AI</span></div><b>{suggestions.length} 条</b></div>
      <div className="ai-quick-actions">{suggestions.map((suggestion) => <button type="button" title={suggestion.instruction} disabled={loading} onClick={() => onSend(suggestion.instruction)} key={suggestion.id}><span>{suggestion.category}</span>{suggestion.label}</button>)}</div>
      {error && <p className="ai-resume-error">{error}</p>}
      <div className="ai-resume-compose"><textarea rows={3} value={instruction} disabled={loading} placeholder="例如：把教育经历放到最前面，压缩空话，让项目成果更具体…" onChange={(event) => onInstructionChange(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSend(); }} /><button type="button" disabled={loading || !instruction.trim()} onClick={() => onSend()}><IoSendOutline /> {loading ? "修改中" : "发送"}</button></div>
      <footer><IoCheckmarkCircleOutline /> 不新增档案中不存在的学校、经历、技能或成果；每次修改会自动保存。</footer>
    </section>
  </div>;
}

export default function ResumeEditor() {
  const [draft, setDraft] = useState<GeneratedResume | null>(null);
  const [title, setTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [template, setTemplate] = useState<ResumeTemplate>("billryan");
  const [design, setDesign] = useState<ResumeDesign>(defaultDesign);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [aiEditorOpen, setAiEditorOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiMessages, setAiMessages] = useState<AiEditMessage[]>([]);
  const [aiEditing, setAiEditing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("尚未修改");
  const autosaveTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value = window.localStorage.getItem(GENERATED_RESUME_STORAGE);
        if (!value) return;
        const current = JSON.parse(value) as GeneratedResume;
        let html = draftToHtml(current);
        const saved = window.localStorage.getItem(`${GENERATED_RESUME_STORAGE}.html`);
        if (saved) {
          const parsed = JSON.parse(saved) as { createdAt?: string; html?: string };
          if (parsed.createdAt === current.createdAt && parsed.html) html = parsed.html;
        }
        setDraft(current);
        setTitle(current.title);
        const savedTemplate = normalizeResumeTemplate(current.template);
        const savedDesign = normalizeDesign(savedTemplate, current.design);
        setTemplate(savedTemplate);
        setDesign(savedDesign);
        if (!current.design || savedDesign.fontFamily !== current.design.fontFamily) {
          current.template = savedTemplate;
          current.design = savedDesign;
          window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(current));
        }
        setEditorHtml(html);
        setSaveStatus(saved ? "已恢复本地草稿" : "新生成版本");
      } catch { /* 损坏的本地草稿按空状态处理 */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const writeDraft = useCallback((html: string, nextTemplate = template, nextDesign = design) => {
    if (!draft || !html) return;
    const next = { ...draft, title: title.trim() || draft.title, template: nextTemplate, design: nextDesign, updatedAt: new Date().toISOString() };
    setDraft(next);
    window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(next));
    window.localStorage.setItem(`${GENERATED_RESUME_STORAGE}.html`, JSON.stringify({ createdAt: next.createdAt, html }));
  }, [design, draft, template, title]);

  const persistDraft = useCallback((showNotice = false) => {
    if (!draft || !editorHtml) return;
    writeDraft(editorHtml);
    setTitle(title.trim() || draft.title);
    setSaveStatus(`已保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
    if (showNotice) {
      setNotice("草稿已保存到当前工作台");
      window.setTimeout(() => setNotice(""), 2200);
    }
  }, [draft, editorHtml, title, writeDraft]);

  function handleEditorUpdate(html: string) {
    setEditorHtml(html);
    setSaveStatus("保存中…");
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      writeDraft(html);
      setSaveStatus(`已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
    }, 650);
  }

  function handleTitleUpdate(value: string) {
    setTitle(value);
    setSaveStatus("保存中…");
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      if (!draft || !editorHtml) return;
      const next = { ...draft, title: value.trim() || draft.title, template, design, updatedAt: new Date().toISOString() };
      setDraft(next);
      window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(next));
      window.localStorage.setItem(`${GENERATED_RESUME_STORAGE}.html`, JSON.stringify({ createdAt: next.createdAt, html: editorHtml }));
      setSaveStatus(`已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
    }, 650);
  }

  function applyTemplate(nextTemplate: ResumeTemplate) {
    const nextDesign = getResumeTemplatePreset(nextTemplate);
    setTemplate(nextTemplate);
    setDesign(nextDesign);
    writeDraft(editorHtml, nextTemplate, nextDesign);
    setSaveStatus("已应用模板推荐字体与配色");
    setTemplatePickerOpen(false);
  }

  function updateDesign(patch: Partial<ResumeDesign>) {
    const nextDesign = { ...design, ...patch };
    setDesign(nextDesign);
    writeDraft(editorHtml, template, nextDesign);
    setSaveStatus("排版设置已保存");
  }

  async function runAiEdit(value?: string) {
    const requestInstruction = (value || aiInstruction).trim();
    if (!requestInstruction || !draft || !editorHtml || aiEditing) return;
    setAiMessages((current) => [...current, { role: "user", text: requestInstruction }]);
    setAiInstruction("");
    setAiError("");
    setAiEditing(true);
    try {
      const result = await callAi<{ html: string; message: string; design: ResumeDesign }>("/api/ai/resume-edit", {
        instruction: requestInstruction,
        currentHtml: editorHtml,
        job: draft.job,
        sourceDraft: draft,
        design,
      });
      const nextDesign = { ...design, ...result.design };
      setEditorHtml(result.html);
      setDesign(nextDesign);
      setEditorRevision((current) => current + 1);
      writeDraft(result.html, template, nextDesign);
      setSaveStatus("AI 修改已自动保存");
      setAiMessages((current) => [...current, { role: "assistant", text: result.message || "已按要求更新当前简历。" }]);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 编辑失败，请检查设置中的 API Key 后重试");
    } finally {
      setAiEditing(false);
    }
  }

  if (!draft) return <main className="app-shell resume-shell">
    <AppSidebar active="resumes" />
    <section className="workspace"><AppTopbar /><div className="editor-page empty-editor-page">
      <Link className="resume-back" href="/resumes">← 返回简历管理</Link>
      <section className="editor-empty-state"><span><IoDocumentTextOutline /></span><h1>还没有可以编辑的简历</h1><p>先选择目标岗位和职业档案素材，AI 生成后会自动进入编辑器。</p><div><Link className="ghost-button button-link" href="/profile"><IoPersonOutline /> 创建职业档案</Link><Link className="primary-button button-link" href="/resumes/new">开始创建简历</Link></div></section>
    </div></section>
  </main>;

  const activeTemplate = templates.find((item) => item.id === template) || templates[0];
  const activeMethod = RESUME_METHODS.find((item) => item.id === draft.methodologyId) || resolveResumeMethodology(draft.job);
  const aiSuggestions = buildAiEditSuggestions(draft, editorHtml, activeMethod);
  return <main className="app-shell resume-shell">
    <AppSidebar active="resumes" />
    <section className="workspace"><AppTopbar /><div className="editor-page">
      <header className="editor-titlebar"><div><Link href="/resumes/new">← 返回素材选择</Link><input value={title} onChange={(event) => handleTitleUpdate(event.target.value)} aria-label="简历名称" /><p>{draft.job.company} · {draft.job.title}<span>{draft.match ? `${draft.match}% 匹配` : "岗位专属版本"}</span></p></div><div><button className="ai-edit-button" type="button" onClick={() => setAiEditorOpen(true)}><IoChatbubbleEllipsesOutline /> AI 编辑</button><Link className="button-link" href="/resumes/frontend-v3/edit"><IoDocumentTextOutline /> Typst 模板编辑器</Link><button type="button" onClick={() => window.print()}><IoDownloadOutline /> 打印预览</button><button className="primary" type="button" onClick={() => persistDraft(true)}><IoSaveOutline /> 保存</button></div></header>
      <div className="editor-layout"><section className="editor-main"><div className="editor-savebar"><IoCheckmarkCircleOutline /><span>正式 A4 富文本编辑 · {saveStatus}</span><button type="button" onClick={() => persistDraft(true)}>立即保存</button></div><ResumeRichEditor key={editorRevision} content={editorHtml} template={template} design={design} onUpdate={handleEditorUpdate} /><footer className="editor-footer"><span>所有正文与排版设置都会自动保存在本机</span><button type="button" onClick={() => persistDraft(true)}>保存编辑</button></footer></section>
        <aside className="editor-aside editor-design-aside">
          <section className="design-section"><div className="aside-heading"><h2>专业 LaTeX 模板</h2><p>仅保留已核验开源来源与许可证的模板</p></div><button className="current-template-card" type="button" onClick={() => setTemplatePickerOpen(true)}><span className={`template-thumbnail ${template}`}><i /><i /><i /></span><span><strong>{activeTemplate.name}</strong><small>{activeTemplate.sourceName} · {activeTemplate.engine}</small></span><b>更换</b></button></section>
          <details className="resume-method-card"><summary><span><IoSparklesOutline /></span><div><small>AI 简历方法库 · 已加载</small><h3>{activeMethod.name}</h3><p>{activeMethod.focus.slice(0, 2).join(" · ")}</p></div></summary><div className="resume-method-detail"><strong>推荐结构</strong><p>{activeMethod.sectionOrder.join(" → ")}</p><strong>要点写法</strong><ul>{activeMethod.bulletRules.map((rule) => <li key={rule}>{rule}</li>)}</ul><strong>避免</strong><p>{activeMethod.avoid.join("；")}</p></div></details>
          <section className="design-section typography-controls"><div className="typography-heading"><div><h3>文字与版面</h3><p>默认沿用 {activeTemplate.name} 的推荐规范</p></div><button type="button" onClick={() => updateDesign(getResumeTemplatePreset(template))}>恢复模板预设</button></div><label><span>正文字体</span><select value={design.fontFamily} onChange={(event) => updateDesign({ fontFamily: event.target.value })}>{Array.from(new Set(fontOptions.map((item) => item.category))).map((category) => <optgroup label={category} key={category}>{fontOptions.filter((item) => item.category === category).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup>)}</select><small>切换后会同步到正文预览、草稿和 LaTeX 导出</small></label><div className="design-control-grid"><label><span>字号</span><select value={design.fontSize} onChange={(event) => updateDesign({ fontSize: Number(event.target.value) })}>{[9, 9.5, 10, 10.5, 11, 11.5, 12].map((value) => <option value={value} key={value}>{value} pt</option>)}</select></label><label><span>行距</span><select value={design.lineHeight} onChange={(event) => updateDesign({ lineHeight: Number(event.target.value) })}>{[1.4, 1.42, 1.44, 1.48, 1.5, 1.55, 1.6, 1.65, 1.75].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div><label><span>页边距</span><select value={design.pageMargin} onChange={(event) => updateDesign({ pageMargin: Number(event.target.value) })}><option value={36}>紧凑 · 36 px</option><option value={38}>较紧凑 · 38 px</option><option value={40}>推荐 · 40 px</option><option value={46}>标准 · 46 px</option><option value={56}>宽松 · 56 px</option></select></label><div className="accent-picker"><span>强调色</span><div>{["#284967", "#087F7A", "#008F88", "#000066", "#2E6FA3", "#222222", "#326891", "#245A73", "#305F86", "#566A9B", "#8A1538", "#1F5F8B"].map((color) => <button aria-label={`选择强调色 ${color}`} title={color} className={design.accentColor.toUpperCase() === color.toUpperCase() ? "active" : ""} type="button" style={{ backgroundColor: color }} onClick={() => updateDesign({ accentColor: color })} key={color} />)}</div></div></section>
          <details className="design-details"><summary>生成信息</summary><div className="quality-card"><h3>岗位匹配<strong>{draft.match || "--"}{draft.match ? "%" : ""}</strong></h3><div><i style={{ width: `${draft.match}%` }} /></div><p>沿用生成前保存的岗位分析，不重复调用 AI。</p></div><div className="requirement-list"><h3>已写入 {draft.experiences.length} 段经历</h3>{draft.experiences.map((item) => <div key={item.title}><span>{item.title}</span><b className="covered">已写入</b></div>)}</div></details>
          <div className="fact-list compact"><h3><IoSparklesOutline /> 真实性原则</h3><p>只重组已选择素材，不自动添加没有依据的技能、数字和经历。</p><Link className="ghost-button button-link" href="/resumes/new">重新选择素材</Link></div>
        </aside></div>
    </div></section>
    {templatePickerOpen && <TemplatePicker current={template} recommended={activeMethod.recommendedTemplate} onClose={() => setTemplatePickerOpen(false)} onApply={applyTemplate} />}
    {aiEditorOpen && <AiResumeEditorDialog messages={aiMessages} suggestions={aiSuggestions} instruction={aiInstruction} loading={aiEditing} error={aiError} onInstructionChange={setAiInstruction} onSend={runAiEdit} onClose={() => setAiEditorOpen(false)} />}
    {notice && <div className="toast" role="status"><IoCheckmarkCircleOutline /> {notice}</div>}
  </main>;
}
