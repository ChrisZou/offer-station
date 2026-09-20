"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  IoAddOutline,
  IoBriefcaseOutline,
  IoCheckmarkCircleOutline,
  IoCheckmarkDoneOutline,
  IoCheckmarkOutline,
  IoChevronForwardOutline,
  IoCloudUploadOutline,
  IoCodeSlashOutline,
  IoEllipsisHorizontalOutline,
  IoFilterOutline,
  IoFolderOpenOutline,
  IoGridOutline,
  IoLayersOutline,
  IoListOutline,
  IoRibbonOutline,
  IoSchoolOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoTimeOutline,
  IoWarningOutline,
} from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import ProfilePersonalInfo from "./ProfilePersonalInfo";
import { callAi, callVisionAi, getAiProfile, saveAiProfile, type AiProfile } from "../lib/ai-client";
import { prepareResumePages } from "../lib/resume-file";

type Archive = {
  id: string;
  type: "工作经历" | "项目经历" | "教育经历" | "成果证明";
  title: string;
  subtitle: string;
  date: string;
  description: string;
  skills: string[];
  facts: { text: string; confirmed: boolean }[];
  evidence: string[];
  score: number;
};

type ArchiveFolder = { id: string; name: string; color: string };

const initialArchives: Archive[] = [];
const emptyArchive: Archive = { id: "", type: "工作经历", title: "", subtitle: "", date: "", description: "", skills: [], facts: [], evidence: [], score: 0 };
const emptyManualForm = { type: "工作经历" as Archive["type"], title: "", subtitle: "", startDate: "", endDate: "", current: false, description: "", skills: "", facts: [""] };
const archiveFoldersKey = "job-workbench.archive-folders";
const folderColors = ["#ff5f57", "#ff9f0a", "#30d158", "#0a84ff", "#bf5af2"];
const folderColorNames: Record<string, string> = { "#ff5f57": "红色", "#ff9f0a": "橙色", "#30d158": "绿色", "#0a84ff": "蓝色", "#bf5af2": "紫色" };

const typeIcons = { "工作经历": IoBriefcaseOutline, "项目经历": IoLayersOutline, "教育经历": IoSchoolOutline, "成果证明": IoRibbonOutline };

function archivesFromProfile(profile: AiProfile, prefix = "profile") : Archive[] {
  return profile.archives.map((item, index) => ({
    id: `${prefix}-${index}`,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    date: item.date,
    description: item.description,
    skills: item.skills,
    facts: item.facts.map((text) => ({ text, confirmed: Boolean(item.confirmedFacts?.includes(text)) })),
    evidence: item.evidence,
    score: Math.min(95, 46 + item.skills.length * 4 + item.facts.length * 5 + item.evidence.length * 6),
  }));
}

function archiveKey(archive: Archive) {
  return [archive.type, archive.title, archive.subtitle, archive.date].join("|");
}

function parseArchiveDate(date: string) {
  const months = [...date.matchAll(/(\d{4})[.年/-]?(\d{1,2})/g)].map((match) => `${match[1]}-${match[2].padStart(2, "0")}`);
  return { startDate: months[0] ?? "", endDate: months[1] ?? "", current: date.includes("至今") };
}

function formatArchiveDate(startDate: string, endDate: string, current: boolean) {
  const format = (value: string) => value.replace("-", ".");
  if (!startDate) return "时间待补充";
  return `${format(startDate)}—${current ? "至今" : endDate ? format(endDate) : "结束时间待补充"}`;
}

