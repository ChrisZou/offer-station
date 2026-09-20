const app = document.querySelector("#app");
const settingsPanel = document.querySelector("#settings");
const apiInput = document.querySelector("#api-base");
const modeSelect = document.querySelector("#display-mode");
const autoMatchInput = document.querySelector("#auto-match");
const connectionDot = document.querySelector("#connection-dot");
const connectionText = document.querySelector("#connection-text");
const floatingClose = document.querySelector("#floating-close");
const floatingCollapse = document.querySelector("#floating-collapse");
const popoutButton = document.querySelector("#popout-button");
const avatarButton = document.querySelector("#settings-button");
const isFloating = new URLSearchParams(location.search).get("mode") === "floating";
const CONTEXT_INVALID_MESSAGE = "插件刚刚更新，请刷新当前 BOSS 页面后重试。";
const DEFAULT_API_BASE = "http://localhost:3000";
const API_BASE_DEFAULT_VERSION = "local-workbench-v1";
const BASIC_CONDITION = /(学历|本科|硕士|博士|大专|专科|经验|应届|年龄|\d+\s*(?:年|岁))/;

const state = {
  apiBase: DEFAULT_API_BASE,
  displayMode: "floating",
  autoMatch: true,
  currentJob: null,
  jobs: [],
  personalInfo: null,
};
let matchRequestId = 0;

function updateAvatar() {
  const name = state.personalInfo?.values?.name?.trim() || "";
  const initial = Array.from(name)[0] || "访";
  avatarButton.textContent = /^[a-z]$/i.test(initial) ? initial.toUpperCase() : initial;
  avatarButton.title = name ? `${name} · 连接设置` : "未填写姓名 · 连接设置";
  avatarButton.setAttribute("aria-label", avatarButton.title);
}

if (isFloating) {
  document.body.classList.add("floating-mode");
  floatingCollapse.classList.remove("hidden");
  floatingClose.classList.remove("hidden");
}

function setCompanyIcon(container, job, fallback = "▥") {
  container.replaceChildren();
  if (!job.companyLogoUrl) {
    container.textContent = fallback;
    return;
  }
  const image = document.createElement("img");
  image.src = job.companyLogoUrl;
  image.alt = `${job.company} Logo`;
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => { container.textContent = fallback; }, { once: true });
  container.append(image);
}

function normalizeBase(value) {
  return value.trim().replace(/\/+$/, "");
}

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "工作台请求失败");
  return data;
}

function setConnected(connected) {
  connectionDot.classList.toggle("offline", !connected);
  connectionText.textContent = connected ? "已连接" : "未连接";
}

async function refreshConnection() {
  try {
    const data = await api("/api/jobs?limit=100");
    state.jobs = data.jobs || [];
    setConnected(true);
    return true;
  } catch {
    state.jobs = [];
    setConnected(false);
    return false;
  }
}

function extensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

async function openWorkbench() {
  if (!extensionContextValid()) {
    showMessage(CONTEXT_INVALID_MESSAGE);
    return;
  }
  try {
    const tabs = await chrome.tabs.query({});
    const workbenchTabs = tabs.filter((tab) => tab.url?.startsWith(`${state.apiBase}/`) || tab.url === state.apiBase)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    const existing = workbenchTabs[0];
    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
      const duplicateIds = workbenchTabs.slice(1).map((tab) => tab.id).filter((id) => typeof id === "number");
      if (duplicateIds.length) await chrome.tabs.remove(duplicateIds).catch(() => {});
      return;
    }
    await chrome.tabs.create({ url: `${state.apiBase}/` });
  } catch {
    showMessage(CONTEXT_INVALID_MESSAGE);
  }
}

