"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IoAddOutline, IoAlertCircleOutline, IoArrowBackOutline, IoBriefcaseOutline, IoChevronForwardOutline, IoCloseOutline, IoDownloadOutline, IoLocationOutline, IoSearchOutline, IoSparklesOutline } from "react-icons/io5";
import { AppSidebar } from "./AppChrome";
import { callAi, GENERATED_RESUME_STORAGE, getAiProfile, type GeneratedResume, type InterviewPack, type InterviewQuestionCategory } from "../lib/ai-client";
import { isDemoMode, loadDemoJobs } from "../lib/demo-data";

type InterviewJob = { id: string; title: string; company: string; salaryText?: string; locationText?: string; experienceText?: string; educationText?: string; jobDescription?: string };
type SavedInterviewState = { pack: InterviewPack; answers: Record<string, string>; notes?: Record<string, string> };
const storageKey = "job-workbench.interview-prep.v1";
const questionCategories: InterviewQuestionCategory[] = ["通用与动机", "岗位专业", "简历深挖", "行为与场景", "硬性风险"];

function readAllSaved() {
  try { return JSON.parse(window.localStorage.getItem(storageKey) || "{}") as Record<string, SavedInterviewState>; } catch { return {}; }
}
function writeSaved(jobId: string, value: SavedInterviewState) {
  const all = readAllSaved(); all[jobId] = value; window.localStorage.setItem(storageKey, JSON.stringify(all));
}
function categoryLabel(category: InterviewQuestionCategory) {
  return category === "通用与动机" ? "动机" : category === "岗位专业" ? "专业" : category === "简历深挖" ? "经历" : category === "行为与场景" ? "场景" : "风险";
}

