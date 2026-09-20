"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import { IoAddOutline, IoCheckmarkCircleOutline, IoCloseOutline, IoCodeSlashOutline, IoDocumentTextOutline, IoDownloadOutline, IoPencilOutline, IoSendOutline, IoSparklesOutline, IoTrashOutline } from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import { callAi, callVisionAi, GENERATED_RESUME_STORAGE, getAiProfile, type AiProfile, type GeneratedResume } from "../lib/ai-client";
import { blobUrlToDataUrl } from "../lib/resume-file";
import { RESUME_TEMPLATE_REFERENCES, normalizeResumeTemplate } from "../lib/resume-methodology";

const STORAGE = "job-workbench.module-resume";
const TEMPLATE_STORAGE = "job-workbench.typst-template-selection";
const COMPILER_URL = "/api/typst/compile";
const SOURCE_URL = "/api/typst/source";
const CHAT_STORAGE = "job-workbench.ai-chat";
const ids = ["habaneraa-one-page-resume-zh", "golixp-resume-zh-cn", "bone-resume", "brilliant-cv", "modern-cv", "basic-resume", "altacv", "vivid-cv"] as const;
const templates = RESUME_TEMPLATE_REFERENCES.filter((item) => (ids as readonly string[]).includes(item.id));
type Experience = GeneratedResume["experiences"][number];
type AiMessage = { role: "user" | "assistant"; text: string };
type ProfileArchive = AiProfile["archives"][number];

const emptyExperience = (): Experience => ({ type: "项目经历", title: "", subtitle: "", date: "", bullets: [""] });

function normalizeExperienceIdentity(value: string) {
  return value.toLowerCase().replace(/[\s·•—–\-_/（）()【】\[\],，.。:：;；]+/g, "");
}

function experienceKey(item: Pick<Experience, "title" | "subtitle" | "date">) {
  const parties = [item.title, item.subtitle]
    .map(normalizeExperienceIdentity)
    .filter(Boolean)
    .sort();

  return `${parties.join("|")}|${normalizeExperienceIdentity(item.date)}`;
}

function archiveToExperience(item: ProfileArchive): Experience {
  const bullets = (item.confirmedFacts?.length ? item.confirmedFacts : item.facts.length ? item.facts : item.description.split(/[。；\n]/))
    .map((line) => line.trim()).filter(Boolean).slice(0, 5);
  return { type: item.type, title: item.title, subtitle: item.subtitle, date: item.date, bullets: bullets.length ? bullets : ["请补充真实职责、方法或结果"] };
}

const SOURCE_AI_SUGGESTIONS = [
  "把个人优势压缩为两行岗位概述",
  "按时间倒序重排经历，保持各 SECTION 职责不变",
  "修复当前的 Typst 编译错误，简历内容保持不变",
  "统一日期格式为 YYYY.MM—YYYY.MM",
  "删除重复表达，保留每段经历 2—4 条真实要点",
];

function save(resume: GeneratedResume) { const next = { ...resume, updatedAt: new Date().toISOString() }; window.localStorage.setItem(STORAGE, JSON.stringify(next)); window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(next)); }
function splitSkills(value: string) { return value.split(/[，、,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 18); }

// AI chat history is kept per resume draft (keyed by createdAt) so reopening
// the editor or the AI dialog restores every previous edit instruction.
function loadChat(createdAt: string) {
  if (!createdAt) return [];
  try {
    const map = JSON.parse(window.localStorage.getItem(CHAT_STORAGE) || "{}") as Record<string, unknown>;
    return Array.isArray(map[createdAt]) ? (map[createdAt] as AiMessage[]).slice(-100) : [];
  } catch { return []; }
}
function saveChat(createdAt: string, messages: AiMessage[]) {
  if (!createdAt) return;
  try {
    const map = JSON.parse(window.localStorage.getItem(CHAT_STORAGE) || "{}") as Record<string, AiMessage[]>;
    map[createdAt] = messages.slice(-100);
    window.localStorage.setItem(CHAT_STORAGE, JSON.stringify(map));
  } catch { /* storage unavailable — history is best-effort */ }
}

function ExperienceCard({ item, onChange, onRemove }: { item: Experience; onChange: (value: Experience) => void; onRemove: () => void }) {
  const update = (patch: Partial<Experience>) => onChange({ ...item, ...patch });
  return <article className="resume-module-card"><header><span>{item.type || "经历"}</span><button type="button" aria-label="删除经历" onClick={onRemove}><IoTrashOutline /></button></header><div className="resume-module-grid"><label>名称<input value={item.title} onChange={(event) => update({ title: event.target.value })} /></label><label>时间<input value={item.date} onChange={(event) => update({ date: event.target.value })} /></label></div><label>角色或单位<input value={item.subtitle} onChange={(event) => update({ subtitle: event.target.value })} /></label><label>经历要点<textarea value={item.bullets.join("\n")} onChange={(event) => update({ bullets: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5) })} rows={Math.max(3, item.bullets.length + 1)} /></label><small>一行一条</small></article>;
}