function createRecentSection() {
  const section = document.createElement("section");
  section.className = "recent-section";
  const head = document.createElement("div");
  head.className = "section-head";
  const title = document.createElement("h2");
  title.textContent = "最近收藏";
  const all = document.createElement("button");
  all.className = "link-button";
  all.type = "button";
  all.textContent = "查看全部 ›";
  all.addEventListener("click", openWorkbench);
  head.append(title, all);
  section.append(head);

  const card = document.createElement("div");
  card.className = "recent-card";
  if (!state.jobs.length) {
    const empty = document.createElement("div");
    empty.className = "recent-empty";
    const emptyIcon = document.createElement("span");
    emptyIcon.textContent = "☆";
    const emptyCopy = document.createElement("div");
    const emptyTitle = document.createElement("strong");
    emptyTitle.textContent = "还没有收藏岗位";
    const emptyHint = document.createElement("span");
    emptyHint.textContent = "收藏后可在工作台继续分析与管理";
    emptyCopy.append(emptyTitle, emptyHint);
    empty.append(emptyIcon, emptyCopy);
    card.append(empty);
  } else {
    state.jobs.slice(0, 3).forEach((job) => {
      const item = document.createElement("div");
      item.className = "recent-item";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      const icon = document.createElement("div");
      icon.className = "recent-icon";
      setCompanyIcon(icon, job);
      const main = document.createElement("div");
      main.className = "recent-main";
      const name = document.createElement("strong");
      name.textContent = job.title;
      const meta = document.createElement("span");
      meta.textContent = `${job.company} · ${job.locationText}`;
      main.append(name, meta);
      const salary = document.createElement("span");
      salary.className = "recent-salary";
      salary.textContent = job.salaryText;
      item.append(icon, main, salary);
      item.addEventListener("click", openWorkbench);
      item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openWorkbench(); });
      card.append(item);
    });
  }
  section.append(card);

  const workbench = document.createElement("button");
  workbench.className = "workbench-link";
  workbench.type = "button";
  workbench.textContent = "打开完整工作台 →";
  workbench.addEventListener("click", openWorkbench);
  section.append(workbench);
  return section;
}

function fillJobCard(root, job) {
  root.querySelectorAll("[data-field]").forEach((element) => {
    const field = element.dataset.field;
    element.textContent = job[field] || "";
  });
  const icon = root.querySelector(".company-icon");
  if (icon) setCompanyIcon(icon, job);
}

function showMessage(message) {
  const old = app.querySelector(".message");
  old?.remove();
  const box = document.createElement("div");
  box.className = "message";
  box.textContent = message;
  app.prepend(box);
}

function markSaved(button) {
  button.disabled = false;
  button.classList.add("saved");
  button.classList.remove("saving");
  button.title = "取消收藏";
  button.setAttribute("aria-label", "取消收藏");
}

function markUnsaved(button) {
  button.disabled = false;
  button.classList.remove("saved", "saving");
  button.title = "收藏岗位";
  button.setAttribute("aria-label", "收藏岗位");
}

function refreshRecentSectionInPlace() {
  app.querySelector(".recent-section")?.remove();
  app.append(createRecentSection());
}

function jobAlreadySaved(job) {
  return Boolean(findSavedJob(job));
}

function findSavedJob(job) {
  return state.jobs.find((saved) => saved.id === job.id || (saved.sourceUrl && saved.sourceUrl === job.sourceUrl));
}

function jobIdentity(job) {
  return job?.sourceUrl || `${job?.company || ""}::${job?.title || ""}`;
}

const NONESSENTIAL_TAG = /^(?:五险一金|双休|周末双休|大小周|单双休|节日福利|员工旅游|生日福利|团建(?:聚餐)?|年终奖|股票期权|补充医疗保险|零食下午茶|交通补助|餐补|通讯补贴|带薪年假|全勤奖|加班补助|保底工资|法定节假日三薪)$/i;

