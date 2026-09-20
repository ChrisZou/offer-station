"use client";

import { useEffect, useState } from "react";
import { IoCheckmarkCircleOutline, IoEyeOutline, IoKeyOutline, IoLockClosedOutline, IoPersonOutline, IoSparklesOutline, IoTrashOutline } from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import { AI_API_KEY_STORAGE, QWEN_API_KEY_STORAGE, callAi, callVisionAi, clearAiApiKey, clearQwenApiKey, getAiApiKey, getQwenApiKey, saveAiApiKey, saveQwenApiKey } from "../lib/ai-client";
import { DEMO_JOBS_STORAGE, isDemoMode, mergeDemoJobSnapshot, setDemoMode, type DemoJob } from "../lib/demo-data";

export default function AiSettings() {
  const [apiKey, setApiKey] = useState(() => getAiApiKey());
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [qwenKey, setQwenKey] = useState(() => getQwenApiKey());
  const [qwenStatus, setQwenStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [qwenMessage, setQwenMessage] = useState("");
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [pluginSync, setPluginSync] = useState<"checking" | "connected" | "disconnected">("checking");
  const [accountMode, setAccountMode] = useState<"personal" | "demo">("personal");

  useEffect(() => {
    const refreshKey = () => { setApiKey(getAiApiKey()); setQwenKey(getQwenApiKey()); };
    const handleSync = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail;
      setPluginSync(detail?.connected ? "connected" : "disconnected");
    };
    window.addEventListener("job-workbench:ai-context-updated", refreshKey);
    window.addEventListener("job-workbench:plugin-sync-status", handleSync);
    window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
    const accountTimer = window.setTimeout(() => setAccountMode(isDemoMode() ? "demo" : "personal"), 0);
    const timeout = window.setTimeout(() => setPluginSync((current) => current === "checking" ? "disconnected" : current), 1800);
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(accountTimer);
      window.removeEventListener("job-workbench:ai-context-updated", refreshKey);
      window.removeEventListener("job-workbench:plugin-sync-status", handleSync);
    };
  }, []);

  function save() {
    if (!apiKey.trim()) { setStatus("error"); setMessage("请输入 API Key"); return; }
    saveAiApiKey(apiKey);
    setStatus("success");
    setMessage("已保存在当前浏览器，并可同步给插件");
  }

  async function test() {
    if (!apiKey.trim()) { setStatus("error"); setMessage("请输入 API Key"); return; }
    saveAiApiKey(apiKey);
    setStatus("testing");
    setMessage("正在连接 DeepSeek…");
    try {
      const result = await callAi<{ ok: boolean; message: string; model: string }>("/api/ai/test", {});
      if (!result.ok) throw new Error("模型返回异常");
      setStatus("success");
      setMessage(`${result.message} · ${result.model}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "连接失败");
    }
  }

  function clear() {
    clearAiApiKey();
    setApiKey("");
    setStatus("idle");
    setMessage("API Key 已从当前浏览器移除");
  }

  function switchAccountMode(mode: "personal" | "demo") {
    if (mode === accountMode) return;
    setDemoMode(mode === "demo");
    setAccountMode(mode);
    window.setTimeout(() => window.location.reload(), 120);
  }

  function saveQwen() {
    if (!qwenKey.trim()) { setQwenStatus("error"); setQwenMessage("请输入阿里云百炼 API Key"); return; }
    saveQwenApiKey(qwenKey);
    setQwenStatus("success");
    setQwenMessage("已保存在当前浏览器，仅在视觉识别或录音转写请求时发送");
  }

  async function testQwen() {
    if (!qwenKey.trim()) { setQwenStatus("error"); setQwenMessage("请输入阿里云百炼 API Key"); return; }
    saveQwenApiKey(qwenKey);
    setQwenStatus("testing");
    setQwenMessage("正在连接 Qwen3-VL-Flash…");
    try {
      const result = await callVisionAi<{ ok: boolean; message: string; model: string }>("/api/ai/qwen-test", {});
      if (!result.ok) throw new Error("模型返回异常");
      setQwenStatus("success"); setQwenMessage(`${result.message} · ${result.model}`);
    } catch (error) { setQwenStatus("error"); setQwenMessage(error instanceof Error ? error.message : "连接失败"); }
  }

  async function resetAll() {
    if (accountMode === "demo") {
      setResetConfirming(false);
      setResetMessage("请先切回个人账号，再重置真实测试信息。这样可以避免覆盖展示账号进入前的备份。");
      return;
    }
    if (!resetConfirming) {
      setResetConfirming(true);
      setResetMessage("请再次点击确认。该操作会清空个人信息、职业档案和全部收藏岗位，但保留已接入的 API Key。");
      return;
    }
    setResetting(true);
    setResetMessage("正在重置测试数据…");
    try {
      const jobsResponse = await fetch("/api/jobs?limit=100", { cache:"no-store" });
      const jobsData = await jobsResponse.json() as { jobs?: DemoJob[] };
      if (jobsResponse.ok) mergeDemoJobSnapshot(jobsData.jobs ?? []);
      const response = await fetch("/api/jobs?reset=all", { method: "DELETE", headers: { "X-Test-Reset": "RESET" } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "重置失败");
      const preservedKeys = new Set([AI_API_KEY_STORAGE, QWEN_API_KEY_STORAGE, DEMO_JOBS_STORAGE]);
      [window.localStorage, window.sessionStorage].forEach((storage) => {
        Object.keys(storage)
          .filter((key) => key.startsWith("job-workbench.") && !preservedKeys.has(key))
          .forEach((key) => storage.removeItem(key));
      });
      window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
      window.dispatchEvent(new CustomEvent("job-workbench:personal-info-updated", { detail: null }));
      setStatus("idle");
      setMessage("");
      setResetConfirming(false);
      setResetMessage("已重置全部测试信息。刷新后将以新用户状态重新开始。");
      window.setTimeout(() => window.location.assign("/profile"), 900);
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : "重置失败，请稍后重试");
    } finally {
      setResetting(false);
    }
  }

  return <main className="app-shell settings-shell">
    <AppSidebar active="settings" />
    <section className="workspace">
      <AppTopbar placeholder="搜索设置…" />
      <div className="settings-page">
        <header className="settings-heading"><p className="eyebrow">智能能力</p><h1>AI 设置</h1><p>统一接入负责档案整理、岗位解读和匹配分析的模型。</p></header>
        <section className="account-mode-card">
          <div className="account-mode-heading"><span><IoEyeOutline /></span><div><small>录屏与演示</small><h2>账号模式</h2><p>展示账号沿用本地收藏的真实岗位，仅模拟求职进度与日程；关闭后自动恢复原有数据。</p></div>{accountMode === "demo" && <em>展示数据已启用</em>}</div>
          <div className="account-mode-options" role="radiogroup" aria-label="账号模式">
            <button type="button" role="radio" aria-checked={accountMode === "personal"} className={accountMode === "personal" ? "active" : ""} onClick={() => switchAccountMode("personal")}><IoPersonOutline /><span><strong>个人账号</strong><small>使用你自己的岗位与档案</small></span>{accountMode === "personal" && <IoCheckmarkCircleOutline />}</button>
            <button type="button" role="radio" aria-checked={accountMode === "demo"} className={accountMode === "demo" ? "active" : ""} onClick={() => switchAccountMode("demo")}><IoEyeOutline /><span><strong>展示账号</strong><small>真实岗位，模拟进度与日程</small></span>{accountMode === "demo" && <IoCheckmarkCircleOutline />}</button>
          </div>
          <p className="account-mode-note"><IoLockClosedOutline /> 展示账号不会写入真实岗位数据库；切换前会备份当前浏览器数据。</p>
        </section>
        <section className="ai-provider-card">
          <div className="provider-heading"><span><IoSparklesOutline /></span><div><small>当前服务</small><h2>DeepSeek</h2><p>模型：deepseek-v4-flash</p></div><em>文本分析优先</em></div>
          <label className="api-key-field"><span><IoKeyOutline /> API Key</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setStatus("idle"); }} placeholder="sk-…" /><small><IoLockClosedOutline /> 仅保存在当前浏览器本地并同步给插件，不写入工作台数据库。</small></label>
          {message && <div className={`ai-status ${status}`} role="status">{status === "success" && <IoCheckmarkCircleOutline />}{message}</div>}
          <div className={`plugin-sync-status ${pluginSync}`}><i />插件同步：{pluginSync === "connected" ? "已连接并同步" : pluginSync === "disconnected" ? "尚未连接，请重新加载插件" : "正在确认…"}</div>
          <div className="settings-actions"><button type="button" className="danger-button" onClick={clear}><IoTrashOutline /> 清除</button><span /><button type="button" className="ghost-button" disabled={status === "testing"} onClick={() => void test()}>{status === "testing" ? "测试中…" : "测试连接"}</button><button type="button" className="primary-button" onClick={save}>保存接入</button></div>
        </section>
        <section className="ai-provider-card">
          <div className="provider-heading"><span><IoSparklesOutline /></span><div><small>视觉服务</small><h2>Qwen3-VL-Flash</h2><p>阿里云百炼 · 图片/PDF 简历与页面审校</p></div><em>按需调用，控制成本</em></div>
          <label className="api-key-field"><span><IoKeyOutline /> 百炼 API Key</span><input type="password" autoComplete="off" value={qwenKey} onChange={(event) => { setQwenKey(event.target.value); setQwenStatus("idle"); }} placeholder="sk-…" /><small><IoLockClosedOutline /> 仅保存在当前浏览器；原始简历文件不会写入工作台数据库。</small></label>
          {qwenMessage && <div className={`ai-status ${qwenStatus}`} role="status">{qwenStatus === "success" && <IoCheckmarkCircleOutline />}{qwenMessage}</div>}
          <div className="settings-actions"><button type="button" className="danger-button" onClick={() => { clearQwenApiKey(); setQwenKey(""); setQwenStatus("idle"); setQwenMessage("百炼 API Key 已移除"); }}><IoTrashOutline /> 清除</button><span /><button type="button" className="ghost-button" disabled={qwenStatus === "testing"} onClick={() => void testQwen()}>{qwenStatus === "testing" ? "测试中…" : "测试视觉连接"}</button><button type="button" className="primary-button" onClick={saveQwen}>保存接入</button></div>
        </section>
        <section className="ai-scope-card"><div><h2>AI 分工与调用规则</h2><p>所有调用均为一次性结构化任务，不启用自主 Agent，也不允许模型自行切换供应商。</p></div><div className="ai-scope-grid"><article><b>01</b><h3>文字理解 · DeepSeek</h3><p>处理粘贴文本、岗位分析、匹配计算和初稿生成；只使用职业档案中的已知事实。</p></article><article><b>02</b><h3>文件读取 · Qwen VL</h3><p>图片直接识别；PDF 先在浏览器本地转为最多 6 张页面图，再提取结构化档案。</p></article><article><b>03</b><h3>视觉编辑 · Qwen VL</h3><p>编辑时同时读取当前预览和结构化简历；先判断留白、拥挤与溢出，再修改内容。</p></article></div><aside><strong>为什么暂时不用 Agent？</strong><p>当前任务的输入、输出和校验边界明确，单次结构化调用更便宜也更可控。缺少对应密钥时明确中止，不静默降级；视觉模型只能评价它实际看到的页面。</p></aside></section>
        <section className="test-reset-card">
          <div><small>本地测试工具</small><h2>重置所有信息</h2><p>清空个人信息、职业档案、插件同步缓存和全部收藏岗位；保留已接入的 DeepSeek 与百炼 API Key。仅 localhost 可用。</p></div>
          <button type="button" className={resetConfirming ? "danger-button solid" : "danger-button"} disabled={resetting || accountMode === "demo"} onClick={() => void resetAll()}><IoTrashOutline /> {resetting ? "重置中…" : accountMode === "demo" ? "展示账号不可重置" : resetConfirming ? "确认全部重置" : "重置所有信息"}</button>
          {resetConfirming && !resetting && <button type="button" className="ghost-button" onClick={() => { setResetConfirming(false); setResetMessage(""); }}>取消</button>}
          {resetMessage && <p className={resetConfirming ? "reset-warning" : "reset-result"} role="status">{resetMessage}</p>}
        </section>
      </div>
    </section>
  </main>;
}
