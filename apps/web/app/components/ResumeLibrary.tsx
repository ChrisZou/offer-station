"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  IoAddOutline, IoBriefcaseOutline, IoCheckmarkCircleOutline, IoCreateOutline,
  IoDocumentTextOutline, IoFolderOpenOutline, IoTimeOutline, IoTrashOutline, IoWarningOutline,
} from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import { GENERATED_RESUME_STORAGE, type GeneratedResume } from "../lib/ai-client";
import { getResumeTemplate, normalizeResumeTemplate } from "../lib/resume-methodology";
import { demoResume, isDemoMode, loadDemoJobs } from "../lib/demo-data";

type ResumeItem = {
  id: string; title: string; company: string; role: string; location: string;
  version: string; status: "已完成" | "草稿"; match: number; updated: string;
  accent: string;
};

export default function ResumeLibrary() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部简历");
  const [pendingDelete, setPendingDelete] = useState<ResumeItem | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => resumes.filter((resume) => {
    const matchesFilter = filter === "全部简历" || resume.status === filter || (filter === "基础版本" && resume.id === "base");
    const keyword = query.trim().toLowerCase();
    return matchesFilter && (!keyword || `${resume.title}${resume.company}${resume.role}`.toLowerCase().includes(keyword));
  }), [filter, query, resumes]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        if (isDemoMode()) {
          const jobs = await loadDemoJobs();
          const first = jobs[0];
          const second = jobs[1];
          setResumes([
            ...(first ? [{ id:demoResume.createdAt,title:`小u｜${first.company} ${first.title}岗位简历`,company:first.company,role:first.title,location:first.locationText || "地点未填写",version:"Habaneraa 单页中文",status:"已完成" as const,match:89,updated:"今天",accent:"mint" }] : []),
            ...(second ? [{ id:"demo-resume-2",title:`小u｜${second.company} ${second.title}岗位简历`,company:second.company,role:second.title,location:second.locationText || "地点未填写",version:"现代专业版",status:"草稿" as const,match:84,updated:"昨天",accent:"blue" }] : []),
            { id:"base",title:"小u｜AI 产品经理通用简历",company:"通用版本",role:"AI 产品经理",location:"杭州",version:"通用基础版",status:"已完成",match:0,updated:"8月20日",accent:"purple" },
          ]);
          return;
        }
        const value = window.localStorage.getItem(GENERATED_RESUME_STORAGE);
        if (!value) return;
        const draft = JSON.parse(value) as GeneratedResume;
        setResumes([{
          id: draft.createdAt,
          title: draft.title,
          company: draft.job.company,
          role: draft.job.title,
          location: draft.personalInfo?.city || "地点未填写",
          version: getResumeTemplate(draft.template).name,
          status: "草稿",
          match: draft.match || 0,
          updated: new Date(draft.updatedAt || draft.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
          accent: normalizeResumeTemplate(draft.template) === "resume-ng" ? "blue" : normalizeResumeTemplate(draft.template) === "deedy-cn" || normalizeResumeTemplate(draft.template) === "liweitianux" ? "purple" : normalizeResumeTemplate(draft.template) === "awesome-cv" ? "orange" : "mint",
        }]);
      } catch { /* 忽略无法读取的旧草稿 */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function deleteResume() {
    if (!pendingDelete) return;
    try {
      const stored = window.localStorage.getItem(GENERATED_RESUME_STORAGE);
      const draft = stored ? JSON.parse(stored) as GeneratedResume : null;
      if (!draft || draft.createdAt === pendingDelete.id) {
        window.localStorage.removeItem(GENERATED_RESUME_STORAGE);
        window.localStorage.removeItem(`${GENERATED_RESUME_STORAGE}.html`);
      }
    } catch {
      window.localStorage.removeItem(GENERATED_RESUME_STORAGE);
      window.localStorage.removeItem(`${GENERATED_RESUME_STORAGE}.html`);
    }
    setResumes((current) => current.filter((resume) => resume.id !== pendingDelete.id));
    setPendingDelete(null);
    notify("简历已删除");
  }

  return <main className="app-shell resume-library-shell">
    <AppSidebar active="resumes" />
    <section className="workspace">
      <AppTopbar value={query} onChange={setQuery} placeholder="搜索简历、岗位或公司…" />
      <div className="resume-library-page">
        <header className="resume-library-heading"><div><p className="eyebrow">岗位专属版本</p><h1>简历管理</h1><p>为不同岗位维护独立简历，随时编辑并保持最新。</p></div><Link className="primary-button button-link icon-text-button" href="/resumes/new"><IoAddOutline /> 创建简历</Link></header>

        <section className="resume-library-metrics">
          <article><span className="resume-stat-icon mint"><IoDocumentTextOutline /></span><div><small>全部简历</small><strong>{resumes.length}</strong><p>{resumes.length ? "含已保存的本地草稿" : "尚未创建简历"}</p></div></article>
          <article><span className="resume-stat-icon blue"><IoBriefcaseOutline /></span><div><small>岗位专属</small><strong>{resumes.filter((item) => item.id !== "base").length}</strong><p>{resumes.length ? "按目标岗位生成" : "收藏岗位后可创建"}</p></div></article>
          <article><span className="resume-stat-icon orange"><IoCheckmarkCircleOutline /></span><div><small>已完成</small><strong>{resumes.filter((item) => item.status === "已完成").length}</strong><p>{resumes.some((item) => item.status === "已完成") ? "可用于展示或投递" : "暂无可投递版本"}</p></div></article>
        </section>

        <section className="resume-library-panel">
          <div className="resume-library-toolbar"><div className="resume-library-tabs">{["全部简历", "已完成", "草稿", "基础版本"].map((item) => <button className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} key={item}>{item}<span>{item === "全部简历" ? resumes.length : item === "基础版本" ? resumes.filter((resume) => resume.id === "base").length : resumes.filter((resume) => resume.status === item).length}</span></button>)}</div><button className="sort-button" type="button"><IoTimeOutline /> 最近更新</button></div>
          {filtered.length ? <div className="resume-grid">{filtered.map((resume) => <article className="resume-library-card" key={resume.id}>
            <span className={`resume-card-icon ${resume.accent}`}><IoDocumentTextOutline /></span>
            <div className="resume-card-body"><div className="resume-card-title"><div><div className="resume-card-name"><h2>{resume.title}</h2><span className={`resume-state ${resume.status === "草稿" ? "draft" : ""}`}>{resume.status}</span></div><p>{resume.company} · {resume.role}</p></div></div><div className="resume-card-meta"><span>{resume.version}</span><span>{resume.location}</span><span>更新于 {resume.updated}</span></div></div>
            <div className="resume-card-actions">{resume.match > 0 && <div className="resume-card-match"><strong>{resume.match}%</strong><small>岗位匹配</small></div>}<Link href="/resumes/frontend-v3/edit"><IoCreateOutline /> 编辑</Link><button className="delete" type="button" aria-label={`删除${resume.title}`} onClick={() => setPendingDelete(resume)}><IoTrashOutline /> 删除</button></div>
          </article>)}</div> : <div className="resume-empty"><IoFolderOpenOutline /><h2>{query || filter !== "全部简历" ? "没有匹配的简历" : "还没有简历"}</h2><p>{query || filter !== "全部简历" ? "换个关键词或筛选条件试试。" : "先完善职业档案，再根据目标岗位创建第一份专属简历。"}</p>{!query && filter === "全部简历" && <Link className="primary-button button-link" href="/profile">先创建职业档案</Link>}</div>}
        </section>
      </div>
    </section>

    {pendingDelete && <div className="modal-backdrop delete-resume-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null); }}><section className="delete-resume-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-resume-title" aria-describedby="delete-resume-description"><span><IoWarningOutline /></span><h2 id="delete-resume-title">删除这份简历？</h2><p id="delete-resume-description">「{pendingDelete.title}」及其本地编辑草稿会被永久删除，此操作无法撤销。</p><div><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button className="danger" type="button" onClick={deleteResume}><IoTrashOutline /> 确认删除</button></div></section></div>}
    {notice && <div className="toast" role="status"><IoCheckmarkCircleOutline /> {notice}</div>}
  </main>;
}