function renderAbilityComparison(matched, gaps) {
  const container = app.querySelector("#ability-comparison");
  const counts = app.querySelector("#ability-counts");
  if (!container || !counts) return;
  container.replaceChildren();
  const normalizedMatched = (matched || []).slice(0, 6).map((item) => ({
    skill: typeof item === "string" ? item : item.skill,
    requirement: typeof item === "string" ? `岗位要求具备${item}` : item.requirement || `岗位要求具备${item.skill || "该项能力"}`,
    detail: typeof item === "string" ? "职业档案中存在相关记录" : item.evidence || "职业档案中存在相关记录",
    status: "matched",
  }));
  const normalizedGaps = (gaps || []).slice(0, 6).map((item) => {
    const reason = typeof item === "string" ? "职业档案中暂未找到对应记录" : item.reason || "职业档案中暂未找到对应记录";
    const uncertain = typeof item !== "string" && item.status === "uncertain" || /尚未|未体现|无法确认|信息不足|待确认/.test(reason);
    return {
      skill: typeof item === "string" ? item : item.skill,
      requirement: typeof item === "string" ? `岗位要求具备${item}` : item.requirement || `岗位要求具备${item.skill || "该项能力"}`,
      detail: reason,
      status: uncertain ? "uncertain" : "missing",
    };
  });
  const missingCount = normalizedGaps.filter((item) => item.status === "missing").length;
  const uncertainCount = normalizedGaps.length - missingCount;
  counts.textContent = [
    `已具备 ${normalizedMatched.length}`,
    missingCount ? `待补足 ${missingCount}` : "",
    uncertainCount ? `待确认 ${uncertainCount}` : "",
  ].filter(Boolean).join(" · ");
  const appendGroup = (title, items, tone, emptyText) => {
    const group = document.createElement("section");
    group.className = `ability-pill-group ${tone}`;
    const heading = document.createElement("h4");
    const headingText = document.createElement("span");
    headingText.textContent = title;
    const headingCount = document.createElement("b");
    headingCount.textContent = String(items.length);
    heading.append(headingText, headingCount);
    group.append(heading);
    const list = document.createElement("div");
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "ability-group-empty";
      empty.textContent = emptyText;
      list.append(empty);
    }
    items.forEach((item) => {
      const detail = document.createElement("details");
      detail.className = `ability-pill-detail ${item.status}`;
      const summary = document.createElement("summary");
      const mark = document.createElement("span");
      mark.textContent = item.status === "matched" ? "✓" : "+";
      const skill = document.createElement("strong");
      skill.textContent = item.skill || "未命名能力";
      const chevron = document.createElement("i");
      chevron.textContent = "›";
      summary.append(mark, skill, chevron);
      const body = document.createElement("div");
      body.className = "ability-pill-body";
      const requirementLabel = document.createElement("b");
      requirementLabel.textContent = "岗位具体要求";
      const requirement = document.createElement("p");
      requirement.textContent = item.requirement;
      const judgmentLabel = document.createElement("b");
      judgmentLabel.textContent = item.status === "matched" ? "你的档案证据" : "当前判断";
      const judgment = document.createElement("p");
      judgment.textContent = item.detail;
      body.append(requirementLabel, requirement, judgmentLabel, judgment);
      detail.append(summary, body);
      list.append(detail);
    });
    group.append(list);
    container.append(group);
  };
  appendGroup("已具备", normalizedMatched, "matched", "职业档案中暂未找到可确认的能力证据");
  appendGroup("未具备 / 待确认", normalizedGaps, "missing", "AI 暂未发现缺失或需要确认的能力");
  container.classList.remove("hidden");
}

function cleanText(value, maxLength = 12000) {
  const ignoredLine = /^(首页|职位|公司|校园|海归|APP|有了|海外|无障碍专区|消息|简历|立即沟通|感兴趣|微信扫码分享|举报|公司基本信息|查看全部职位)$/;
  const benefitOnly = /^(五险一金|双休|周末双休|大小周|单双休|节日福利|员工旅游|生日福利|团建聚餐|年终奖|股票期权|补充医疗保险|零食下午茶|交通补助|餐补|通讯补贴|带薪年假|全勤奖|加班补助|保底工资|法定节假日三薪)([、，,\s]+(?:五险一金|双休|周末双休|大小周|单双休|节日福利|员工旅游|生日福利|团建聚餐|年终奖|股票期权|补充医疗保险|零食下午茶|交通补助|餐补|通讯补贴|带薪年假|全勤奖|加班补助|保底工资|法定节假日三薪))*$/;
  const seen = new Set();
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !ignoredLine.test(line) && !benefitOnly.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n")
    .slice(0, maxLength);
}

function compactJob(job) {
  return {
    title: String(job.title || "").slice(0, 160),
    company: String(job.company || "").slice(0, 120),
    locationText: String(job.locationText || "").slice(0, 120),
    experienceText: String(job.experienceText || "").slice(0, 80),
    educationText: String(job.educationText || "").slice(0, 80),
    skillTags: [...new Set((job.skillTags || []).map(String).map((item) => item.trim()).filter((item) => item && !NONESSENTIAL_TAG.test(item)))].slice(0, 20),
    jobDescription: cleanText(job.jobDescription),
  };
}

