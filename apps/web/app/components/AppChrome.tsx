"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IoAlbumsOutline,
  IoBarChartOutline,
  IoBriefcaseOutline,
  IoChatbubblesOutline,
  IoDocumentTextOutline,
  IoHomeOutline,
  IoIdCardOutline,
  IoNotificationsOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { ensureDemoData, isDemoMode } from "../lib/demo-data";

export type AppSection = "overview" | "jobs" | "profile" | "resumes" | "interview" | "review" | "settings";

const navGroups = [
  {
    label: "工作台",
    items: [
      { id: "overview", label: "总览", href: "/", icon: IoHomeOutline },
      { id: "jobs", label: "岗位库", href: "/jobs", icon: IoBriefcaseOutline },
    ],
  },
  {
    label: "求职准备",
    items: [
      { id: "profile", label: "职业档案", href: "/profile", icon: IoIdCardOutline },
      { id: "resumes", label: "简历管理", href: "/resumes", icon: IoDocumentTextOutline },
      { id: "interview", label: "面试准备", href: "/interviews", icon: IoChatbubblesOutline },
      { id: "review", label: "面试复盘", href: "/reviews", icon: IoAlbumsOutline },
    ],
  },
] as const;

export function AppSidebar({ active }: { active: AppSection }) {
  return <aside className="sidebar">
    <Link className="brand" href="/" aria-label="求职工作台首页">
      <Image className="brand-logo" src="/brand-logo.png" alt="" width={34} height={34} priority />
      <span>求职工作台</span>
    </Link>
    <nav aria-label="主导航">
      {navGroups.map((group) => <div className="nav-group" key={group.label}>
        <p className="nav-label">{group.label}</p>
        {group.items.map((item) => {
          const Icon = item.icon;
          return <Link className={`nav-item ${active === item.id ? "active" : ""}`} href={item.href} key={item.id}><Icon aria-hidden="true" /><span>{item.label}</span></Link>;
        })}
      </div>)}
    </nav>
    <div className="sidebar-tools"><Link href="/#data"><IoBarChartOutline aria-hidden="true" /><span>数据复盘</span></Link><Link className={active === "settings" ? "active" : ""} href="/settings"><IoSettingsOutline aria-hidden="true" /><span>设置</span></Link></div>
  </aside>;
}

interface AppTopbarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  status?: ReactNode;
  action?: ReactNode;
}

export function AppTopbar({ value, onChange, placeholder = "搜索岗位、公司、简历…", status, action }: AppTopbarProps) {
  const [profileName, setProfileName] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value);
  useEffect(() => {
    const readName = (incoming?: { values?: Record<string, string> }) => {
      try {
        const saved = incoming ?? JSON.parse(window.localStorage.getItem("job-workbench.personal-info") || "null") as { values?: Record<string, string> } | null;
        setProfileName(saved?.values?.name?.trim() || "");
      } catch { setProfileName(""); }
    };
    const timer = window.setTimeout(() => { ensureDemoData(); readName(); setDemoMode(isDemoMode()); }, 0);
    const update = (event: Event) => readName((event as CustomEvent<{ values?: Record<string, string> }>).detail);
    window.addEventListener("job-workbench:personal-info-updated", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("job-workbench:personal-info-updated", update); };
  }, []);
  return <header className="topbar">
    <label className="search"><IoSearchOutline aria-hidden="true" /><input value={value} onChange={handleChange} aria-label="全局搜索" placeholder={placeholder} /></label>
    <div className="top-actions">
      {action}
      <button className="bell" type="button" aria-label="通知"><IoNotificationsOutline aria-hidden="true" /><i /></button>
      <div className="profile">{demoMode && <span className="demo-account-badge">展示账号</span>}{status}<span className="avatar">{profileName.slice(0, 1) || "访"}</span><span className="profile-name">{profileName || "新用户"}</span></div>
    </div>
  </header>;
}

export function SyncStatus({ error = false }: { error?: boolean }) {
  return <><span className={`sync-dot ${error ? "offline" : ""}`} />{error ? "联动异常" : "插件已连接"}</>;
}

export { IoRefreshOutline };
