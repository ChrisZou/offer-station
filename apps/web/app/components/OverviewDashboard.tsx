"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { IoAddOutline, IoArchiveOutline, IoBusinessOutline, IoCalendarClearOutline, IoCheckmarkCircleOutline, IoChevronDownOutline, IoMailOpenOutline, IoPaperPlaneOutline, IoTrashOutline } from "react-icons/io5";
import { AppSidebar, AppTopbar, SyncStatus } from "./AppChrome";
import { CompanyLogo } from "./CompanyLogo";
import type { SavedJob } from "./SavedJobsWorkbench";
import { createDemoSchedules, isDemoMode, loadDemoJobs } from "../lib/demo-data";

type Schedule = { id: string; date: string; time: string; title: string; company: string; jobId?: string; jobTitle?: string; type: string; meta: string; place: string };
const scheduleStorageKey = "job-workbench.schedules.v1";
const emptyScheduleForm = { date: "", time: "", title: "", jobId: "", type: "面试", meta: "", place: "" };

function readSchedules(): Schedule[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(scheduleStorageKey) || "[]") as Schedule[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function scheduleDateTime(item: Schedule) {
  return new Date(`${item.date}T${item.time || "00:00"}`).getTime();
}

function displayScheduleDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function scheduleAssociation(item: Schedule) {
  if (item.jobTitle) return [item.company, item.jobTitle].filter(Boolean).join(" · ");
  return item.company || "个人安排";
}

function scheduleTone(type: string) {
  if (type === "面试") return "interview";
  if (type === "投递") return "application";
  if (type === "准备") return "preparation";
  return "neutral";
}

function progressFor(status: string) {
  if (/offer/i.test(status)) return 7;
  if (status.includes("面试")) return 5;
  if (status === "已投递") return 3;
  if (status === "已归档") return 8;
  return 1;
}

function nextStep(status: string) {
  if (/offer/i.test(status)) return "确认 Offer";
  if (status.includes("面试")) return "准备面试";
  if (status === "已投递") return "等待反馈";
  if (status === "已归档") return "已结束";
  return "完善并投递";
}

function displayTime(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function OverviewDashboard() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [query, setQuery] = useState("");
  const [activeScheduleId, setActiveScheduleId] = useState("");
  const [scheduleEditForm, setScheduleEditForm] = useState<Schedule | null>(null);
  const [scheduleRange, setScheduleRange] = useState("本周");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [scheduleJobPickerOpen, setScheduleJobPickerOpen] = useState(false);
  const [scheduleTypePickerOpen, setScheduleTypePickerOpen] = useState(false);
  const [jobFilter, setJobFilter] = useState("全部");
  const [syncError, setSyncError] = useState(false);
  const scheduleJobPickerRef = useRef<HTMLDivElement>(null);
  const scheduleTypePickerRef = useRef<HTMLDivElement>(null);

  const loadJobs = useCallback(async () => {
    if (isDemoMode()) {
      try {
        const incoming = await loadDemoJobs() as SavedJob[];
        setJobs(incoming);
        const saved = readSchedules().filter((item) => !item.jobId || incoming.some((job) => job.id === item.jobId));
        const next = saved.length ? saved : createDemoSchedules(incoming);
        if (!saved.length) window.localStorage.setItem(scheduleStorageKey, JSON.stringify(next));
        setSchedules(next.sort((a, b) => scheduleDateTime(a) - scheduleDateTime(b)));
        setSyncError(false);
      } catch { setSyncError(true); }
      return;
    }
    try {
      const response = await fetch("/api/jobs?limit=100", { cache: "no-store" });
      const data = await response.json() as { jobs?: SavedJob[] };
      if (!response.ok) throw new Error("sync failed");
      setJobs(data.jobs ?? []);
      setSyncError(false);
    } catch {
      setSyncError(true);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadJobs(), 0);
    const timer = window.setInterval(loadJobs, 3000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadJobs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSchedules().sort((a, b) => scheduleDateTime(a) - scheduleDateTime(b));
      setSchedules(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!scheduleJobPickerOpen && !scheduleTypePickerOpen) return;
    const closePicker = (event: MouseEvent) => {
      if (!scheduleJobPickerRef.current?.contains(event.target as Node)) setScheduleJobPickerOpen(false);
      if (!scheduleTypePickerRef.current?.contains(event.target as Node)) setScheduleTypePickerOpen(false);
    };
    const closePickerOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setScheduleJobPickerOpen(false);
        setScheduleTypePickerOpen(false);
      }
    };
    window.addEventListener("mousedown", closePicker);
    window.addEventListener("keydown", closePickerOnEscape);
    return () => {
      window.removeEventListener("mousedown", closePicker);
      window.removeEventListener("keydown", closePickerOnEscape);
    };
  }, [scheduleJobPickerOpen, scheduleTypePickerOpen]);

  const counts = useMemo(() => ({
    pending: jobs.filter((job) => job.status === "待判断" || job.status === "待投递" || job.status === "未投递").length,
    interviewing: jobs.filter((job) => job.status.includes("面试")).length,
    offers: jobs.filter((job) => job.status.toLowerCase().includes("offer")).length,
    archived: jobs.filter((job) => job.status === "已归档" || job.status === "已结束").length,
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery = !keyword || `${job.company} ${job.title} ${job.locationText}`.toLowerCase().includes(keyword);
      const matchesFilter = jobFilter === "全部" || (jobFilter === "进行中" ? job.status !== "已归档" : job.status.includes(jobFilter));
      return matchesQuery && matchesFilter;
    });
  }, [jobs, jobFilter, query]);

  const visibleSchedules = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + (scheduleRange === "本周" ? 7 : 30));
    const ranged = schedules.filter((item) => {
      const value = scheduleDateTime(item);
      return value >= now.getTime() && value < end.getTime();
    });
    return ranged.length ? ranged : schedules;
  }, [scheduleRange, schedules]);
  const selectedSchedule = schedules.find((item) => item.id === activeScheduleId) ?? null;
  const scheduleCounts = useMemo(() => ({
    interview: visibleSchedules.filter((item) => item.type === "面试").length,
    application: visibleSchedules.filter((item) => item.type === "投递").length,
    preparation: visibleSchedules.filter((item) => item.type === "准备").length,
  }), [visibleSchedules]);

  function saveSchedules(next: Schedule[]) {
    const sorted = [...next].sort((a, b) => scheduleDateTime(a) - scheduleDateTime(b));
    setSchedules(sorted);
    window.localStorage.setItem(scheduleStorageKey, JSON.stringify(sorted));
  }

  function openScheduleForm() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    setScheduleForm({ ...emptyScheduleForm, date: localDate, time: "09:00" });
    setScheduleJobPickerOpen(false);
    setScheduleTypePickerOpen(false);
    setShowScheduleForm(true);
  }

  function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const job = jobs.find((item) => item.id === scheduleForm.jobId);
    const created: Schedule = {
      ...scheduleForm,
      id: crypto.randomUUID(),
      title: scheduleForm.title.trim(),
      company: job?.company ?? "",
      jobTitle: job?.title ?? "",
      place: scheduleForm.place.trim(),
      meta: scheduleForm.meta.trim(),
    };
    saveSchedules([...schedules, created]);
    setActiveScheduleId(created.id);
    setScheduleForm(emptyScheduleForm);
    setShowScheduleForm(false);
  }

  function openScheduleDetail(item: Schedule) {
    setActiveScheduleId(item.id);
    setScheduleEditForm({ ...item });
  }

  function closeScheduleDetail() {
    setActiveScheduleId("");
    setScheduleEditForm(null);
  }

  function updateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSchedule || !scheduleEditForm) return;
    const job = jobs.find((item) => item.id === scheduleEditForm.jobId);
    const updated: Schedule = {
      ...scheduleEditForm,
      title: scheduleEditForm.title.trim(),
      company: job?.company ?? scheduleEditForm.company,
      jobTitle: job?.title ?? scheduleEditForm.jobTitle,
      place: scheduleEditForm.place.trim(),
      meta: scheduleEditForm.meta.trim(),
    };
    saveSchedules(schedules.map((item) => item.id === selectedSchedule.id ? updated : item));
    closeScheduleDetail();
  }

  function deleteSchedule() {
    if (!selectedSchedule || !window.confirm(`删除日程“${selectedSchedule.title}”？`)) return;
    const next = schedules.filter((item) => item.id !== selectedSchedule.id);
    saveSchedules(next);
    closeScheduleDetail();
  }

  return (
    <main className="app-shell">
      <AppSidebar active="overview" />

      <section className="workspace">
        <AppTopbar value={query} onChange={setQuery} status={<SyncStatus error={syncError} />} action={<a className="top-add icon-text-button" href="/jobs"><IoAddOutline /> 新增</a>} />

        <div className="content overview-content">
          <div className="page-heading overview-heading"><div><h1>我的求职进展</h1><p>跟踪每一次投递与面试，及时准备下一步</p></div><a className="primary-button button-link icon-text-button" href="/jobs"><IoAddOutline /> 记录投递</a></div>

          <section className="overview-metrics" aria-label="求职进展摘要">
            {[[IoPaperPlaneOutline, "待投递", counts.pending, jobs.length ? "来自插件与手动收藏" : "收藏岗位后自动统计", "mint"], [IoMailOpenOutline, "面试中", counts.interviewing, counts.interviewing ? "查看日程安排" : "暂无面试安排", "blue"], [IoCheckmarkCircleOutline, "Offer", counts.offers, counts.offers ? "持续跟进目标机会" : "暂无 Offer", "orange"], [IoArchiveOutline, "已归档", counts.archived, `全部岗位 ${jobs.length}`, "purple"]].map(([Icon, label, value, hint, tone]) => <article className="overview-metric" key={String(label)}><span className={`metric-icon ${tone}`}>{typeof Icon === "function" && <Icon />}</span><div><span>{label as string}</span><strong>{value as number}</strong><small>{hint as string}</small></div></article>)}
          </section>

          <section className={`dashboard-grid ${schedules.length ? "" : "empty-dashboard"}`} id="calendar">
            {!schedules.length && <div className="schedule-empty"><IoCalendarClearOutline /><h2>还没有求职日程</h2><p>添加投递、面试或准备安排，集中管理接下来的求职行动。</p><button className="outline-teal" type="button" onClick={openScheduleForm}>＋ 新增日程</button></div>}
            <article className="dashboard-panel timeline-panel">
              <div className="panel-title-row"><div><h2>近期日程</h2><p>{scheduleRange === "本周" ? "接下来 7 天" : "接下来 30 天"} · {visibleSchedules.length} 项安排</p></div><div className="calendar-controls"><div className="segmented">{["本周", "本月"].map((item) => <button className={scheduleRange === item ? "active" : ""} onClick={() => setScheduleRange(item)} key={item} type="button">{item}</button>)}</div><button className="outline-teal" type="button" onClick={openScheduleForm}>＋ 新增日程</button></div></div>
              <div className="timeline" aria-label="求职日程时间线" style={{ "--timeline-count":Math.max(visibleSchedules.length,1), gridTemplateColumns:`repeat(${Math.max(visibleSchedules.length,1)},minmax(180px,1fr))` } as CSSProperties}><div className="timeline-line" />{visibleSchedules.map((item) => <button key={item.id} type="button" className={`timeline-event ${scheduleTone(item.type)} ${selectedSchedule?.id === item.id ? "active" : ""}`} onClick={() => openScheduleDetail(item)} aria-label={`查看并编辑日程：${item.title}`}><span className="event-date">{displayScheduleDate(item.date)}<small>{item.time}</small></span><i /><strong>{item.title}</strong><small>{scheduleAssociation(item)}</small><em>{item.type}</em></button>)}</div>
              <div className="week-summary"><span><i className="dot teal" /> 面试 {scheduleCounts.interview}</span><span><i className="dot blue" /> 投递 {scheduleCounts.application}</span><span><i className="dot orange" /> 准备 {scheduleCounts.preparation}</span><b>共 <strong>{visibleSchedules.length}</strong> 项安排</b></div>
            </article>

          </section>

          <section className="dashboard-panel overview-jobs" id="jobs-overview">
            <div className="jobs-toolbar"><div><h2>全部岗位</h2><p>插件收藏与工作台实时联动</p></div><div className="table-actions"><button type="button">筛选 ≡</button><button type="button">按更新时间排序 ↕</button></div></div>
            <div className="job-tabs">{["全部", "进行中", "已投递", "面试", "Offer", "已归档"].map((filter) => <button type="button" onClick={() => setJobFilter(filter)} className={jobFilter === filter ? "active" : ""} key={filter}>{filter}<span>{filter === "全部" ? jobs.length : jobs.filter((job) => filter === "进行中" ? job.status !== "已归档" : job.status.includes(filter)).length}</span></button>)}</div>
            <div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>公司 / 职位</th><th>当前进度</th><th>下一步</th><th>状态</th><th>待办</th><th>更新时间</th><th /></tr></thead><tbody>{filteredJobs.length ? filteredJobs.map((job) => { const progress = progressFor(job.status); return <tr key={job.id}><td><div className="company-cell"><span className="company-logo"><CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} decorative /></span><div><strong>{job.company}</strong><small>{job.title} · {job.locationText || "地点待补充"}</small></div></div></td><td><div className="progress-dots">{Array.from({ length: 8 }, (_, index) => <i className={index < progress ? "done" : ""} key={index} />)}</div></td><td>{nextStep(job.status)}</td><td><span className={`table-status status-${progress}`}>{job.status}</span></td><td>{progress < 3 ? "完善材料" : progress < 6 ? "跟进反馈" : "确认结果"}</td><td>{displayTime(job.updatedAt)}</td><td><a href="/jobs" aria-label={`查看${job.title}`}>›</a></td></tr>; }) : <tr><td className="overview-empty" colSpan={7}>{query ? "没有找到匹配岗位" : <>还没有岗位，<a href="/jobs">前往岗位库收藏第一个职位</a></>}</td></tr>}</tbody></table></div>
          </section>
        </div>
      </section>
      {selectedSchedule && scheduleEditForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeScheduleDetail(); }}><section className="modal schedule-modal schedule-edit-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-detail-title"><div className="modal-head"><div><p className="eyebrow">{displayScheduleDate(selectedSchedule.date)} {selectedSchedule.time}</p><h2 id="schedule-detail-title">日程详情与编辑</h2></div><div className="schedule-modal-head-actions"><button className="schedule-delete-button" type="button" onClick={deleteSchedule} aria-label="删除日程"><IoTrashOutline /></button><button type="button" className="icon-button" onClick={closeScheduleDetail} aria-label="关闭">×</button></div></div><form className="job-form" onSubmit={updateSchedule}><label>日程标题<input required value={scheduleEditForm.title} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, title:event.target.value })} /></label><div className="form-grid"><label>日期<input required type="date" value={scheduleEditForm.date} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, date:event.target.value })} /></label><label>时间<input required type="time" value={scheduleEditForm.time} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, time:event.target.value })} /></label><label>类型<select value={scheduleEditForm.type} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, type:event.target.value })}>{["面试","投递","准备","笔试","其他"].map((type)=><option value={type} key={type}>{type}</option>)}</select></label><label>关联岗位<select value={scheduleEditForm.jobId || ""} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, jobId:event.target.value })}><option value="">不关联岗位</option>{jobs.map((job)=><option value={job.id} key={job.id}>{job.company} · {job.title}</option>)}</select></label></div><label>地点或会议链接<input value={scheduleEditForm.place} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, place:event.target.value })} placeholder="可选" /></label><label>备注<textarea rows={4} value={scheduleEditForm.meta} onChange={(event) => setScheduleEditForm({ ...scheduleEditForm, meta:event.target.value })} placeholder="需要准备的材料或提醒…" /></label><div className="modal-actions schedule-edit-actions">{selectedSchedule.type === "面试" && <button className="ghost-button" type="button" onClick={() => window.location.assign("/interviews")}>打开面试准备</button>}<span /><button type="button" className="ghost-button" onClick={closeScheduleDetail}>取消</button><button type="submit" className="primary-button">保存修改</button></div></form></section></div>}
      {showScheduleForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowScheduleForm(false); }}><section className="modal schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title"><div className="modal-head"><div><p className="eyebrow">求职安排</p><h2 id="schedule-modal-title">新增日程</h2></div><button type="button" className="icon-button" onClick={() => setShowScheduleForm(false)} aria-label="关闭">×</button></div><form className="job-form" onSubmit={createSchedule}><label>日程标题<input required value={scheduleForm.title} onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })} placeholder="例如：字节跳动一面" /></label><div className="form-grid"><label>日期<input required type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} /></label><label>时间<input required type="time" value={scheduleForm.time} onChange={(event) => setScheduleForm({ ...scheduleForm, time: event.target.value })} /></label><label>类型<div className={`job-picker ${scheduleTypePickerOpen ? "open" : ""}`} ref={scheduleTypePickerRef}><button className="job-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded={scheduleTypePickerOpen} onClick={() => setScheduleTypePickerOpen((open) => !open)}><span className="job-picker-icon"><IoCalendarClearOutline /></span><span className="job-picker-value"><strong>{scheduleForm.type}</strong><small>日程类型</small></span><IoChevronDownOutline className="job-picker-chevron" /></button>{scheduleTypePickerOpen && <div className="job-picker-menu schedule-type-picker-menu" role="listbox" aria-label="日程类型">{["面试", "投递", "准备", "笔试", "其他"].map((type) => <button type="button" role="option" aria-selected={scheduleForm.type === type} className={scheduleForm.type === type ? "selected" : ""} onClick={() => { setScheduleForm({ ...scheduleForm, type }); setScheduleTypePickerOpen(false); }} key={type}><span><strong>{type}</strong><small>日程类型</small></span>{scheduleForm.type === type && <IoCheckmarkCircleOutline className="job-picker-check" />}</button>)}</div>}</div></label><label className="schedule-job-field">关联岗位（可选）<div className={`job-picker ${scheduleJobPickerOpen ? "open" : ""}`} ref={scheduleJobPickerRef}><button className="job-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded={scheduleJobPickerOpen} onClick={() => setScheduleJobPickerOpen((open) => !open)}><span className="job-picker-icon"><IoBusinessOutline /></span><span className="job-picker-value"><strong title={jobs.find((job) => job.id === scheduleForm.jobId)?.title || "不关联岗位"}>{jobs.find((job) => job.id === scheduleForm.jobId)?.title || "不关联岗位"}</strong><small>{scheduleForm.jobId ? jobs.find((job) => job.id === scheduleForm.jobId)?.company : "个人安排"}</small></span><IoChevronDownOutline className="job-picker-chevron" /></button>{scheduleJobPickerOpen && <div className="job-picker-menu" role="listbox" aria-label="关联岗位"><button type="button" role="option" aria-selected={!scheduleForm.jobId} className={!scheduleForm.jobId ? "selected" : ""} onClick={() => { setScheduleForm({ ...scheduleForm, jobId: "" }); setScheduleJobPickerOpen(false); }}><span className="job-picker-option-icon"><IoCalendarClearOutline /></span><span><strong>不关联岗位</strong><small>个人安排</small></span>{!scheduleForm.jobId && <IoCheckmarkCircleOutline className="job-picker-check" />}</button>{jobs.map((job) => <button type="button" role="option" aria-selected={scheduleForm.jobId === job.id} className={scheduleForm.jobId === job.id ? "selected" : ""} onClick={() => { setScheduleForm({ ...scheduleForm, jobId: job.id }); setScheduleJobPickerOpen(false); }} key={job.id}><span className="job-picker-option-icon"><IoBusinessOutline /></span><span><strong title={job.title}>{job.title}</strong><small title={job.company}>{job.company}</small></span>{scheduleForm.jobId === job.id && <IoCheckmarkCircleOutline className="job-picker-check" />}</button>)}</div>}</div></label></div><label>地点或会议链接<input value={scheduleForm.place} onChange={(event) => setScheduleForm({ ...scheduleForm, place: event.target.value })} placeholder="可选" /></label><label>备注<textarea rows={3} value={scheduleForm.meta} onChange={(event) => setScheduleForm({ ...scheduleForm, meta: event.target.value })} placeholder="需要准备的材料或提醒…" /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setShowScheduleForm(false)}>取消</button><button type="submit" className="primary-button">保存日程</button></div></form></section></div>}
    </main>
  );
}
