import type { AiProfile, GeneratedResume } from "./ai-client";

export const DEMO_MODE_STORAGE = "job-workbench.demo-mode";
export const DEMO_JOBS_STORAGE = "job-workbench.demo-jobs.v1";
const DEMO_BACKUP_STORAGE = "job-workbench.demo-mode.backup";
const DEMO_VERSION_STORAGE = "job-workbench.demo-mode.version";
const DEMO_DATA_VERSION = "2026-08-24-local-jobs-v6";
const preservedKeys = new Set(["job-workbench.deepseek-api-key", "job-workbench.qwen-api-key", DEMO_MODE_STORAGE, DEMO_JOBS_STORAGE, DEMO_BACKUP_STORAGE, DEMO_VERSION_STORAGE]);

export type DemoJob = {
  id: string; source: string; sourceUrl: string; title: string; company: string; companyLogoUrl: string;
  salaryText: string; locationText: string; experienceText: string; educationText: string;
  jobDescription: string; skillTags: string[]; status: string; savedAt: string; updatedAt: string;
};

export function mergeDemoJobSnapshot(incoming: DemoJob[]) {
  let snapshot: DemoJob[] = [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(DEMO_JOBS_STORAGE) || "[]") as DemoJob[];
    if (Array.isArray(stored)) snapshot = stored;
  } catch { /* 损坏的展示快照会由传入岗位重建 */ }
  const incomingKeys = new Set(incoming.flatMap((job) => [job.id, job.sourceUrl]).filter(Boolean));
  const merged = [...incoming, ...snapshot.filter((job) => !incomingKeys.has(job.id) && !incomingKeys.has(job.sourceUrl))];
  if (merged.length) window.localStorage.setItem(DEMO_JOBS_STORAGE, JSON.stringify(merged));
  return merged;
}

const iso = (daysAgo: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};
const dateAfter = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const demoProgress = ["面试中", "已投递", "未投递", "已读", "Offer", "已归档"];

/**
 * 展示账号始终读取本地岗位库。这里只叠加演示用进度，不改写岗位原始信息或 D1 数据。
 */
export async function loadDemoJobs(): Promise<DemoJob[]> {
  const snapshot = mergeDemoJobSnapshot([]);

  let incoming: DemoJob[] = [];
  try {
    const response = await fetch("/api/jobs?limit=100", { cache: "no-store" });
    const data = await response.json() as { jobs?: DemoJob[]; error?: string };
    if (!response.ok) throw new Error(data.error || "读取本地岗位失败");
    incoming = data.jobs ?? [];
  } catch (error) {
    if (!snapshot.length) throw error;
  }

  const sourceJobs = mergeDemoJobSnapshot(incoming.length ? incoming : snapshot);

  const jobs = sourceJobs.map((job, index) => ({
    ...job,
    status: demoProgress[index % demoProgress.length],
    updatedAt: iso(index % 5, 9 + (index % 7)),
  }));
  if (jobs[0] && typeof window !== "undefined") {
    const first = jobs[0];
    const resume: GeneratedResume = {
      ...demoResume,
      title: `小u｜${first.company} ${first.title}岗位简历`,
      targetRole: first.title,
      job: { id:first.id, title:first.title, company:first.company },
    };
    window.localStorage.setItem("job-workbench.generated-resume", JSON.stringify(resume));
  }
  return jobs;
}

export type DemoSchedule = { id: string; date: string; time: string; title: string; company: string; jobId?: string; jobTitle?: string; type: string; meta: string; place: string };

