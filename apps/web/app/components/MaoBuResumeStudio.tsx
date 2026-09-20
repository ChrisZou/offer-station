"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IoCheckmarkCircleOutline, IoOpenOutline, IoReloadOutline } from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import { GENERATED_RESUME_STORAGE, type GeneratedResume } from "../lib/ai-client";

const MAOBU_RESUME_STORAGE = "job-workbench.maobu-resume";

type MaoBuDraft = {
  createdAt?: string;
  resume?: Record<string, unknown>;
  savedAt?: string;
};

export default function MaoBuResumeStudio() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [draft] = useState<GeneratedResume | null>(() => {
    if (typeof window === "undefined") return null;
    try { const value = window.localStorage.getItem(GENERATED_RESUME_STORAGE); return value ? JSON.parse(value) as GeneratedResume : null; } catch { return null; }
  });
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在连接设计器…");
  const [studioOnline, setStudioOnline] = useState<boolean | null>(null);
  const studioUrl = useMemo(
    () => process.env.NEXT_PUBLIC_RESUME_STUDIO_URL || "/resume-studio/workbench.html#/?workbench=1",
    []
  );

  const checkStudio = useCallback(async () => {
    setStudioOnline(null);
    setReady(false);
    setSaveStatus("正在连接设计器…");
    try {
      const healthUrl = studioUrl.split("#")[0];
      const response = await fetch(healthUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Resume studio returned ${response.status}`);
      setStudioOnline(true);
    } catch {
      setStudioOnline(false);
      setSaveStatus("设计器未启动");
    }
  }, [studioUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkStudio(), 0);
    return () => window.clearTimeout(timer);
  }, [checkStudio]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "JOB_WORKBENCH_STUDIO_READY") {
        setReady(true);
        setStudioOnline(true);
        setSaveStatus("猫步设计器已连接");
        let nativeResume: Record<string, unknown> | undefined;
        try {
          const saved = JSON.parse(window.localStorage.getItem(MAOBU_RESUME_STORAGE) || "null") as MaoBuDraft | null;
          if (saved?.createdAt === draft?.createdAt) nativeResume = saved.resume;
        } catch { /* 损坏的猫步草稿由设计器重新生成。 */ }
        iframeRef.current?.contentWindow?.postMessage({
          type: "JOB_WORKBENCH_SET_RESUME",
          resume: draft,
          nativeResume,
        }, "*");
      }
      if (event.data?.type === "JOB_WORKBENCH_STUDIO_CHANGE") {
        const value: MaoBuDraft = {
          createdAt: draft?.createdAt,
          resume: event.data.resume,
          savedAt: event.data.savedAt,
        };
        window.localStorage.setItem(MAOBU_RESUME_STORAGE, JSON.stringify(value));
        if (draft) {
          const nextDraft = { ...draft, updatedAt: new Date().toISOString() };
          window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(nextDraft));
          setDraft(nextDraft);
        }
        setSaveStatus(`已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [draft]);

  if (!draft) return <main className="app-shell resume-shell">
    <AppSidebar active="resumes" />
    <section className="workspace"><AppTopbar /><div className="editor-page empty-editor-page">
      <Link className="resume-back" href="/resumes">← 返回简历管理</Link>
      <section className="editor-empty-state"><h1>还没有可以编辑的简历</h1><p>先选择岗位和职业档案素材，生成后会进入猫步专业设计器。</p><Link className="primary-button button-link" href="/resumes/new">开始创建简历</Link></section>
    </div></section>
  </main>;

  return <main className="app-shell resume-shell maobu-shell">
    <section className="workspace maobu-workspace"><AppTopbar />
      <header className="maobu-hostbar">
        <div><Link href="/resumes">← 简历管理</Link><strong>{draft.title}</strong><span>{draft.job.company} · {draft.job.title}</span></div>
        <div><span className={ready ? "connected" : ""}><IoCheckmarkCircleOutline /> {saveStatus}</span><a href={studioUrl} target="_blank" rel="noreferrer"><IoOpenOutline /> 单独打开</a></div>
      </header>
      <section className="maobu-frame-wrap">
        {studioOnline === null && <div className="maobu-load-error"><h2>正在连接猫步设计器</h2><p>正在检查本地编辑服务，请稍候。</p></div>}
        {studioOnline === false && <div className="maobu-load-error"><h2>内置简历设计器未找到</h2><p>工作台没有找到已编译的猫步静态模块，请重新构建工作台后再试。</p><button type="button" onClick={() => void checkStudio()}><IoReloadOutline /> 重新加载</button><code>npm run build:studio</code></div>}
        {studioOnline === true && <iframe ref={iframeRef} title="猫步简历设计器" src={studioUrl} allow="clipboard-read; clipboard-write" />}
      </section>
    </section>
  </main>;
}