export default function LatexResumeStudio() {
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPosition, setAiPosition] = useState<{ left: number; top: number } | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [compileError, setCompileError] = useState("");
  const [chatClearing, setChatClearing] = useState(false);
  const [profileArchives, setProfileArchives] = useState<ProfileArchive[]>([]);
  const [addExperienceOpen, setAddExperienceOpen] = useState(false);
  const [addExperienceMode, setAddExperienceMode] = useState<"archive" | "manual">("archive");
  const [manualExperience, setManualExperience] = useState<Experience>(() => emptyExperience());
  const [experienceAiBusy, setExperienceAiBusy] = useState("");
  const [experienceAiError, setExperienceAiError] = useState("");

  useEffect(() => { try { const current = JSON.parse(window.localStorage.getItem(GENERATED_RESUME_STORAGE) || "null") as GeneratedResume | null; if (!current) return; const local = JSON.parse(window.localStorage.getItem(STORAGE) || "null") as GeneratedResume | null; const next = local?.createdAt === current.createdAt ? local : current; const stored = window.localStorage.getItem(TEMPLATE_STORAGE); const template = (ids as readonly string[]).includes(String(stored)) ? stored as (typeof ids)[number] : "habaneraa-one-page-resume-zh"; // Typst source is bound to one template; drop it when the template changed since it was saved.
    const typstSource = next.template === template ? next.typstSource : undefined; setResume({ ...next, template, typstSource }); setSkillsText(next.skills.join("、")); setAiMessages(loadChat(next.createdAt)); setProfileArchives(getAiProfile()?.archives || []); } catch { /* Empty state below. */ } }, []);
  const template = useMemo(() => templates.find((item) => item.id === normalizeResumeTemplate(resume?.template)) || templates[0], [resume]);
  const aiSuggestions = useMemo(() => {
    if (!resume) return [];
    const entries = resume.experiences || [];
    const types = entries.map((entry) => entry.type);
    const suggestions: string[] = [];
    if (!resume.personalInfo.email) suggestions.push("补全真实邮箱，并保留现有电话");
    if (!resume.personalInfo.phone) suggestions.push("补全真实电话，并保留现有邮箱");
    if (!resume.summary || resume.summary.length > 145) suggestions.push("将个人优势压缩为两行岗位概述");
    if (!types.some((type) => /工作|实习/.test(type))) suggestions.push("检查是否有真实实习或工作经历可加入");
    if (!types.some((type) => /项目|研究/.test(type))) suggestions.push("从档案中补充最相关的真实项目经历");
    if (!types.some((type) => /教育|学校|学历/.test(type))) suggestions.push("补充教育经历：学校、专业、学历与日期");
    if (entries.some((entry) => entry.bullets.length < 2)) suggestions.push("补足弱经历：每段保留 2—4 条真实要点");
    if (entries.some((entry) => entry.bullets.some((bullet) => !/\d|提升|降低|完成|覆盖|交付|优化|建立|负责/.test(bullet)))) suggestions.push("将经历改写为动作、方法与真实结果");
    if (resume.skills.length < 8) suggestions.push("从已有档案补齐 8—14 项岗位相关技能");
    if (entries.length > 6) suggestions.push("压缩弱相关经历，优先控制为一页 A4");
    suggestions.push("按目标岗位重排章节并检查时间倒序");
    return [...new Set(suggestions)].slice(0, 7);
  }, [resume]);
  const archiveCandidates = useMemo(() => {
    if (!resume) return [];
    const used = new Set(resume.experiences.map(experienceKey));
    const currentTypes = resume.experiences.map((item) => item.type);
    const skillSet = new Set(resume.skills.map((item) => item.toLowerCase()));
    return profileArchives
      .filter((archive) => !used.has(experienceKey(archive)))
      .map((archive) => {
        const typeMissing = /工作|实习/.test(archive.type) ? !currentTypes.some((type) => /工作|实习/.test(type))
          : /项目|研究/.test(archive.type) ? !currentTypes.some((type) => /项目|研究/.test(type))
            : /教育/.test(archive.type) ? !currentTypes.some((type) => /教育|学校|学历/.test(type)) : false;
        const skillOverlap = archive.skills.filter((skill) => skillSet.has(skill.toLowerCase()) || resume.job.title.toLowerCase().includes(skill.toLowerCase())).length;
        const hasResult = archive.facts.some((fact) => /\d|提升|降低|完成|覆盖|交付|优化/.test(fact));
        return { archive, score: (typeMissing ? 5 : 0) + Math.min(skillOverlap, 3) * 2 + (hasResult ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score || a.archive.title.localeCompare(b.archive.title));
  }, [profileArchives, resume]);
  const recommendedArchiveKeys = useMemo(() => new Set(archiveCandidates.slice(0, 3).filter((item) => item.score > 0).map((item) => experienceKey(item.archive))), [archiveCandidates]);
  const recommendedContentTypes = useMemo(() => {
    if (!resume) return [];
    const types = resume.experiences.map((item) => item.type);
    const recommendations: string[] = [];
    if (!types.some((type) => /工作|实习/.test(type))) recommendations.push("实习或工作经历");
    if (!types.some((type) => /项目|研究/.test(type))) recommendations.push("岗位相关项目");
    if (!types.some((type) => /教育|学校|学历/.test(type))) recommendations.push("教育经历");
    if (resume.experiences.some((item) => !item.bullets.some((bullet) => /\d|提升|降低|覆盖|交付|完成/.test(bullet)))) recommendations.push("量化成果证据");
    return recommendations.slice(0, 4);
  }, [resume]);
  // Editing structured data invalidates the source snapshot: the next source
  // entry is regenerated from the new data instead of the stale snapshot.
  // Persist the AI chat whenever it changes; clearing writes an empty history.
  useEffect(() => { if (!resume) return; saveChat(resume.createdAt, aiMessages); }, [aiMessages, resume]);
  function update(patch: Partial<GeneratedResume>) { setResume((current) => { if (!current) return current; const next = { ...current, ...patch, typstSource: undefined, updatedAt: new Date().toISOString() }; save(next); return next; }); }
  function updateExperience(index: number, value: Experience) { if (resume) update({ experiences: resume.experiences.map((entry, itemIndex) => itemIndex === index ? value : entry) }); }
  function addExperience() { setAddExperienceMode(profileArchives.length ? "archive" : "manual"); setExperienceAiError(""); setAddExperienceOpen(true); }
  async function polishAndAddExperience(candidate: Experience, sourceArchive?: ProfileArchive) {
    if (!resume || experienceAiBusy) return;
    const pendingKey = sourceArchive ? experienceKey(sourceArchive) : "manual";
    setExperienceAiBusy(pendingKey);
    setExperienceAiError("");
    try {
      const result = await callAi<{ experience: Experience; message?: string }>("/api/ai/resume-experience-polish", {
        candidate,
        sourceArchive,
        currentResume: resume,
        job: resume.job,
      });
      update({ experiences: [...resume.experiences, result.experience] });
      if (!sourceArchive) setManualExperience(emptyExperience());
      setAddExperienceOpen(false);
    } catch (error) {
      setExperienceAiError(error instanceof Error ? error.message : "AI 未能整理这段经历，请补充真实信息后重试");
    } finally {
      setExperienceAiBusy("");
    }
  }
  function addManualExperience() {
    if (!resume || !manualExperience.title.trim()) return;
    void polishAndAddExperience({ ...manualExperience, bullets: manualExperience.bullets.map((item) => item.trim()).filter(Boolean).slice(0, 5) });
  }
  function addArchiveExperience(item: ProfileArchive) { void polishAndAddExperience(archiveToExperience(item), item); }
  function persist() { if (!resume) return; const skills = splitSkills(skillsText); const next = { ...resume, skills, typstSource: JSON.stringify(skills) === JSON.stringify(resume.skills) ? resume.typstSource : undefined }; setResume(next); save(next); }
  async function compile(download = false) { if (!resume) return; const next = { ...resume, skills: splitSkills(skillsText), template: template.id as GeneratedResume["template"] }; const payload: Record<string, unknown> = { template: template.id, resume: next }; if (sourceMode && next.typstSource) payload.source = next.typstSource; setPreviewBusy(true); setPreviewError(""); try { const response = await fetch(download ? COMPILER_URL : `${COMPILER_URL}?format=preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Typst 编译失败"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); if (download) { const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${next.title || next.job.title || "resume"}.pdf`; anchor.click(); URL.revokeObjectURL(url); } else setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return url; }); setCompileError(""); save(next); } catch (error) { const message = error instanceof Error ? error.message : "本地 Typst 服务不可用"; setPreviewError(message); setCompileError(message.slice(0, 1200)); } finally { setPreviewBusy(false); } }
  // compile is intentionally excluded: the effect is driven by resume/template changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!resume) return; const timer = window.setTimeout(() => void compile(), 650); return () => window.clearTimeout(timer); }, [resume, template.id]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  async function fetchSource(extra: Record<string, unknown>) {
    const response = await fetch(SOURCE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: template.id, resume: { ...resume, ...extra } }) });
    const data = await response.json().catch(() => ({})) as { source?: string; error?: string };
    if (!response.ok) throw new Error(data.error || "无法获取 Typst 源码");
    return String(data.source || "");
  }
  async function enterSourceMode() { if (!resume || sourceBusy) return; setEditorOpen(true); if (resume.typstSource) { setSourceMode(true); return; } setSourceMode(true); setSourceBusy(true); try { const source = await fetchSource({ skills: splitSkills(skillsText) }); const next = { ...resume, typstSource: source }; setResume(next); save(next); } catch (error) { setSourceMode(false); setPreviewError(error instanceof Error ? error.message : "无法获取 Typst 源码"); } finally { setSourceBusy(false); } }
  async function refreshSource() { if (!resume || sourceBusy) return; setSourceBusy(true); try { const source = await fetchSource({ skills: splitSkills(skillsText) }); const next = { ...resume, typstSource: source }; setResume(next); save(next); } catch (error) { setPreviewError(error instanceof Error ? error.message : "无法获取 Typst 源码"); } finally { setSourceBusy(false); } }
  function updateSource(value: string) { setResume((current) => { if (!current) return current; const next = { ...current, typstSource: value, updatedAt: new Date().toISOString() }; save(next); return next; }); }
  async function askAi(value = instruction) { const request = value.trim(); if (!resume || !request || aiBusy) return; setAiMessages((messages) => [...messages, { role: "user", text: request }]); setInstruction(""); setAiBusy(true); try { // Send the persisted conversation so later instructions build on earlier ones.
      const history = [...aiMessages, { role: "user" as const, text: request }]; if (sourceMode) { const source = resume.typstSource; if (!source) throw new Error("还没有可编辑的源码，请先进入源码模式生成"); const pendingError = compileError || undefined; const result = await callAi<{ typstSource: string; message: string }>("/api/ai/resume-source-edit", { instruction: request, typstSource: source, compileError: pendingError, currentResume: resume, sourceDraft: resume, job: resume.job, history }); const next = { ...resume, typstSource: result.typstSource }; setCompileError(""); setResume(next); save(next); setAiMessages((messages) => [...messages, { role: "assistant", text: `${result.message || "已完成源码修改，正在重新排版。"}${pendingError ? "（已附带之前的编译错误，如未修复可点预览旁的按钮重试）" : ""}` }]); return; } if (!previewUrl) throw new Error("当前页面还没有编译完成，请等待预览出现后再发送"); const preview = await blobUrlToDataUrl(previewUrl); const result = await callVisionAi<{ resume: Pick<GeneratedResume, "title" | "targetRole" | "headline" | "summary" | "skills" | "experiences" | "personalInfo" | "layoutAppendText">; message: string; layoutAdjustment?: { elementSpaciness?: number }; visualReview?: { fill?: string; estimatedFillPercent?: number; issues?: string[] } }>("/api/ai/resume-vision-edit", { instruction: request, currentResume: resume, sourceDraft: resume, job: resume.job, preview, history }); const next = { ...resume, ...result.resume, design: { fontFamily: resume.design?.fontFamily || "source-han-sans", fontSize: resume.design?.fontSize ?? 10, lineHeight: resume.design?.lineHeight ?? 1.5, pageMargin: resume.design?.pageMargin ?? 40, accentColor: resume.design?.accentColor || "#284967", elementSpaciness: result.layoutAdjustment?.elementSpaciness ?? resume.design?.elementSpaciness }, typstSource: undefined }; setResume(next); setSkillsText(next.skills.join("、")); save(next); const review = result.visualReview; const visualNote = review?.estimatedFillPercent ? `\n视觉检查（修改前页面）：约 ${review.estimatedFillPercent}% 页面利用率${review.issues?.length ? `；${review.issues.join("；")}` : ""}。` : ""; setAiMessages((messages) => [...messages, { role: "assistant", text: `${result.message || "已结合当前页面更新简历。"}${visualNote}` }]); } catch (error) { setAiMessages((messages) => [...messages, { role: "assistant", text: error instanceof Error ? `这次没有完成修改：${error.message}` : "这次修改没有完成，请换一种说法再试。" }]); } finally { setAiBusy(false); } }
  function fixCompileError() { void askAi("请修复当前的 Typst 编译错误，保持简历内容不变。"); }
  function startDrag(event: PointerEvent<HTMLElement>) { const dialog = event.currentTarget.closest(".module-ai-dialog"); if (!dialog) return; const bounds = dialog.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; const move = (next: globalThis.PointerEvent) => setAiPosition({ left: Math.max(8, next.clientX - x), top: Math.max(8, next.clientY - y) }); const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true }); }
  if (!resume) return <main className="app-shell resume-shell"><AppSidebar active="resumes" /><section className="workspace"><AppTopbar /><div className="latex-empty"><IoDocumentTextOutline /><h1>还没有可以编辑的简历</h1><p>先创建职业档案并生成岗位专属简历，系统会把它填入真实 Typst 模板。</p><Link href="/resumes/new" className="primary-button button-link">开始创建简历</Link></div></section></main>;
  return <main className="app-shell resume-shell module-resume-shell"><AppSidebar active="resumes" /><section className="workspace"><AppTopbar /><header className="module-titlebar"><div><Link href="/resumes">← 简历管理</Link><h1>{resume.job.title || resume.title}</h1></div><div><button type="button" onClick={() => setEditorOpen((open) => !open)}><IoPencilOutline /> {editorOpen ? "收起编辑" : "编辑内容"}</button><button className={sourceMode ? "active" : ""} type="button" onClick={() => { if (sourceMode) setSourceMode(false); else void enterSourceMode(); }}><IoCodeSlashOutline /> {sourceBusy ? "生成源码中…" : sourceMode ? "数据编辑" : "源码编辑"}</button><button type="button" onClick={() => setAiOpen(true)}><IoSparklesOutline /> AI 编辑</button><button type="button" onClick={() => setTemplatePickerOpen(true)}><IoDocumentTextOutline /> 换模板</button><button type="button" disabled={previewBusy} onClick={() => void compile(true)}><IoDownloadOutline /> {previewBusy ? "编译中…" : "导出 PDF"}</button><button className="primary" type="button" onClick={persist}><IoDocumentTextOutline /> 保存简历</button></div></header>
    {/* Blob URLs are generated Typst previews and cannot use the image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <div className={`resume-editor-workspace${editorOpen ? " editor-open" : ""}`}><section className="module-preview real-template-preview"><div className="module-preview-canvas">{previewUrl ? <img className="typst-page-preview" alt="简历预览" src={previewUrl} /> : <div className="latex-preview-empty"><IoDocumentTextOutline /><strong>{previewBusy ? "正在排版…" : "等待简历预览"}</strong><p>{previewError || "正在通过 Typst 编译当前模板。"}</p></div>}</div></section>
    {editorOpen && !sourceMode && <section className="module-edit-dialog" aria-labelledby="edit-title"><header><div><span><IoPencilOutline /></span><div><h2 id="edit-title">编辑简历内容</h2><p>联系方式和内容均可编辑，修改后自动刷新预览。</p></div></div><div className="module-edit-header-actions"><button className="module-add-header" type="button" onClick={addExperience}><IoAddOutline /> 添加经历</button><button type="button" aria-label="关闭内容编辑" onClick={() => setEditorOpen(false)}><IoCloseOutline /></button></div></header><div className="module-edit-body"><article className="resume-module-card basic-module"><header><span>基本信息与联系方式</span><IoPencilOutline /></header><div className="resume-module-grid"><label>姓名<input value={resume.personalInfo.name || ""} onChange={(event) => update({ personalInfo: { ...resume.personalInfo, name: event.target.value } })} /></label><label>求职定位<input value={resume.headline} onChange={(event) => update({ headline: event.target.value })} /></label><label>电话<input value={resume.personalInfo.phone || ""} onChange={(event) => update({ personalInfo: { ...resume.personalInfo, phone: event.target.value } })} placeholder="138 0000 0000" /></label><label>邮箱<input type="email" value={resume.personalInfo.email || ""} onChange={(event) => update({ personalInfo: { ...resume.personalInfo, email: event.target.value } })} placeholder="name@example.com" /></label></div><label>城市<input value={resume.personalInfo.city || ""} onChange={(event) => update({ personalInfo: { ...resume.personalInfo, city: event.target.value } })} placeholder="杭州" /></label><label>个人优势<textarea value={resume.summary} onChange={(event) => update({ summary: event.target.value })} rows={4} /></label></article>{resume.experiences.map((item, index) => <ExperienceCard item={item} key={index} onChange={(value) => updateExperience(index, value)} onRemove={() => update({ experiences: resume.experiences.filter((_, itemIndex) => itemIndex !== index) })} />)}<article className="resume-module-card"><header><span>专业技能</span><IoPencilOutline /></header><label>技能关键词<textarea value={skillsText} onChange={(event) => { setSkillsText(event.target.value); update({ skills: splitSkills(event.target.value) }); }} rows={3} /></label><small>用顿号或换行分隔。</small></article></div></section>}
    {editorOpen && sourceMode && <section className="module-edit-dialog module-source-dialog" aria-labelledby="source-title"><header><div><span><IoCodeSlashOutline /></span><div><h2 id="source-title">编辑 Typst 源码</h2><p>直接修改实际编译的 .typ 源码，改动会自动重新排版。</p></div></div><button type="button" onClick={() => setEditorOpen(false)}><IoCloseOutline /></button></header><div className="module-source-body"><div className="module-source-toolbar"><small>{"// SECTION: 注释定义各内容区职责；请保留 #import、#show 与模板函数调用。数据面板的任何修改都会使这里的源码重置为最新注入版本。"}</small><button type="button" disabled={sourceBusy} onClick={() => void refreshSource()}>{sourceBusy ? "生成中…" : "从当前数据重新生成"}</button></div>{compileError && <div className="module-source-error"><span>{compileError}</span><button type="button" disabled={aiBusy} onClick={fixCompileError}>{aiBusy ? "AI 修复中…" : "让 AI 修复编译错误"}</button></div>}<textarea className="module-source-editor" value={resume.typstSource || ""} spellCheck={false} wrap="off" placeholder={sourceBusy ? "正在从模板生成源码…" : "暂无源码，点击上方按钮从当前数据生成。"} onChange={(event) => updateSource(event.target.value)} /></div></section>}</div>
    {addExperienceOpen && <div className="module-overlay experience-add-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !experienceAiBusy) setAddExperienceOpen(false); }}><section className="experience-add-dialog" role="dialog" aria-modal="true" aria-labelledby="experience-add-title"><header><div><span><IoSparklesOutline /></span><div><h2 id="experience-add-title">AI 添加经历</h2><p>档案与手写内容都会先经过 AI 校验、优化并适配当前简历格式。</p></div></div><button type="button" aria-label="关闭添加经历" disabled={Boolean(experienceAiBusy)} onClick={() => setAddExperienceOpen(false)}><IoCloseOutline /></button></header><div className="experience-add-tabs" role="tablist"><button className={addExperienceMode === "archive" ? "active" : ""} type="button" role="tab" aria-selected={addExperienceMode === "archive"} disabled={Boolean(experienceAiBusy)} onClick={() => { setExperienceAiError(""); setAddExperienceMode("archive"); }}>从档案库添加 <b>{archiveCandidates.length}</b></button><button className={addExperienceMode === "manual" ? "active" : ""} type="button" role="tab" aria-selected={addExperienceMode === "manual"} disabled={Boolean(experienceAiBusy)} onClick={() => { setExperienceAiError(""); setAddExperienceMode("manual"); }}>手写经历</button></div>{experienceAiError && <div className="experience-ai-error" role="alert">{experienceAiError}</div>}{addExperienceMode === "archive" ? <div className="experience-archive-pane">{recommendedContentTypes.length ? <section className="recommended-content-types"><div><IoSparklesOutline /><strong>AI 建议优先补充</strong></div><p>{recommendedContentTypes.map((item) => <span key={item}>{item}</span>)}</p></section> : null}{archiveCandidates.length ? <div className="experience-archive-list">{archiveCandidates.map(({ archive }) => { const key = experienceKey(archive); const recommended = recommendedArchiveKeys.has(key); const pending = experienceAiBusy === key; return <article key={key} className={recommended ? "recommended" : ""}><div><span>{archive.type}</span>{recommended && <em><IoSparklesOutline /> AI 推荐</em>}<h3>{archive.title}</h3><p>{archive.subtitle}{archive.date ? ` · ${archive.date}` : ""}</p><small>{archive.description || archive.facts.slice(0, 2).join("；")}</small></div><button type="button" disabled={Boolean(experienceAiBusy)} onClick={() => addArchiveExperience(archive)}><IoSparklesOutline /> {pending ? "AI 优化中…" : "AI 优化并添加"}</button></article>; })}</div> : <div className="experience-add-empty"><IoCheckmarkCircleOutline /><strong>档案库中的经历已全部加入</strong><p>可以切换到“手写经历”继续补充真实内容。</p></div>}</div> : <div className="experience-manual-pane"><div className="resume-module-grid"><label>经历类型<select value={manualExperience.type} disabled={Boolean(experienceAiBusy)} onChange={(event) => setManualExperience((current) => ({ ...current, type: event.target.value }))}><option>工作经历</option><option>实习经历</option><option>项目经历</option><option>教育经历</option><option>成果证明</option></select></label><label>时间<input value={manualExperience.date} disabled={Boolean(experienceAiBusy)} onChange={(event) => setManualExperience((current) => ({ ...current, date: event.target.value }))} placeholder="2024.01—至今" /></label></div><label>名称<input value={manualExperience.title} disabled={Boolean(experienceAiBusy)} onChange={(event) => setManualExperience((current) => ({ ...current, title: event.target.value }))} placeholder="项目、公司或学校名称" /></label><label>角色或单位<input value={manualExperience.subtitle} disabled={Boolean(experienceAiBusy)} onChange={(event) => setManualExperience((current) => ({ ...current, subtitle: event.target.value }))} placeholder="职位、角色、专业或所属单位" /></label><label>真实素材<textarea rows={5} value={manualExperience.bullets.join("\n")} disabled={Boolean(experienceAiBusy)} onChange={(event) => setManualExperience((current) => ({ ...current, bullets: event.target.value.split("\n").slice(0, 5) }))} placeholder="一行一条，写下真实职责、方法、数据或结果；AI 会整理成简历表达" /></label><footer><span>AI 只润色你提供的真实事实，不会虚构经历或数字。</span><button type="button" disabled={Boolean(experienceAiBusy) || !manualExperience.title.trim() || !manualExperience.bullets.some((item) => item.trim())} onClick={addManualExperience}><IoSparklesOutline /> {experienceAiBusy === "manual" ? "AI 优化中…" : "AI 优化并添加"}</button></footer></div>}</section></div>}
    {templatePickerOpen && <div className="module-overlay" role="button" tabIndex={0} aria-label="关闭模板选择" onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") setTemplatePickerOpen(false); }} onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplatePickerOpen(false); }}><section className="module-template-dialog" role="dialog" aria-modal="true"><header><div><h2>选择真实 Typst 模板</h2><p>每项均使用打包的原始 .typ 源码。</p></div><button type="button" onClick={() => setTemplatePickerOpen(false)}><IoCloseOutline /></button></header><div className="module-template-groups">{templates.map((item) => <section key={item.id}><div className="module-template-list"><button className={item.id === template.id ? "active" : ""} type="button" onClick={() => { window.localStorage.setItem(TEMPLATE_STORAGE, item.id); setSourceMode(false); update({ template: item.id as GeneratedResume["template"] }); setTemplatePickerOpen(false); }}><i className={item.id} /><span><strong>{item.name}</strong><small>{item.suitable}</small><em>{item.sourceName} · {item.license}</em></span>{item.id === template.id && <IoCheckmarkCircleOutline />}</button></div></section>)}</div></section></div>}
    {aiOpen && <section className="module-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="module-ai-title" style={aiPosition ? { left: aiPosition.left, top: aiPosition.top, right: "auto", bottom: "auto" } : undefined}><header><div role="button" tabIndex={0} aria-label="拖动 AI 对话框" onPointerDown={startDrag} onKeyDown={() => undefined}><span><IoSparklesOutline /></span><div><h2 id="module-ai-title">{sourceMode ? "用 AI 修改 Typst 源码" : "和视觉 AI 一起编辑简历"}</h2><p>{sourceMode ? "DeepSeek 直接编辑当前 .typ 源码，遵守 SECTION 职责与模板结构。" : "Qwen3-VL-Flash 会同时读取当前页面和结构化内容。"}</p></div></div><button className="chat-clear-button" type="button" aria-label="清空对话记录" onClick={() => { if (chatClearing) { setAiMessages([]); setChatClearing(false); } else setChatClearing(true); }}>{chatClearing ? "确认清空" : "清空记录"}</button><button type="button" aria-label="关闭 AI 对话" onClick={() => { setAiOpen(false); setChatClearing(false); }}><IoCloseOutline /></button></header><div className="module-ai-body"><div className="module-ai-chat" aria-live="polite"><div className="module-ai-message assistant"><span>AI</span><p>{sourceMode ? "告诉我你想怎样修改源码。我会在保留 #import、#show 和模板函数的前提下修改，并遵守各 SECTION 的内容职责；我会记住我们之前的对话，编译失败时也会修复。" : "告诉我你想怎样调整简历。我会先看当前 A4 页面，再使用已有真实信息修改；我会记住我们之前的对话，不会仅凭接口成功就声称页面已经填满。"}</p></div>{aiMessages.map((message, index) => <div className={`module-ai-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "user" ? "你" : "AI"}</span><p>{message.text}</p></div>)}{aiBusy && <div className="module-ai-message assistant pending"><span>AI</span><p>{sourceMode ? "正在审校源码、核对 SECTION 职责并规划修改…" : "正在读取当前页面、核对事实并规划修改…"}</p></div>}</div><div className="module-ai-suggestion-label">可直接使用的指令</div><div className="module-ai-suggestions">{(sourceMode ? SOURCE_AI_SUGGESTIONS : aiSuggestions).map((item) => <button key={item} type="button" disabled={aiBusy} onClick={() => setInstruction(item)}>{item}</button>)}</div></div><footer><textarea value={instruction} disabled={aiBusy} rows={2} placeholder={sourceMode ? "例如：把个人优势压缩为两行，保持模板结构不变。" : "例如：将内容填满一整页 A4，保留所有相关事实，不要只压缩成一页。"} onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void askAi(); }} /><button className="module-ai-button" type="button" disabled={aiBusy || !instruction.trim()} onClick={() => void askAi()}><IoSendOutline /> {aiBusy ? "修改中…" : "发送"}</button></footer></section>}
    </section></main>;
}