export default function CareerProfile() {
  const [archives, setArchives] = useState(initialArchives);
  const [selectedId, setSelectedId] = useState("");
  const archiveDetailRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState("全部内容");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showAiImport, setShowAiImport] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [aiImporting, setAiImporting] = useState(false);
  const [aiImportError, setAiImportError] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [editingArchiveId, setEditingArchiveId] = useState("");
  const [archiveFolders, setArchiveFolders] = useState<ArchiveFolder[]>([]);
  const [folderAssignments, setFolderAssignments] = useState<Record<string, string[]>>({});

  const filtered = useMemo(() => archives.filter((item) => {
    const folderIds = folderAssignments[archiveKey(item)] ?? [];
    const categoryMatched = filter === "全部内容" || item.type === filter || (filter === "unfiled" && !folderIds.length) || (filter.startsWith("folder:") && folderIds.includes(filter.slice(7)));
    return categoryMatched && `${item.title}${item.subtitle}${item.skills.join("")}`.includes(query.trim());
  }), [archives, filter, query, folderAssignments]);
  const selected = archives.find((item) => item.id === selectedId) ?? archives[0] ?? emptyArchive;

  useEffect(() => {
    archiveDetailRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedId]);
  const filterLabel = filter === "unfiled" ? "无收藏夹" : filter.startsWith("folder:") ? archiveFolders.find((folder) => folder.id === filter.slice(7))?.name ?? "收藏夹" : filter;
  const totalFacts = archives.reduce((sum, item) => sum + item.facts.length, 0);
  const confirmedFacts = archives.reduce((sum, item) => sum + item.facts.filter((fact) => fact.confirmed).length, 0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = getAiProfile();
      if (!saved?.archives.length) return;
      const restored = archivesFromProfile(saved);
      setArchives(restored);
      setSelectedId(restored[0].id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(archiveFoldersKey) || "null") as { folders?: ArchiveFolder[]; assignments?: Record<string, string | string[]> } | null;
        if (saved?.folders) setArchiveFolders(saved.folders);
        if (saved?.assignments) setFolderAssignments(Object.fromEntries(Object.entries(saved.assignments).map(([key, value]) => [key, Array.isArray(value) ? value : value ? [value] : []])));
      } catch { /* 保持空收藏夹状态 */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function toggleFact(index: number) {
    const next = archives.map((item) => item.id === selected.id ? { ...item, facts: item.facts.map((fact, factIndex) => factIndex === index ? { ...fact, confirmed: !fact.confirmed } : fact) } : item);
    setArchives(next);
    persistArchives(next);
  }

  function confirmAllFacts() {
    const next = archives.map((item) => item.id === selected.id ? { ...item, facts: item.facts.map((fact) => ({ ...fact, confirmed: true })) } : item);
    setArchives(next);
    persistArchives(next);
    notify("已确认该经历的全部关键成果");
  }

  function persistArchives(next: Archive[]) {
    const saved = getAiProfile();
    saveAiProfile({
      summary: saved?.summary ?? "",
      targetRoles: saved?.targetRoles ?? [],
      personalInfo: saved?.personalInfo,
      archives: next.map((item) => ({
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        date: item.date,
        description: item.description,
        skills: item.skills,
        facts: item.facts.map((fact) => fact.text),
        confirmedFacts: item.facts.filter((fact) => fact.confirmed).map((fact) => fact.text),
        evidence: item.evidence,
      })),
    });
  }

  function createManualArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const skills = manualForm.skills.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
    const facts = manualForm.facts.map((item) => item.trim()).filter(Boolean).map((text) => ({ text, confirmed: false }));
    const date = formatArchiveDate(manualForm.startDate, manualForm.endDate, manualForm.current);
    if (editingArchiveId) {
      const next = archives.map((item) => item.id === editingArchiveId ? {
        ...item,
        type: manualForm.type,
        title: manualForm.title.trim(),
        subtitle: manualForm.subtitle.trim() || "信息待补充",
        date,
        description: manualForm.description.trim(),
        skills,
        facts: facts.map((fact) => ({ ...fact, confirmed: item.facts.find((current) => current.text === fact.text)?.confirmed ?? false })),
        score: Math.min(90, 24 + skills.length * 6 + facts.length * 8 + (manualForm.description.trim() ? 12 : 0)),
      } : item);
      setArchives(next);
      persistArchives(next);
      setManualForm(emptyManualForm);
      setEditingArchiveId("");
      setShowManualAdd(false);
      notify("档案内容已更新");
      return;
    }
    const created: Archive = {
      id: `manual-${Date.now()}`,
      type: manualForm.type,
      title: manualForm.title.trim(),
      subtitle: manualForm.subtitle.trim() || "信息待补充",
      date,
      description: manualForm.description.trim(),
      skills,
      facts,
      evidence: [],
      score: Math.min(90, 24 + skills.length * 6 + facts.length * 8 + (manualForm.description.trim() ? 12 : 0)),
    };
    const next = [created, ...archives];
    setArchives(next);
    persistArchives(next);
    setSelectedId(created.id);
    setFilter("全部内容");
    setManualForm(emptyManualForm);
    setShowManualAdd(false);
    notify("档案内容已添加");
  }

  function openArchiveEditor() {
    const date = parseArchiveDate(selected.date);
    setManualForm({
      type: selected.type,
      title: selected.title,
      subtitle: selected.subtitle,
      ...date,
      description: selected.description,
      skills: selected.skills.join("，"),
      facts: selected.facts.length ? selected.facts.map((fact) => fact.text) : [""],
    });
    setEditingArchiveId(selected.id);
    setShowManualAdd(true);
  }

  function closeArchiveEditor() {
    setShowManualAdd(false);
    setEditingArchiveId("");
    setManualForm(emptyManualForm);
  }

  function persistFolderState(folders: ArchiveFolder[], assignments: Record<string, string[]>) {
    setArchiveFolders(folders);
    setFolderAssignments(assignments);
    window.localStorage.setItem(archiveFoldersKey, JSON.stringify({ folders, assignments }));
  }

  function assignSelectedColor(color: string) {
    const existing = archiveFolders.find((folder) => folder.color.toLowerCase() === color.toLowerCase());
    const folder = existing ?? { id: `folder-${color.replace("#", "")}`, name: `${folderColorNames[color] ?? "彩色"}收藏夹`, color };
    const folders = existing ? archiveFolders : [...archiveFolders, folder];
    const key = archiveKey(selected);
    const currentFolderIds = folderAssignments[key] ?? [];
    const assignments = { ...folderAssignments };
    if (currentFolderIds.includes(folder.id)) {
      const remaining = currentFolderIds.filter((id) => id !== folder.id);
      if (remaining.length) assignments[key] = remaining;
      else delete assignments[key];
    } else assignments[key] = [...currentFolderIds, folder.id];
    persistFolderState(folders, assignments);
    notify(currentFolderIds.includes(folder.id) ? "已取消该颜色收藏" : `已加入${folderColorNames[color] ?? "彩色"}收藏夹`);
  }

  function clearSelectedFolders() {
    const key = archiveKey(selected);
    if (!folderAssignments[key]?.length) return;
    const assignments = { ...folderAssignments };
    delete assignments[key];
    persistFolderState(archiveFolders, assignments);
    notify("已移至无收藏夹");
  }

  function openPersonalInfo() {
    window.dispatchEvent(new Event("job-workbench:edit-personal-info"));
  }

  async function createProfileWithAi() {
    setAiImporting(true);
    setAiImportError("");
    try {
      let profile: AiProfile & { warnings?: string[] };
      if (resumeFile) {
        const images = await prepareResumePages(resumeFile, setImportProgress);
        setImportProgress("Qwen3-VL-Flash 正在逐页识别…");
        profile = await callVisionAi<AiProfile & { warnings?: string[] }>("/api/ai/profile-vision", { images, filename: resumeFile.name });
      } else {
        setImportProgress("DeepSeek 正在整理文本…");
        profile = await callAi<AiProfile>("/api/ai/profile", { resumeText });
      }
      const created = archivesFromProfile(profile, `ai-${Date.now()}`);
      saveAiProfile(profile);
      setArchives(created);
      setSelectedId(created[0].id);
      setFilter("全部内容");
      setShowAiImport(false);
      setNotice(`AI 已创建 ${created.length} 张档案卡片${profile.warnings?.length ? `，另有 ${profile.warnings.length} 项待确认` : "，请逐条确认关键成果"}`);
    } catch (error) {
      setAiImportError(error instanceof Error ? error.message : "AI 解析失败");
    } finally {
      setAiImporting(false);
      setImportProgress("");
    }
  }

  return <main className="app-shell profile-shell">
    <AppSidebar active="profile" />
    <section className="workspace">
      <AppTopbar value={query} onChange={setQuery} placeholder="搜索经历或能力标签…" action={<button className="top-add icon-text-button" type="button" onClick={() => setShowManualAdd(true)}><IoAddOutline /> 新建档案</button>} />
      <div className="career-page">
        <header className="career-heading"><div><p className="eyebrow">个人能力资产</p><h1>职业档案</h1><p>把真实经历和能力标签整理成可复用的求职素材。</p></div><div className="career-heading-actions"><button className="ghost-button icon-text-button" type="button" onClick={() => setShowAiImport(true)}><IoCloudUploadOutline /> AI 导入简历</button><a className="primary-button button-link icon-text-button" href="/resumes/new"><IoSparklesOutline /> 生成简历</a></div></header>

        <ProfilePersonalInfo />

        <section className="profile-metrics">
          <article><span className="profile-metric-icon mint"><IoCheckmarkCircleOutline /></span><div><small>已确认成果</small><strong>{confirmedFacts}<em> / {totalFacts}</em></strong><p>可直接用于简历</p></div></article>
          <article><span className="profile-metric-icon blue"><IoFolderOpenOutline /></span><div><small>经历与项目</small><strong>{archives.length}</strong><p>{archives.length ? "已加入档案" : "等待添加内容"}</p></div></article>
          <article><span className="profile-metric-icon purple"><IoCodeSlashOutline /></span><div><small>能力标签</small><strong>{new Set(archives.flatMap((item) => item.skills)).size}</strong><p>用于岗位匹配</p></div></article>
        </section>

        <div className="career-layout">
          <aside className="career-filters">
            <div className="career-panel-title"><div><h2>档案内容</h2><p>{archives.length} 张素材卡片</p></div><IoFilterOutline /></div>
            {["全部内容", "工作经历", "项目经历", "教育经历", "成果证明"].map((item) => { const Icon = item === "全部内容" ? IoGridOutline : typeIcons[item as keyof typeof typeIcons]; const count = item === "全部内容" ? archives.length : archives.filter((archive) => archive.type === item).length; return <button className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} key={item}><Icon /><span>{item}</span><b>{count}</b></button>; })}
            <div className="archive-folder-heading"><span>颜色收藏</span></div>
            <button className={`archive-folder-filter ${filter === "unfiled" ? "active" : ""}`} type="button" onClick={() => setFilter("unfiled")}><i className="unfiled-folder-dot" /><span>无收藏夹</span><b>{archives.filter((archive) => !(folderAssignments[archiveKey(archive)] ?? []).length).length}</b></button>
            {archiveFolders.length ? archiveFolders.map((folder) => { const folderFilter = `folder:${folder.id}`; const count = archives.filter((archive) => (folderAssignments[archiveKey(archive)] ?? []).includes(folder.id)).length; return <button className={`archive-folder-filter ${filter === folderFilter ? "active" : ""}`} type="button" onClick={() => setFilter(folderFilter)} key={folder.id}><i style={{ background: folder.color }} /><span>{folder.name}</span><b>{count}</b></button>; }) : <p className="empty-folder-note">在卡片详情中选择颜色</p>}
            <div className="filter-tip"><IoSparklesOutline /><strong>让档案更有用</strong><p>优先补充有数字结果和明确角色边界的成果。</p></div>
          </aside>

          <section className="archive-library">
            <div className="archive-toolbar"><div><h2>{filterLabel}</h2><p>共 {filtered.length} 项 · 按最近更新排序</p></div><div className="view-switch"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="网格视图"><IoGridOutline /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="列表视图"><IoListOutline /></button></div></div>
            {filtered.length ? <div className={`archive-cards ${view === "list" ? "list" : ""}`}>{filtered.map((archive) => { const Icon = typeIcons[archive.type]; const confirmed = archive.facts.filter((fact) => fact.confirmed).length; const folders = archiveFolders.filter((item) => (folderAssignments[archiveKey(archive)] ?? []).includes(item.id)); return <button className={`archive-card ${selected.id === archive.id ? "selected" : ""}`} type="button" onClick={() => setSelectedId(archive.id)} key={archive.id}><div className="archive-card-head"><span><Icon /></span><em>{archive.type}</em>{folders.length > 0 && <small className="archive-folder-badge">{folders.map((folder) => <i style={{ background: folder.color }} title={folder.name} key={folder.id} />)}</small>}<IoEllipsisHorizontalOutline /></div><h3>{archive.title}</h3><p className="archive-subtitle">{archive.subtitle}</p><p className="archive-description">{archive.description}</p><div className="archive-tags">{archive.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div><footer><span><IoTimeOutline /> {archive.date}</span><b className={confirmed === archive.facts.length ? "complete" : ""}>{confirmed}/{archive.facts.length} 成果</b></footer></button>; })}</div> : <div className="profile-empty-state"><IoSparklesOutline /><h3>{filter.startsWith("folder:") ? "这个收藏夹还是空的" : filter === "unfiled" ? "没有未收藏的档案" : "还没有职业档案"}</h3><p>{filter.startsWith("folder:") ? "选择一张档案卡片，在详情中点选对应颜色。" : filter === "unfiled" ? "所有档案都已分类到至少一个颜色收藏夹。" : "手动添加一段经历，或粘贴现有简历让 AI 帮你整理。"}</p>{!filter.startsWith("folder:") && filter !== "unfiled" && <div className="profile-empty-actions"><button className="primary-button icon-text-button" type="button" onClick={() => setShowManualAdd(true)}><IoAddOutline /> 手动添加内容</button><button className="ghost-button icon-text-button" type="button" onClick={() => setShowAiImport(true)}><IoCloudUploadOutline /> AI 导入简历</button></div>}</div>}
          </section>

          {archives.length ? <aside className="archive-detail" ref={archiveDetailRef}>
            <div className="archive-detail-head"><span className="detail-type-icon">{(() => { const Icon = typeIcons[selected.type]; return <Icon />; })()}</span><div><small>{selected.type}</small><h2>{selected.title}</h2><p>{selected.subtitle}</p></div><button type="button" aria-label="更多操作"><IoEllipsisHorizontalOutline /></button></div>
            <section className="detail-section"><div className="detail-section-title"><h3>关键成果</h3><span>{selected.facts.filter((fact) => fact.confirmed).length}/{selected.facts.length} 已确认</span>{selected.facts.some((fact) => !fact.confirmed) && <button type="button" onClick={confirmAllFacts}><IoCheckmarkDoneOutline /> 一键确认</button>}</div><div className="fact-checks">{selected.facts.map((fact, index) => <button type="button" className={fact.confirmed ? "checked" : ""} onClick={() => toggleFact(index)} key={fact.text}><span>{fact.confirmed && <IoCheckmarkOutline />}</span><p>{fact.text}</p></button>)}</div></section>
            <section className="detail-section"><h3>能力标签</h3><div className="detail-skills">{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
            <div className="detail-actions"><button type="button" onClick={openArchiveEditor}>编辑档案</button><div className="archive-color-menu"><span>收藏夹</span><div role="group" aria-label="选择收藏夹，可多选">{folderColors.map((color) => { const folder = archiveFolders.find((item) => item.color.toLowerCase() === color.toLowerCase()); const selectedColor = Boolean(folder && (folderAssignments[archiveKey(selected)] ?? []).includes(folder.id)); return <button className={selectedColor ? "selected" : ""} type="button" onClick={() => assignSelectedColor(color)} aria-pressed={selectedColor} aria-label={`${selectedColor ? "取消" : "加入"}${folderColorNames[color]}收藏夹`} title={`${folderColorNames[color]}收藏夹`} key={color}><i style={{ background: color }} />{selectedColor && <IoCheckmarkOutline />}</button>; })}<button className="clear-folder-button" type="button" onClick={clearSelectedFolders} disabled={!(folderAssignments[archiveKey(selected)] ?? []).length}>无收藏夹</button></div></div></div>
          </aside> : <aside className="archive-onboarding">
            <span className="onboarding-kicker"><IoSparklesOutline /> 新用户引导</span>
            <h2>从真实信息开始建档</h2>
            <p>完成下面三步，岗位匹配和简历生成才会有可靠依据。</p>
            <div className="onboarding-steps">
              <button type="button" onClick={openPersonalInfo}><b>1</b><span><strong>完善个人信息</strong><small>姓名、联系方式与求职意向</small></span><IoChevronForwardOutline /></button>
              <button type="button" onClick={() => setShowManualAdd(true)}><b>2</b><span><strong>添加第一段经历</strong><small>工作、项目、教育或成果</small></span><IoChevronForwardOutline /></button>
              <button type="button" onClick={() => setShowAiImport(true)}><b>3</b><span><strong>批量导入已有简历</strong><small>交给 AI 拆分并等待你确认</small></span><IoChevronForwardOutline /></button>
            </div>
            <aside><IoShieldCheckmarkOutline /><p><strong>你的内容由你确认</strong><br />AI 只负责整理，不会把推测当作事实。</p></aside>
          </aside>}
        </div>
      </div>
    </section>
    {showManualAdd && <div className="modal-backdrop manual-archive-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeArchiveEditor(); }}><form className="manual-archive-modal" onSubmit={createManualArchive}>
      <header><div><span><IoAddOutline /> {editingArchiveId ? "编辑档案" : "手动录入"}</span><h2>{editingArchiveId ? "编辑档案内容" : "添加档案内容"}</h2><p>{editingArchiveId ? "修改当前经历、关键成果和能力标签，保存后会同步更新档案。" : "先记录真实经历，之后可以继续补充关键成果和能力标签。"}</p></div><button type="button" onClick={closeArchiveEditor} aria-label="关闭">×</button></header>
      <div className="manual-archive-body">
        <label><span>内容类型</span><select value={manualForm.type} onChange={(event) => setManualForm((current) => ({ ...current, type: event.target.value as Archive["type"] }))}>{Object.keys(typeIcons).map((type) => <option key={type}>{type}</option>)}</select></label>
        <label><span>标题 <em>必填</em></span><input required value={manualForm.title} onChange={(event) => setManualForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：用户增长产品经理" /></label>
        <label><span>公司 / 项目 / 学校</span><input value={manualForm.subtitle} onChange={(event) => setManualForm((current) => ({ ...current, subtitle: event.target.value }))} placeholder="填写组织或项目名称" /></label>
        <label className="date-range-field"><span>时间</span><div className="date-range-inputs"><input aria-label="开始月份" type="month" value={manualForm.startDate} onChange={(event) => setManualForm((current) => ({ ...current, startDate: event.target.value }))} /><em>至</em><input aria-label="结束月份" type="month" disabled={manualForm.current} value={manualForm.endDate} onChange={(event) => setManualForm((current) => ({ ...current, endDate: event.target.value }))} /><button className={manualForm.current ? "active" : ""} type="button" onClick={() => setManualForm((current) => ({ ...current, current: !current.current, endDate: !current.current ? "" : current.endDate }))}>至今</button></div></label>
        <label className="wide"><span>经历描述</span><textarea value={manualForm.description} onChange={(event) => setManualForm((current) => ({ ...current, description: event.target.value }))} placeholder="说明你负责什么、如何完成以及最终结果…" /></label>
        <label className="wide"><span>能力标签</span><input value={manualForm.skills} onChange={(event) => setManualForm((current) => ({ ...current, skills: event.target.value }))} placeholder="用逗号分隔，例如：用户研究，数据分析，项目管理" /></label>
        <div className="wide manual-results-field"><div className="manual-results-heading"><span>关键成果</span><small>一条成果只描述一个结果</small></div><div className="manual-result-list">{manualForm.facts.map((fact, index) => <div key={index}><input aria-label={`关键成果 ${index + 1}`} value={fact} onChange={(event) => setManualForm((current) => ({ ...current, facts: current.facts.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder="例如：推动转化率提升 12%" /><button type="button" aria-label={`删除关键成果 ${index + 1}`} onClick={() => setManualForm((current) => ({ ...current, facts: current.facts.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div>)}</div><button className="add-result-button" type="button" onClick={() => setManualForm((current) => ({ ...current, facts: [...current.facts, ""] }))}><IoAddOutline /> 添加一条成果</button></div>
      </div>
      <footer><button className="ghost-button" type="button" onClick={closeArchiveEditor}>取消</button><button className="primary-button" type="submit">{editingArchiveId ? "保存修改" : "保存到职业档案"}</button></footer>
    </form></div>}
    {showAiImport && <div className="modal-backdrop ai-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !aiImporting) setShowAiImport(false); }}><section className="ai-profile-modal" role="dialog" aria-modal="true" aria-labelledby="ai-profile-title"><header><div><span><IoSparklesOutline /> 双模型智能导入</span><h2 id="ai-profile-title">上传简历创建职业档案</h2><p>图片与 PDF 由 Qwen3-VL-Flash 阅读版面；粘贴文字由 DeepSeek 整理。两条路径都只提取已有事实。</p></div><button type="button" disabled={aiImporting} onClick={() => setShowAiImport(false)} aria-label="关闭">×</button></header><div className="ai-profile-body"><label className={`resume-file-drop ${resumeFile ? "selected" : ""}`}><IoCloudUploadOutline /><span>{resumeFile ? resumeFile.name : "选择 PDF 或简历图片"}</span><small>{resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(1)} MB · 将使用 Qwen3-VL-Flash` : "支持 PDF、JPG、PNG、WebP，最多 6 页 / 18MB"}</small><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={aiImporting} onChange={(event) => { setResumeFile(event.target.files?.[0] ?? null); setAiImportError(""); }} /></label><div className="ai-import-divider"><span>或粘贴文字</span></div><label><span>简历文本</span><textarea value={resumeText} disabled={Boolean(resumeFile) || aiImporting} onChange={(event) => setResumeText(event.target.value)} placeholder="粘贴工作经历、项目经历、教育背景、技能和成果…" /><small>{resumeText.length.toLocaleString()} / 30,000 字</small></label>{importProgress && <div className="ai-import-progress" role="status"><IoSparklesOutline /> {importProgress}</div>}{aiImportError && <div className="ai-profile-error"><IoWarningOutline /><span>{aiImportError}</span>{aiImportError.includes("设置") && <a href="/settings">前往设置</a>}</div>}<aside><IoShieldCheckmarkOutline /><p><strong>原文件不保存</strong><br />文件只在本次识别中短暂处理；系统保存结构化档案。模糊或无法确认的信息不会被猜测。</p></aside></div><footer>{resumeFile && <button className="ghost-button" type="button" disabled={aiImporting} onClick={() => setResumeFile(null)}>移除文件</button>}<button className="ghost-button" type="button" disabled={aiImporting} onClick={() => setShowAiImport(false)}>取消</button><button className="primary-button" type="button" disabled={aiImporting || (!resumeFile && resumeText.trim().length < 80)} onClick={() => void createProfileWithAi()}>{aiImporting ? "AI 正在读取…" : resumeFile ? "识别文件并创建档案" : "解析文字并创建档案"}</button></footer></section></div>}
    {notice && <div className="toast" role="status"><IoCheckmarkCircleOutline /> {notice}</div>}
  </main>;
}