export default function InterviewPrep() {
  const [jobs, setJobs] = useState<InterviewJob[]>([]);
  const [savedStates, setSavedStates] = useState<Record<string, SavedInterviewState>>(() => typeof window === "undefined" ? {} : readAllSaved());
  const [selectedJobId, setSelectedJobId] = useState("");
  const [view, setView] = useState<"library" | "detail">("library");
  const [query, setQuery] = useState("");
  const [jobsLoading, setJobsLoading] = useState(true);
  const [pack, setPack] = useState<InterviewPack | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [moreCategories, setMoreCategories] = useState<InterviewQuestionCategory[]>(["岗位专业", "简历深挖"]);
  const [moreCount, setMoreCount] = useState(5);
  const [moreFocus, setMoreFocus] = useState("");
  const [generatingFollowUp, setGeneratingFollowUp] = useState("");

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const currentQuestion = pack?.questions.find((question) => question.id === activeQuestionId) ?? pack?.questions[0] ?? null;
  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => !needle || `${job.title} ${job.company} ${job.locationText || ""}`.toLowerCase().includes(needle));
  }, [jobs, query]);

  useEffect(() => {
    const loadJobs = async () => {
      setJobsLoading(true);
      try {
        if (isDemoMode()) {
          const incoming = await loadDemoJobs() as InterviewJob[];
          const requestedJobId = new URLSearchParams(window.location.search).get("job") || "";
          setJobs(incoming);
          if (incoming.some((job) => job.id === requestedJobId)) { setSelectedJobId(requestedJobId); setView("detail"); }
          return;
        }
        const response = await fetch("/api/jobs?limit=100", { cache: "no-store" });
        const data = await response.json() as { jobs?: InterviewJob[]; error?: string };
        if (!response.ok) throw new Error(data.error || "岗位读取失败");
        const incoming = data.jobs ?? [];
        const requestedJobId = new URLSearchParams(window.location.search).get("job") || "";
        setJobs(incoming);
        if (incoming.some((job) => job.id === requestedJobId)) { setSelectedJobId(requestedJobId); setView("detail"); }
      } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "岗位读取失败"); } finally { setJobsLoading(false); }
    };
    void loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    const timer = window.setTimeout(() => {
      const saved = readAllSaved()[selectedJobId];
      setPack(saved?.pack ?? null); setNotes(saved?.notes ?? {}); setActiveQuestionId(saved?.pack.questions[0]?.id ?? ""); setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedJobId]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function persist(nextNotes = notes, nextPack = pack) {
    if (selectedJobId && nextPack) {
      const nextState = { pack: nextPack, answers: {}, notes: nextNotes };
      writeSaved(selectedJobId, nextState);
      setSavedStates((current) => ({ ...current, [selectedJobId]: nextState }));
    }
  }
  function openJob(jobId: string) { setSelectedJobId(jobId); setView("detail"); }
  function matchedResume(jobId: string): GeneratedResume | null {
    try {
      const value = window.localStorage.getItem(GENERATED_RESUME_STORAGE);
      if (!value) return null;
      const resume = JSON.parse(value) as GeneratedResume;
      return resume.job?.id === jobId ? resume : null;
    } catch { return null; }
  }
  function resumeFacts(resume: GeneratedResume) {
    // 只把结构化内容交给 AI,排除 typstSource/design 等排版字段,避免占用生成预算。
    const { title, targetRole, headline, summary, skills, experiences, personalInfo } = resume;
    return { title, targetRole, headline, summary, skills, experiences, personalInfo };
  }
  async function generatePack() {
    if (!selectedJob) return;
    if (pack && !window.confirm("重新生成会替换当前问题、回答和备忘录。继续吗？")) return;
    const profile = getAiProfile();
    if (!profile) { setError("请先创建职业档案，AI 才能结合真实经历生成面试问题"); return; }
    setGenerating(true); setError("");
    try {
      const resume = matchedResume(selectedJob.id);
      const result = await callAi<InterviewPack>("/api/ai/interview-prep", { job: selectedJob, profile, ...(resume ? { resume: resumeFacts(resume) } : {}) });
      const nextNotes = Object.fromEntries(result.questions.map((question) => [question.id, ""]));
      setPack(result); setNotes(nextNotes); setActiveQuestionId(result.questions[0]?.id ?? "");
      const nextState = { pack: result, answers: {}, notes: nextNotes };
      writeSaved(selectedJob.id, nextState); setSavedStates((current) => ({ ...current, [selectedJob.id]: nextState })); setNotice(resume ? "题单已生成（已结合岗位定制简历）" : "题单已生成");
    } catch (generateError) { setError(generateError instanceof Error ? generateError.message : "面试问题生成失败"); } finally { setGenerating(false); }
  }
  async function generateMoreQuestions() {
    if (!selectedJob || !pack || !moreCategories.length) return;
    const profile = getAiProfile();
    if (!profile) { setError("请先创建职业档案，AI 才能结合真实经历生成面试问题"); return; }
    setGenerating(true); setError("");
    try {
      const resume = matchedResume(selectedJob.id);
      const result = await callAi<InterviewPack>("/api/ai/interview-prep", {
        job: selectedJob,
        profile,
        ...(resume ? { resume: resumeFacts(resume) } : {}),
        options: {
          categories: moreCategories,
          count: moreCount,
          focus: moreFocus.trim(),
          existingQuestions: pack.questions.map((question) => question.question),
        },
      });
      const existing = new Set(pack.questions.map((question) => question.question.trim().toLowerCase()));
      const added = result.questions
        .filter((question) => !existing.has(question.question.trim().toLowerCase()))
        .map((question) => ({ ...question, id: `q-more-${crypto.randomUUID()}` }));
      if (!added.length) throw new Error("这次生成的问题与已有题目重复，请换一个关注方向再试");
      const nextPack = { ...pack, questions: [...pack.questions, ...added], createdAt: result.createdAt };
      const nextNotes = { ...notes, ...Object.fromEntries(added.map((question) => [question.id, ""])) };
      setPack(nextPack); setNotes(nextNotes); setActiveQuestionId(added[0].id); persist(nextNotes, nextPack);
      setShowMoreOptions(false); setMoreFocus(""); setNotice(`已增加 ${added.length} 个问题`);
    } catch (generateError) { setError(generateError instanceof Error ? generateError.message : "生成更多问题失败"); } finally { setGenerating(false); }
  }
  async function addFollowUpQuestion(followUp: string) {
    if (!selectedJob || !pack || !currentQuestion || generatingFollowUp) return;
    const normalized = followUp.trim().toLowerCase();
    const existingQuestion = pack.questions.find((question) => question.question.trim().toLowerCase() === normalized);
    if (existingQuestion) {
      setActiveQuestionId(existingQuestion.id);
      setNotice("该追问已在问题集中");
      return;
    }
    const profile = getAiProfile();
    if (!profile) { setError("请先创建职业档案，AI 才能结合真实经历生成回答"); return; }
    setGeneratingFollowUp(followUp); setError("");
    try {
      const resume = matchedResume(selectedJob.id);
      const result = await callAi<InterviewPack>("/api/ai/interview-prep", {
        job: selectedJob,
        profile,
        ...(resume ? { resume: resumeFacts(resume) } : {}),
        options: {
          categories: [currentQuestion.category],
          count: 1,
          requestedQuestions: [followUp],
          existingQuestions: pack.questions.map((question) => question.question),
        },
      });
      const generated = result.questions[0];
      if (!generated) throw new Error("AI 未返回追问解析");
      const added = { ...generated, question: followUp, id: `q-follow-${crypto.randomUUID()}` };
      const nextPack = { ...pack, questions: [...pack.questions, added], createdAt: result.createdAt };
      const nextNotes = { ...notes, [added.id]: "" };
      setPack(nextPack); setNotes(nextNotes); setActiveQuestionId(added.id); persist(nextNotes, nextPack);
      setNotice("追问已加入问题集并生成回答");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "追问回答生成失败");
    } finally { setGeneratingFollowUp(""); }
  }
  function toggleMoreCategory(category: InterviewQuestionCategory) {
    setMoreCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }
  function exportQuestionList() {
    if (!selectedJob || !pack) return;
    const content = [
      `${selectedJob.company}｜${selectedJob.title} 面试问题单`,
      `导出时间：${new Date().toLocaleString("zh-CN")}`,
      "",
      ...pack.questions.flatMap((question, index) => [
        `问题 ${index + 1}：${question.question}`,
        `题型：${question.category}`,
        `AI 建议：${question.suggestedAnswer || question.answerFramework.map((step) => `${step.title}：${step.guidance}`).join("；")}`,
        `备忘录：${notes[question.id]?.trim() || "未填写"}`,
        question.followUps.length ? `可能追问：${question.followUps.join("；")}` : "可能追问：无",
        "",
      ]),
    ].join("\n");
    const blob = new Blob([`\uFEFF${content}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedJob.company}-${selectedJob.title}-面试问题单.txt`.replace(/[\\/:*?"<>|]/g, "-");
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("问题单已导出");
  }
  function updateNote(value: string) { if (!currentQuestion) return; const next = { ...notes, [currentQuestion.id]: value }; setNotes(next); persist(next); }

  return <main className="app-shell interview-shell"><AppSidebar active="interview" /><section className="interview-workspace">
    {view === "library" ? <>
      <header className="interview-library-head"><div><p className="interview-kicker">面试准备</p><h1>选择要准备的岗位</h1><p>从岗位库进入，将问题、AI 解析、回答和你的备忘录集中在同一处。</p></div><label className="interview-search"><IoSearchOutline /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索岗位或公司" aria-label="搜索面试准备岗位" /></label></header>
      {error && <ErrorMessage error={error} />}
      {!jobsLoading && !jobs.length ? <EmptyJobs /> : <section className="interview-job-library"><div className="interview-library-meta"><strong>岗位库</strong><span>{jobsLoading ? "正在读取…" : `${filteredJobs.length} 个岗位`}</span></div><div className="interview-job-cards">{filteredJobs.map((job) => {
        const saved = savedStates[job.id];
        return <button className="interview-job-card" type="button" key={job.id} onClick={() => openJob(job.id)}><span className="interview-job-card-icon"><IoBriefcaseOutline /></span><span className="interview-job-card-main"><strong>{job.title}</strong><span>{job.company}</span><small>{job.locationText && <><IoLocationOutline />{job.locationText}</>}{job.salaryText && <em>{job.salaryText}</em>}</small></span><span className={`interview-job-card-state ${saved?.pack ? "ready" : ""}`}>{saved?.pack ? `${saved.pack.questions.length} 个问题` : "未生成题单"}</span><IoChevronForwardOutline className="interview-job-card-arrow" /></button>;
      })}</div>{!jobsLoading && !filteredJobs.length && <p className="interview-no-results">没有找到匹配的岗位。</p>}</section>}
    </> : <>
      <header className="interview-detail-head"><button className="interview-back" type="button" onClick={() => setView("library")}><IoArrowBackOutline />所有岗位</button><div className="interview-detail-job"><span><IoBriefcaseOutline /></span><div><p>{selectedJob?.company}</p><h1>{selectedJob?.title}</h1></div></div><div className="interview-detail-actions"><Link className="interview-secondary-action" href={`/reviews?job=${encodeURIComponent(selectedJobId)}`}>面试结束，去复盘</Link>{pack && <><button className="interview-secondary-action" type="button" onClick={() => setShowMoreOptions((current) => !current)}><IoAddOutline />生成更多问题</button><button className="interview-secondary-action" type="button" onClick={exportQuestionList}><IoDownloadOutline />导出问题单</button></>}<button className="interview-generate" type="button" disabled={!selectedJob || generating} onClick={() => void generatePack()}><IoSparklesOutline />{generating ? "正在生成…" : pack ? "重新生成题单" : "生成题单"}</button></div></header>
      {error && <ErrorMessage error={error} />}
      {pack && showMoreOptions && <section className="interview-more-options"><header><div><h2>生成更多问题</h2><p>选择这次想重点准备的题型，也可以补充具体方向。</p></div><button type="button" aria-label="关闭" onClick={() => setShowMoreOptions(false)}><IoCloseOutline /></button></header><div className="interview-more-fields"><fieldset><legend>题型（可多选）</legend><div>{questionCategories.map((category) => <button className={moreCategories.includes(category) ? "active" : ""} type="button" key={category} onClick={() => toggleMoreCategory(category)}>{category}</button>)}</div></fieldset><label><span>问题数量</span><select value={moreCount} onChange={(event) => setMoreCount(Number(event.target.value))}>{[3, 5, 8].map((count) => <option value={count} key={count}>{count} 个</option>)}</select></label><label className="interview-more-focus"><span>特别想准备什么（可选）</span><input value={moreFocus} onChange={(event) => setMoreFocus(event.target.value)} placeholder="例如：AI 产品商业化、项目失败复盘、跨部门协作" /></label></div><footer><span>新问题会追加到当前题单，不会覆盖已有问题和备忘录。</span><button className="primary-button" type="button" disabled={generating || !moreCategories.length} onClick={() => void generateMoreQuestions()}>{generating ? "正在生成…" : `生成 ${moreCount} 个问题`}</button></footer></section>}
      {!pack ? <section className="interview-first-use"><IoSparklesOutline /><h2>从一组真实问题开始准备</h2><p>AI 会结合岗位、职业档案{selectedJob && matchedResume(selectedJob.id) ? "和你针对该岗位的定制简历" : ""}生成问题。生成后，所有准备内容都会在这个页面完成。</p>{selectedJob && matchedResume(selectedJob.id) ? <p className="interview-resume-note">✓ 已找到该岗位的定制简历，生成时会结合其中的项目与成果。</p> : <p className="interview-resume-note">未找到该岗位的定制简历，将仅基于职业档案生成。可先去「简历管理」生成。</p>}<button className="primary-button" type="button" disabled={generating} onClick={() => void generatePack()}>{generating ? "正在生成…" : "生成面试题单"}</button></section> : <section className="interview-practice-layout"><aside className="interview-question-list"><div><strong>问题</strong><span>{pack.questions.length}</span></div>{pack.questions.map((question, index) => <button className={currentQuestion?.id === question.id ? "active" : ""} type="button" key={question.id} onClick={() => setActiveQuestionId(question.id)}><small>{String(index + 1).padStart(2, "0")} · {categoryLabel(question.category)}</small><span>{question.question}</span></button>)}</aside>
        {currentQuestion && <article className="interview-practice-panel"><header><span className="interview-question-number">问题 {String(pack.questions.findIndex((question) => question.id === currentQuestion.id) + 1).padStart(2, "0")}</span><h2>{currentQuestion.question}</h2></header><div className="interview-practice-content"><section className="interview-ai-analysis"><h3>AI 解析</h3><div className="interview-analysis-intent"><strong>考察重点</strong><p>{currentQuestion.intent}</p></div><div className="interview-analysis-framework"><strong>回答思路</strong>{currentQuestion.answerFramework.map((step, index) => <p key={`${step.title}-${index}`}><b>{index + 1}</b><span><em>{step.title}</em>{step.guidance}</span></p>)}</div></section><section className="interview-suggested-answer"><h3>建议回答</h3><p>{currentQuestion.suggestedAnswer || `你可以围绕“${currentQuestion.answerFramework.map((step) => step.title).join("—")}”来组织回答：${currentQuestion.answerFramework.map((step) => step.guidance).join("；")}`}</p></section><label className="interview-note-editor"><span>我的备忘录</span><textarea value={notes[currentQuestion.id] || ""} onChange={(event) => updateNote(event.target.value)} placeholder="记录需要补充的细节、数据或表达提醒…" /><small>{(notes[currentQuestion.id] || "").length} 字 · 自动保存</small></label><section className="interview-followups-simple"><h3>可能追问</h3>{currentQuestion.followUps.length ? <ol>{currentQuestion.followUps.map((item) => <li key={item}><button type="button" disabled={Boolean(generatingFollowUp)} onClick={() => void addFollowUpQuestion(item)}><span>{item}</span><em><IoAddOutline />{generatingFollowUp === item ? "生成中…" : "加入问题集"}</em></button></li>)}</ol> : <p>暂无追问建议。</p>}</section></div></article>}
      </section>}
    </>}
  </section>{notice && <div className="toast">{notice}</div>}</main>;
}

function ErrorMessage({ error }: { error: string }) { return <div className="interview-error"><IoAlertCircleOutline /><span>{error}</span>{error.includes("职业档案") && <Link href="/profile">前往职业档案</Link>}</div>; }
function EmptyJobs() { return <section className="interview-first-use"><IoBriefcaseOutline /><h2>岗位库还是空的</h2><p>先收藏一个目标岗位，才能为它生成贴合的面试问题。</p><Link className="primary-button" href="/jobs">前往岗位库</Link></section>; }