function compactProfile(profile) {
  const personalInfo = Object.fromEntries(Object.entries(profile.personalInfo || {}).filter(([key, value]) => (
    value && /(年龄|出生|经验|年限|证书|资格|执照|城市|求职|状态|age|birth|experience|certificate|license|city|target|status)/i.test(key)
  )).slice(0, 20));
  return {
    summary: cleanText(profile.summary, 1200),
    targetRoles: (Array.isArray(profile.targetRoles) ? profile.targetRoles : []).map(String).filter(Boolean).slice(0, 8),
    personalInfo,
    archives: (Array.isArray(profile.archives) ? profile.archives : []).slice(0, 12).map((archive) => ({
      type: archive.type,
      title: String(archive.title || "").slice(0, 140),
      subtitle: String(archive.subtitle || "").slice(0, 160),
      date: String(archive.date || "").slice(0, 80),
      skills: [...new Set((Array.isArray(archive.skills) ? archive.skills : []).map(String).filter(Boolean))].slice(0, 20),
      facts: (Array.isArray(archive.facts) ? archive.facts : []).map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 10),
      evidence: (Array.isArray(archive.evidence) ? archive.evidence : []).map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 8),
      description: cleanText(archive.description, 600),
    })),
  };
}

function renderHardRisks(items, title = "硬性风险") {
  const hardRiskGroup = app.querySelector("#hard-risk-group");
  const hardRisks = app.querySelector("#hard-risks");
  if (!hardRiskGroup || !hardRisks) return;
  app.querySelector("#hard-risk-title").textContent = title;
  hardRisks.replaceChildren();
  items.slice(0, 6).forEach((item) => {
    const row = document.createElement("p");
    const label = document.createElement("strong");
    const severityLabel = item.severity === "preference" ? "重要偏好" : item.status === "uncertain" ? "门槛待确认" : "硬门槛";
    label.textContent = `${item.label} · ${severityLabel}`;
    const reason = document.createElement("span");
    reason.textContent = item.requirement ? `岗位要求：${item.requirement}；核对结果：${item.reason}` : item.reason;
    row.append(label, reason);
    hardRisks.append(row);
  });
  if (!hardRisks.children.length) {
    const empty = document.createElement("p");
    empty.className = "hard-risk-empty";
    empty.textContent = title === "硬性风险" ? "未发现明确筛选门槛或重要偏好风险" : "正在等待 AI 核对学历、专业、身份及其他筛选条件";
    hardRisks.append(empty);
  }
  hardRiskGroup.classList.remove("hidden");
}

function extractLocalHardRequirements(job) {
  const text = `${job.educationText || ""}\n${job.experienceText || ""}\n${job.jobDescription || ""}`;
  const results = [];
  const certificateClauses = text.match(/(?:必须|要求|需|需要|持有|通过|具备)[^，。；\n]{0,24}(?:\b(?:CPA|CFA|PMP|FRM|ACCA)\b|注册会计师|法律职业资格|司法考试|教师资格(?:证)?|医师资格(?:证)?|护士执业(?:证)?)/gi) || [];
  const certificates = certificateClauses.flatMap((clause) => clause.match(/\b(?:CPA|CFA|PMP|FRM|ACCA)\b|注册会计师|法律职业资格|司法考试|教师资格(?:证)?|医师资格(?:证)?|护士执业(?:证)?/gi) || []);
  [...new Set(certificates.map((item) => item.toUpperCase()))].slice(0, 2).forEach((certificate) => {
    results.push({ label: `${certificate} 资格要求`, reason: "岗位正文明确提及，AI 正在核对职业档案是否满足" });
  });
  const age = text.match(/年龄(?:要求)?\s*[:：]?\s*(?:\d{2}\s*(?:-|–|—|至)\s*\d{2}\s*岁?|\d{2}\s*岁(?:以下|以内|以上))/i);
  if (age) results.push({ label: age[0].replace(/\s+/g, " "), reason: "岗位存在明确年龄条件，AI 正在核对个人信息" });
  const experience = text.match(/(?:\d+\s*(?:-|–|—|至)\s*\d+\s*年|\d+\s*年以上|\d+\s*年(?:工作)?经验|应届(?:生)?)/i);
  if (experience) results.push({ label: `经验条件：${experience[0].replace(/\s+/g, " ")}`, reason: "岗位存在明确经验条件，AI 正在核对经历事实" });
  const degree = text.match(/(?:大专|专科|本科|硕士|研究生|博士)(?:及以上|以上)?/i);
  if (degree && !/(学历不限|不限学历)/.test(text)) results.push({ label: `学历条件：${degree[0]}`, reason: "岗位存在明确学历条件，AI 正在核对教育经历" });
  const major = text.match(/(?:计算机|软件工程|统计学|数学|应用数学|运筹学|自动化|金融|会计|法学|医学|护理|市场营销|新闻传播|设计|人力资源)[^，。；\n]{0,18}(?:相关)?专业|相关专业/i);
  if (major && !/(专业不限|不限专业)/.test(text)) results.push({ label: `专业条件：${major[0]}`, reason: "岗位存在专业背景要求，AI 正在核对教育专业" });
  return results;
}

