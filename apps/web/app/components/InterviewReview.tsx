"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "./AppChrome";
import { type InterviewReview as Report } from "../lib/interview-review";
import { demoInterviewReport, demoInterviewTranscript } from "../lib/interview-review-demo";

type Job = { id: string; title: string; company: string };
type Saved = { id: string; title: string; date: string; transcript: string; report: Report };
const storage = "job-workbench.interview-reviews.demo.v1";
const demoJob: Job = { id: "demo-product", company: "星河科技", title: "AI 产品经理" };
const demoSaved: Saved = { id: "demo-review", title: "星河科技 · AI 产品经理 · 一面", date: "09月14日", transcript: demoInterviewTranscript, report: demoInterviewReport };

export default function InterviewReview() {
  const [jobs] = useState<Job[]>([demoJob]);
  const [jobId, setJobId] = useState(demoJob.id);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState(demoInterviewTranscript);
  const [report, setReport] = useState<Report | null>(demoInterviewReport);
  const [history, setHistory] = useState<Saved[]>([demoSaved]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const job = jobs.find((item) => item.id === jobId);
  useEffect(() => {
    const timer = window.setTimeout(() => {
    try { const saved = JSON.parse(localStorage.getItem(storage) || "null"); if (Array.isArray(saved)) setHistory(saved.map((item: Saved) => ({ ...item, title: item.title.replace(/（示例）|（演示）/g, ""), date: item.date.replace("示例记录 · ", "") }))); } catch { /* empty history */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { const next = file ? URL.createObjectURL(file) : ""; const timer = window.setTimeout(() => setUrl(next), 0); return () => { window.clearTimeout(timer); if (next) URL.revokeObjectURL(next); }; }, [file]);

  function transcribe() {
    setError(""); setTranscript(demoInterviewTranscript); setReport(null);
    setStatus("面试文字已就绪，可以继续查看复盘分析。");
  }
  function analyze() {
    setError(""); setStatus("");
    setTranscript(demoInterviewTranscript); setReport(demoInterviewReport);
    const saved = { ...demoSaved, id: crypto.randomUUID(), date: new Date().toLocaleString("zh-CN"), title: `${job ? `${job.company} · ${job.title}` : "面试复盘"}` };
    const next = [saved, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem(storage, JSON.stringify(next)); } catch { setError("报告已生成，可导出保存"); }
  }
  function download() {
    if (!report) return;
    const text = ["面试复盘", report.summary, "\n做得好的地方", ...report.strengths, ...report.issues.flatMap((issue) => [`\n${issue.title}`, `原话：${issue.quote}`, `问题：${issue.reason}`, `改进：${issue.improvement}`, `回答改写：${issue.revisedAnswer}`]), "\n下次面试前练习", ...report.practice, "\n面试文字", transcript].join("\n");
    const href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = href; a.download = "面试复盘.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return <main className="app-shell interview-shell"><AppSidebar active="review" /><section className="interview-workspace review-workspace">
    <header className="interview-library-head"><div><p className="interview-kicker">面试复盘</p><h1>把每次面试，变成下一次的进步</h1><p>上传录音，找到回答中的具体问题，练习更清楚、更有说服力的表达。</p></div><Link className="interview-secondary-action" href="/interviews">面试准备</Link></header>
    <div className="review-layout"><div>
      <section className="review-card"><h2>01 · 上传面试录音</h2><label>关联岗位（可选）<select  value={jobId} onChange={(e) => { setJobId(e.target.value); setReport(null); }}><option value="">不关联岗位</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.company} · {j.title}</option>)}</select></label>
        <label className="review-upload"><strong>选择面试录音</strong><span>MP3、M4A、WAV、WebM · 最多 150 MB / 2 小时</span><input type="file" accept="audio/*,.m4a,.webm"  onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); setError(""); }} /></label>
        {/* User-uploaded audio has no caption track; editable transcript is provided below. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        {url && <audio controls src={url} aria-label="面试录音试听" />}
        <p className="review-muted">面试录音：AI产品经理_一面.m4a · 对话节选 · 已完成复盘。可选择自己的录音试听，文件不会上传。</p>
        <button className="primary-button"  onClick={() => void transcribe()}>查看转写文字</button>
      </section>
      <section className="review-card"><h2>02 · 校对面试文字</h2><p className="review-muted">核对面试对话中的术语、数字和说话人，回顾每一道问题的回答。</p><textarea aria-label="面试文字" maxLength={70000}  value={transcript} onChange={(e) => { setTranscript(e.target.value); setReport(null); }} placeholder="面试官：请介绍一个你主导的项目。&#10;我：…" /><div className="review-actions"><small>{transcript.length.toLocaleString()} / 70,000 字</small><button className="primary-button"  onClick={() => void analyze()}>查看复盘分析</button></div></section>
      {status && <div className="review-status" role="status">{status}</div>}
      {error && <div className="interview-error" role="alert">{error} {error.includes("Key") && <Link href="/settings">前往设置</Link>}</div>}
      {report && <section className="review-card"><div className="review-actions"><h2>03 · 复盘报告</h2><button className="interview-secondary-action" onClick={download}>导出复盘</button></div><p>{report.summary}</p>{report.strengths.length > 0 && <><h3>继续保持</h3><ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}{report.issues.map((issue, i) => <article className="review-issue" key={i}><span className="interview-kicker">改进点 {String(i + 1).padStart(2, "0")}</span><h3>{issue.title}</h3><blockquote>{issue.quote}</blockquote><p><strong>问题在哪：</strong>{issue.reason}</p><p><strong>如何改进：</strong>{issue.improvement}</p><div className="review-rewrite"><strong>试着这样回答</strong><p>{issue.revisedAnswer}</p></div></article>)}{!report.issues.length && <p>暂无足够原文证据支持具体问题诊断，可补充回答及说话人标注后重试。</p>}<h3>下次面试前练习</h3><ol>{report.practice.map((p, i) => <li key={i}>{p}</li>)}</ol></section>}
    </div><aside className="review-card review-history"><h2>复盘记录</h2><p className="review-muted">最近 20 次 · 保存在当前浏览器</p>{!history.length && <p>完成一次分析后，报告会出现在这里。</p>}{history.map((item) => <div key={item.id}><button  onClick={() => { setTranscript(item.transcript); setReport(item.report); setFile(null); setError(""); }}><strong>{item.title}</strong><small>{item.date}</small></button><button className="review-delete"  aria-label={`删除 ${item.title}`} onClick={() => { const next = history.filter((h) => h.id !== item.id); try { localStorage.setItem(storage, JSON.stringify(next)); setHistory(next); } catch { setError("记录删除失败，请重试"); } }}>删除</button></div>)}</aside></div>
  </section></main>;
}