export function createDemoSchedules(jobs: DemoJob[]): DemoSchedule[] {
  const plans = [
    { days:1, time:"10:30", type:"面试", verb:"二轮业务面", meta:"梳理岗位相关项目、量化成果与追问问题。", place:"线上会议" },
    { days:2, time:"14:00", type:"面试", verb:"招聘方电话沟通", meta:"确认团队方向、岗位级别、面试流程与到岗周期。", place:"电话沟通" },
    { days:3, time:"19:30", type:"准备", verb:"完善岗位专属简历", meta:"按照真实 JD 补充相关项目证据与成果数据。", place:"" },
    { days:4, time:"09:30", type:"投递", verb:"确认并投递", meta:"检查岗位匹配分析、招呼语和简历版本。", place:"原招聘平台" },
    { days:5, time:"15:30", type:"面试", verb:"技术面试", meta:"准备核心技术问题、项目难点和方案取舍案例。", place:"腾讯会议" },
    { days:6, time:"20:00", type:"准备", verb:"面试复盘与跟进", meta:"记录面试问题、回答缺口，并整理下一轮补充材料。", place:"" },
  ];
  return jobs.slice(0, plans.length).map((job, index) => {
    const plan = plans[index];
    return { id:`demo-schedule-${job.id}`, date:dateAfter(plan.days), time:plan.time, title:`${job.company} · ${plan.verb}`, company:job.company, jobId:job.id, jobTitle:job.title, type:plan.type, meta:plan.meta, place:plan.place };
  });
}

export const demoProfile: AiProfile = {
  summary:"5 年 AI 与企业服务产品经验，擅长把复杂模型能力转化为可验证的用户场景，并通过指标体系推动持续迭代。",
  targetRoles:["AI产品经理","AI高级产品经理","AI解决方案架构师"],
  personalInfo:{ name:"小u", phone:"138****6688", email:"xiaou@example.com", city:"杭州", experience:"5 年", targetRole:"AI 产品经理" },
  archives:[
    { type:"工作经历", title:"AI Agent 企业工作台", subtitle:"字节脉动 · AI 产品经理", date:"2023.04—至今", description:"负责企业知识场景的 Agent 产品规划与交付。", skills:["AI Agent","产品规划","模型评测","数据分析"], facts:["主导自主决策 Agent 系统从 0 到 1 上线","建立 12 项场景评测指标","将人工干预率降低 25%","推动 3 个业务团队完成接入"], confirmedFacts:["主导自主决策 Agent 系统从 0 到 1 上线","建立 12 项场景评测指标","将人工干预率降低 25%"], evidence:["项目复盘文档","指标看板截图"] },
    { type:"工作经历", title:"企业协同产品", subtitle:"栖木科技 · 产品经理", date:"2021.07—2023.03", description:"负责企业协同 SaaS 的流程设计、客户调研和版本迭代。", skills:["企业服务","用户研究","项目管理"], facts:["访谈 40+ 企业用户并沉淀角色需求地图","推动核心流程完成 3 次关键改版","试点客户周活跃率提升 18%"], confirmedFacts:["访谈 40+ 企业用户并沉淀角色需求地图","试点客户周活跃率提升 18%"], evidence:["用户研究报告"] },
    { type:"项目经历", title:"多模型效果评测平台", subtitle:"内部创新项目 · 项目负责人", date:"2024.02—2024.08", description:"搭建覆盖正确性、稳定性和成本的模型评测工作流。", skills:["大模型","评测体系","Prompt Engineering"], facts:["覆盖 6 类高频业务场景","回归评测耗时从 2 天缩短至 3 小时","形成模型选型决策模板"], confirmedFacts:["覆盖 6 类高频业务场景","回归评测耗时从 2 天缩短至 3 小时"], evidence:["评测方案","演示视频"] },
    { type:"教育经历", title:"浙江大学", subtitle:"信息管理与信息系统 · 本科", date:"2017.09—2021.06", description:"系统学习信息系统、数据分析与产品设计。", skills:["信息系统","数据分析"], facts:["校级优秀毕业设计","参与智能问答研究项目"], confirmedFacts:["校级优秀毕业设计"], evidence:["毕业证书"] },
    { type:"成果证明", title:"AI 产品方法论分享", subtitle:"行业社区公开分享", date:"2025.05", description:"围绕 Agent 场景选择与评测方法进行公开分享。", skills:["公开表达","方法论"], facts:["线上观看 2,000+","整理 30 页实践手册"], confirmedFacts:["线上观看 2,000+"], evidence:["活动页面","分享材料"] },
  ],
};