function renderLocalPreview(job) {
  const matchCard = app.querySelector("#match-card");
  if (!matchCard) return;
  const cleaned = cleanText(job.jobDescription, 900);
  const firstSentence = cleaned.split(/\n|(?<=[。！？；])/).map((item) => item.trim()).find((item) => item.length >= 12 && !/^(职位描述|职位介绍|工作内容|岗位职责|我们希望你)/.test(item));
  matchCard.classList.add("previewing");
  app.querySelector(".match-idle").classList.add("hidden");
  app.querySelector(".match-result").classList.remove("hidden");
  app.querySelector("#summary-source").textContent = "本地";
  app.querySelector("#job-summary").textContent = firstSentence?.slice(0, 150) || `这是一个${job.title || "当前"}岗位，AI 正在补充核心工作总结。`;
  app.querySelector("#ability-comparison").classList.add("hidden");
  app.querySelector("#ability-counts").textContent = "";
  renderHardRisks(extractLocalHardRequirements(job), "硬性条件待核对");
}

function analysisSkillKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/python编程/g, "python")
    .replace(/(?:相关)?(?:能力|技能|知识|基础|经验|水平|应用)$/g, "")
    .replace(/[\s·、，,。；;：:（）()\-_\/]/g, "");
}

function normalizeAnalysisForDisplay(analysis) {
  const negative = /(未提及|未体现|未明确|未找到|没有|无直接|无相关|缺少|缺乏|不具备|尚未|无法确认|信息不足|待补充|待确认|不能证明|不足以证明)/;
  const hardOnly = /(CPA|CFA|PMP|FRM|ACCA|注册会计师|法律职业资格|司法考试|教师资格(?:证)?|医师资格(?:证)?|护士执业(?:证)?|资格证|证书|执照|年龄|\d{2}\s*岁|应届(?:生)?|在校(?:生|大学生)?|\d{2,4}\s*届|工作经验|从业经验|行业经验|\d+\s*(?:-|–|—|至)\s*\d+\s*年|\d+\s*年以上|至少\s*\d+\s*年|学历|大专|专科|本科|硕士|研究生|博士|专业要求|专业背景|相关专业|英语|雅思|托福|IELTS|TOEFL|CET[-\s]?[46]|每周(?:至少)?\s*\d+\s*天|连续实习|到岗|出差|夜班|轮班|驻场|驾照|驾驶证|工作许可|签证|无犯罪记录|保密资格|政治面貌|党员|户籍|国籍)/i;
  const rejectedMatched = (analysis.matched || []).filter((item) => negative.test(String(item?.evidence || ""))).map((item) => ({
    skill: item.skill,
    requirement: item.requirement,
    reason: item.evidence,
    status: "uncertain",
    importance: "高",
  }));
  const hardRisks = (analysis.hardRisks || []).filter((item) => item?.label && item?.reason);
  const hardKeys = new Set(hardRisks.map((item) => analysisSkillKey(item.label)));
  const gapCandidates = [...(analysis.gaps || []), ...rejectedMatched].filter((item) => !hardOnly.test(String(item?.skill || "")));
  const gaps = gapCandidates.filter((item, index, items) => {
    const key = analysisSkillKey(item?.skill);
    return key && !hardKeys.has(key) && items.findIndex((candidate) => analysisSkillKey(candidate?.skill) === key) === index;
  }).slice(0, 6);
  const gapKeys = new Set(gaps.map((item) => analysisSkillKey(item.skill)));
  const matched = (analysis.matched || []).filter((item, index, items) => {
    const key = analysisSkillKey(item?.skill);
    return key
      && !negative.test(String(item?.evidence || ""))
      && !gapKeys.has(key)
      && !hardKeys.has(key)
      && items.findIndex((candidate) => analysisSkillKey(candidate?.skill) === key) === index;
  }).slice(0, 6);
  return { ...analysis, matched, gaps, hardRisks: hardRisks.slice(0, 6) };
}

function renderAnalysis(analysis) {
  const normalized = normalizeAnalysisForDisplay(analysis);
  const matchCard = app.querySelector("#match-card");
  if (!matchCard) return;
  matchCard.classList.add("analyzed");
  matchCard.classList.remove("previewing");
  app.querySelector(".match-idle").classList.add("hidden");
  app.querySelector(".match-result").classList.remove("hidden");
  app.querySelector("#summary-source").textContent = "AI";
  app.querySelector("#job-summary").textContent = normalized.summary || "AI 暂未生成岗位总结。";
  app.querySelector("#ability-loading").classList.add("hidden");
  renderHardRisks(normalized.hardRisks);
  renderAbilityComparison(normalized.matched, normalized.gaps);

  const button = app.querySelector("#run-match");
  button.querySelector("span").textContent = "重新分析";
  setMatchFeedback("");
}

function setMatchFeedback(message, tone = "error") {
  const feedback = app.querySelector("#match-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `match-feedback${message ? ` ${tone}` : " hidden"}`;
}

async function readSyncedAiContext() {
  const [session, local] = await Promise.all([
    chrome.storage.session.get("aiApiKey"),
    chrome.storage.local.get(["aiApiKey", "aiProfile", "personalInfo", "workbenchSyncedAt"]),
  ]);
  return { apiKey: session.aiApiKey || local.aiApiKey || "", local };
}

async function runMatch(job) {
  const button = app.querySelector("#run-match");
  if (!button || button.disabled) return;
  const requestId = ++matchRequestId;
  setMatchFeedback("正在读取工作台职业档案并请求 AI 分析…", "loading");
  button.disabled = true;
  button.querySelector("span").textContent = "AI 分析中…";
  try {
    let { apiKey, local } = await readSyncedAiContext();
    if (!apiKey || !local.aiProfile?.archives?.length) {
      await chrome.runtime.sendMessage({ type: "REFRESH_WORKBENCH_SYNC" }).catch(() => null);
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      ({ apiKey, local } = await readSyncedAiContext());
    }
    if (!apiKey) throw new Error("请先打开最新版工作台的设置页，保存 DeepSeek API Key 后再分析。");
    if (!local.aiProfile?.archives?.length) throw new Error("请先在最新版工作台创建职业档案，再进行岗位匹配。");
    const analysis = await api("/api/ai/job-analysis", {
      method: "POST",
      headers: { "X-DeepSeek-API-Key": apiKey },
      body: JSON.stringify({
        mode: "compact",
        job: compactJob(job),
        profile: compactProfile({
          ...local.aiProfile,
          personalInfo: { ...(local.aiProfile.personalInfo || {}), ...(local.personalInfo?.values || {}) },
        }),
      }),
    });
    if (requestId !== matchRequestId || jobIdentity(state.currentJob) !== jobIdentity(job)) return;
    renderAnalysis(analysis);
  } catch (error) {
    if (requestId === matchRequestId && jobIdentity(state.currentJob) === jobIdentity(job)) {
      setMatchFeedback(error instanceof Error ? error.message : "AI 分析失败，请稍后重试", "error");
    }
  } finally {
    button.disabled = false;
    if (!app.querySelector("#match-card")?.classList.contains("analyzed")) button.querySelector("span").textContent = "立即分析";
  }
}

function renderCurrent(job) {
  const fragment = document.querySelector("#job-template").content.cloneNode(true);
  fillJobCard(fragment, job);
  app.replaceChildren(fragment);
  app.append(createRecentSection());
  renderLocalPreview(job);

  const saveButton = app.querySelector("#save-job");
  if (jobAlreadySaved(job)) markSaved(saveButton);
  saveButton.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const savedJob = findSavedJob(job);
    button.disabled = true;
    button.classList.add("saving");
    button.title = savedJob ? "正在取消收藏…" : "收藏中…";
    button.setAttribute("aria-label", savedJob ? "正在取消收藏" : "收藏中");
    try {
      if (savedJob) {
        await api(`/api/jobs?id=${encodeURIComponent(savedJob.id)}`, { method: "DELETE" });
        await refreshConnection();
        markUnsaved(button);
        refreshRecentSectionInPlace();
        return;
      }
      const result = await api("/api/jobs", { method: "POST", body: JSON.stringify(job) });
      await refreshConnection();
      state.currentJob = result.job;
      markSaved(button);
      refreshRecentSectionInPlace();
    } catch (error) {
      showMessage(error.message);
      if (savedJob) markSaved(button);
      else markUnsaved(button);
    }
  });
  const matchButton = app.querySelector("#run-match");
  matchButton.addEventListener("click", (event) => {
    event.preventDefault();
    void runMatch(job);
  });
  if (state.autoMatch) void runMatch(job);
}