export const demoResume: GeneratedResume = {
  title:"小u｜岗位专属简历", targetRole:"AI 产品经理", headline:"5 年 AI 与企业服务产品经验",
  summary:demoProfile.summary, skills:["AI Agent 产品规划","模型评测体系","企业服务","数据分析","跨团队项目管理"],
  experiences:demoProfile.archives.slice(0,4).map((item)=>({ type:item.type,title:item.title,subtitle:item.subtitle,date:item.date,bullets:item.facts.slice(0,3) })),
  job:{ id:"", title:"AI 产品经理", company:"目标公司" }, personalInfo:demoProfile.personalInfo || {}, match:89,
  createdAt:iso(2), updatedAt:iso(0,15), template:"habaneraa-one-page-resume-zh",
  design:{ fontFamily:"Noto Sans CJK SC",fontSize:10.5,lineHeight:1.35,pageMargin:18,accentColor:"#087f7a",elementSpaciness:1.08 },
};

export function isDemoMode() {
  return typeof window !== "undefined" && window.localStorage.getItem(DEMO_MODE_STORAGE) === "on";
}

export function ensureDemoData() {
  if (!isDemoMode() || window.localStorage.getItem(DEMO_VERSION_STORAGE) === DEMO_DATA_VERSION) return;
  window.localStorage.removeItem("job-workbench.schedules.v1");
  window.localStorage.removeItem("job-workbench.interview-prep.v1");
  window.localStorage.removeItem("job-workbench.job-greetings.v3");
  Object.entries(demoSeed()).forEach(([key,value])=>window.localStorage.setItem(key,JSON.stringify(value)));
  window.localStorage.setItem(DEMO_VERSION_STORAGE,DEMO_DATA_VERSION);
}

function demoSeed() {
  return {
    "job-workbench.ai-profile": demoProfile,
    "job-workbench.personal-info": { values:demoProfile.personalInfo, visible:["name","phone","email","city","experience","targetRole"] },
    "job-workbench.generated-resume": demoResume,
    "job-workbench.archive-folders": { folders:[{id:"demo-f1",name:"AI 产品",color:"#0a84ff"},{id:"demo-f2",name:"成果案例",color:"#30d158"}],assignments:{} },
  };
}

export function setDemoMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    if (!isDemoMode()) {
      const backup: Record<string,string> = {};
      Object.keys(window.localStorage).filter((key)=>key.startsWith("job-workbench.") && !preservedKeys.has(key)).forEach((key)=>{ const value=window.localStorage.getItem(key); if(value!==null) backup[key]=value; });
      window.localStorage.setItem(DEMO_BACKUP_STORAGE, JSON.stringify(backup));
    }
    window.localStorage.removeItem("job-workbench.schedules.v1");
    window.localStorage.removeItem("job-workbench.interview-prep.v1");
    window.localStorage.removeItem("job-workbench.job-greetings.v3");
    Object.entries(demoSeed()).forEach(([key,value])=>window.localStorage.setItem(key,JSON.stringify(value)));
    window.localStorage.setItem(DEMO_MODE_STORAGE,"on");
    window.localStorage.setItem(DEMO_VERSION_STORAGE,DEMO_DATA_VERSION);
  } else {
    let backup: Record<string,string> = {};
    try { backup=JSON.parse(window.localStorage.getItem(DEMO_BACKUP_STORAGE)||"{}"); } catch { /* 无备份时恢复为空 */ }
    Object.keys(window.localStorage).filter((key)=>key.startsWith("job-workbench.") && !preservedKeys.has(key)).forEach((key)=>window.localStorage.removeItem(key));
    Object.entries(backup).forEach(([key,value])=>window.localStorage.setItem(key,value));
    window.localStorage.removeItem(DEMO_MODE_STORAGE);
    window.localStorage.removeItem(DEMO_BACKUP_STORAGE);
    window.localStorage.removeItem(DEMO_VERSION_STORAGE);
  }
}