function renderFailure() {
  const fragment = document.querySelector("#failure-template").content.cloneNode(true);
  app.replaceChildren(fragment);
  app.append(createRecentSection());
  app.querySelector("#retry-button").addEventListener("click", loadCurrentJob);
  app.querySelector("#show-manual").addEventListener("click", () => {
    app.querySelector("#manual-form").classList.toggle("hidden");
  });
  app.querySelector("#manual-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "收藏中…";
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ ...values, source: "manual", sourceUrl: "" }),
      });
      await refreshConnection();
      state.currentJob = result.job;
      markSaved(button);
      refreshRecentSectionInPlace();
    } catch (error) {
      showMessage(error.message);
      button.disabled = false;
      button.textContent = "收藏到工作台";
    }
  });
}

function renderSuccess(job, created) {
  const section = document.createElement("section");
  section.className = "success";
  const mark = document.createElement("div");
  mark.className = "success-mark";
  mark.textContent = "✓";
  const title = document.createElement("h1");
  title.textContent = created ? "岗位已收藏" : "岗位已同步";
  const subtitle = document.createElement("p");
  subtitle.textContent = created ? "已加入你的岗位库" : "该岗位已存在，信息已更新";
  section.append(mark, title, subtitle);

  const card = document.createElement("article");
  card.className = "job-card";
  const heading = document.createElement("div");
  heading.className = "job-title-row";
  const icon = document.createElement("div");
  icon.className = "company-icon";
  setCompanyIcon(icon, job);
  const copy = document.createElement("div");
  copy.className = "job-heading";
  const name = document.createElement("h1");
  name.textContent = job.title;
  const company = document.createElement("p");
  company.textContent = job.company;
  copy.append(name, company);
  const salary = document.createElement("strong");
  salary.className = "salary";
  salary.textContent = job.salaryText;
  heading.append(icon, copy, salary);
  const facts = document.createElement("div");
  facts.className = "facts";
  facts.textContent = `${job.locationText} · ${job.experienceText} · ${job.educationText}`;
  card.append(heading, facts);
  section.append(card);

  const next = document.createElement("div");
  next.className = "next-card";
  const nextTitle = document.createElement("h2");
  nextTitle.textContent = "接下来可以";
  next.append(nextTitle);
  [
    ["查看岗位详情", "在完整工作台查看已保存的 JD"],
    ["继续浏览职位", "返回 BOSS 直聘发现更多岗位"],
  ].forEach(([label, description]) => {
    const item = document.createElement("div");
    item.className = "next-item";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const span = document.createElement("span");
    span.textContent = description;
    item.append(strong, span);
    item.addEventListener("click", label === "查看岗位详情" ? openWorkbench : loadCurrentJob);
    item.style.cursor = "pointer";
    next.append(item);
  });
  section.append(next);
  const open = document.createElement("button");
  open.className = "button primary wide";
  open.type = "button";
  open.textContent = "查看岗位库";
  open.addEventListener("click", openWorkbench);
  section.append(open);
  app.replaceChildren(section, createRecentSection());
}

async function getActiveTab() {
  try {
    if (!extensionContextValid()) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

async function loadCurrentJob() {
  matchRequestId += 1;
  state.currentJob = null;
  app.innerHTML = '<section class="loading-state"><div class="loader"></div><h2>正在识别当前岗位</h2><p>正在读取当前 BOSS 直聘职位页</p></section>';
  const connectionRefresh = refreshConnection();
  try {
    const tab = await getActiveTab();
    if (!tab?.id || !/^https:\/\/(www\.)?(zhipin|bosszhipin)\.com\//i.test(tab.url || "")) {
      renderFailure();
      return;
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: "PARSE_CURRENT_JOB" });
    if (!result?.recognized) {
      renderFailure();
      return;
    }
    state.currentJob = result.job;
    renderCurrent(result.job);
    void connectionRefresh.then(() => {
      if (jobIdentity(state.currentJob) !== jobIdentity(result.job)) return;
      refreshRecentSectionInPlace();
      const saveButton = app.querySelector("#save-job");
      if (saveButton && jobAlreadySaved(result.job)) markSaved(saveButton);
    });
  } catch {
    renderFailure();
  }
}

avatarButton.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

popoutButton.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id || !/^https:\/\/(www\.)?(zhipin|bosszhipin)\.com\//i.test(tab.url || "")) {
    showMessage("请先打开 BOSS 直聘职位页面，再弹出浮窗。");
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING" });
    if (typeof chrome.sidePanel.close === "function" && typeof tab.windowId === "number") {
      await chrome.sidePanel.close({ windowId: tab.windowId }).catch(() => {});
    } else {
      window.close();
    }
  } catch {
    showMessage("页面尚未加载插件，请刷新当前 BOSS 页面后重试。");
  }
});

document.querySelector("#save-settings").addEventListener("click", async () => {
  state.apiBase = normalizeBase(apiInput.value) || DEFAULT_API_BASE;
  state.displayMode = modeSelect.value === "sidepanel" ? "sidepanel" : "floating";
  state.autoMatch = autoMatchInput.checked;
  apiInput.value = state.apiBase;
  if (!extensionContextValid()) {
    showMessage(CONTEXT_INVALID_MESSAGE);
    return;
  }
  try {
    await chrome.storage.local.set({ apiBase: state.apiBase, apiBaseDefaultVersion: API_BASE_DEFAULT_VERSION, displayMode: state.displayMode, autoMatch: state.autoMatch });
  } catch {
    showMessage(CONTEXT_INVALID_MESSAGE);
    return;
  }
  settingsPanel.classList.add("hidden");
  if (isFloating && state.displayMode === "sidepanel") {
    const tab = await getActiveTab();
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "CLOSE_FLOATING" }).catch(() => {});
    if (typeof tab?.windowId === "number") await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    return;
  }
  if (!isFloating && state.displayMode === "floating") {
    const tab = await getActiveTab();
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING" }).catch(() => {});
    if (typeof chrome.sidePanel.close === "function" && typeof tab?.windowId === "number") await chrome.sidePanel.close({ windowId: tab.windowId }).catch(() => {});
    return;
  }
  await loadCurrentJob();
});

floatingCollapse.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "COLLAPSE_FLOATING" }).catch(() => {});
});

floatingClose.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "CLOSE_FLOATING" }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) void loadCurrentJob();
});

chrome.tabs.onActivated.addListener(() => void loadCurrentJob());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.personalInfo) {
    state.personalInfo = changes.personalInfo.newValue || null;
    updateAvatar();
  }
});

(async () => {
  try {
    if (!extensionContextValid()) throw new Error("context invalidated");
    const saved = await chrome.storage.local.get(["apiBase", "apiBaseDefaultVersion", "displayMode", "autoMatch", "personalInfo"]);
    const shouldMigrateApiBase = saved.apiBaseDefaultVersion !== API_BASE_DEFAULT_VERSION;
    state.apiBase = shouldMigrateApiBase ? DEFAULT_API_BASE : normalizeBase(saved.apiBase || DEFAULT_API_BASE);
    state.displayMode = saved.displayMode === "sidepanel" ? "sidepanel" : "floating";
    state.autoMatch = saved.autoMatch !== false;
    state.personalInfo = saved.personalInfo || null;
    updateAvatar();
    if (shouldMigrateApiBase) await chrome.storage.local.set({ apiBase: state.apiBase, apiBaseDefaultVersion: API_BASE_DEFAULT_VERSION });
    apiInput.value = state.apiBase;
    modeSelect.value = state.displayMode;
    autoMatchInput.checked = state.autoMatch;
    await chrome.storage.local.remove("jobAnalyses");
    await loadCurrentJob();
  } catch {
    app.innerHTML = `<section class="failure"><div class="failure-icon">↻</div><h1>插件已更新</h1><p>${CONTEXT_INVALID_MESSAGE}</p></section>`;
  }
})();
