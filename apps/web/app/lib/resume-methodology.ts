export type ResumeTemplateId =
  | "habaneraa-one-page-resume-zh"
  | "golixp-resume-zh-cn"
  | "bone-resume"
  | "brilliant-cv"
  | "modern-cv"
  | "basic-resume"
  | "altacv"
  | "vivid-cv";

export type ResumeMethodology = {
  id: string;
  name: string;
  keywords: string[];
  recommendedTemplate: ResumeTemplateId;
  focus: string[];
  sectionOrder: string[];
  bulletRules: string[];
  avoid: string[];
};

export type ResumeTemplatePreset = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  pageMargin: number;
  accentColor: string;
  elementSpaciness?: number;
};

export type ResumeCareerStage = "student_recent" | "early_career" | "experienced" | "academic";

export type ResumeStructureDecision = {
  stage: ResumeCareerStage;
  stageLabel: string;
  sectionOrder: string[];
  reason: string;
  rules: string[];
};

// These rules are deliberately shared by first-time generation and later AI edits.
// They describe the common Chinese one-page resume convention: relevance first,
// then career-stage-specific ordering, rather than a blanket “education first” rule.
export const CHINESE_ONE_PAGE_RESUME_RULES = [
  "中文一页简历以岗位相关性和近期证据优先；页首仅保留姓名、目标方向、电话、邮箱和城市。",
  "在校生、应届生及毕业两年内候选人，教育经历通常放在正文第一节；紧随其后展示最相关的实习、项目或科研经历。",
  "有三年以上相关经验的候选人，工作经历通常放在教育经历之前；教育经历放在工作、项目和关键技能之后。",
  "科研、教育、医疗专业，以及学历、专业或执业资质为明确筛选条件的岗位，教育、研究或资质应前置。",
  "同一模块按时间倒序排列；每段经历保留 2—4 条与目标岗位直接相关、可核验的要点。",
  "默认控制为一页 A4：先删除重复和弱相关内容，不以虚构事实填充篇幅。",
] as const;

// A first-generation resume must clear these gates before it is considered
// publishable. They are injected into both generation and natural-language
// editing prompts, so quality does not depend on the user remembering them.
export const FIRST_GENERATION_QUALITY_GATES = [
  "岗位证据覆盖：每个保留模块至少对应一个 JD 职责、工具、业务场景或硬性条件；弱相关内容必须缩短或移除。",
  "事实可追溯：每条 bullet 都能回溯到已选档案；量化数字要保留原口径，不得把团队结果写成个人独立成果。",
  "信息归位：个人优势只总结定位与最强证据；任职、项目、教育、证书和技能不得混写。",
  "结果优先：每条经历优先写动作、方法、范围和结果；没有结果时如实写职责与产出，不用空泛形容词代替。",
  "关键词自然覆盖：把 JD 的关键术语放入真实对应经历、技能或项目中；禁止关键词堆砌与虚假技能。",
  "一致性校验：职位、公司、项目、日期、技能名称、数字单位和标点风格必须前后一致；同类日期使用 YYYY.MM—YYYY.MM。",
  "一页纸预算：优先 3—6 段强经历、8—14 条要点、8—14 项技能；超页先删重复和弱相关，素材不足则如实留白。",
  "ATS 与人工阅读：章节名清楚、联系方式可读、不使用技能进度条、表情符号、照片或影响文本解析的装饰。",
  "生成前静默复核：先完成草稿，再按以上规则复查一遍；只输出复核后的最终简历，不输出过程或评分。",
] as const;

export const RESUME_TEMPLATE_REFERENCES: Array<{
  id: ResumeTemplateId;
  name: string;
  description: string;
  suitable: string;
  methodologyId: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  engine: "Typst";
  preset: ResumeTemplatePreset;
}> = [
  { id: "habaneraa-one-page-resume-zh", name: "Habaneraa 中文一页简历", description: "官方 0.1.0 包；通过 element-spaciness 在不破坏中文排版的前提下贴合一页", suitable: "应届、校招与一页纸投递", methodologyId: "general", sourceName: "habaneraa-one-page-resume-zh 0.1.0", sourceUrl: "https://typst.app/universe/package/habaneraa-one-page-resume-zh/", license: "MIT", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.42, pageMargin: 36, accentColor: "#179299", elementSpaciness: 1.05 } },
  { id: "golixp-resume-zh-cn", name: "中文模块化简历", description: "原生中文模块、项目、技能、时间线与双栏布局", suitable: "技术、数据与工程岗位", methodologyId: "technology", sourceName: "golixp-resume-zh-cn", sourceUrl: "https://typst.app/universe/package/golixp-resume-zh-cn/", license: "MIT", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.42, pageMargin: 36, accentColor: "#176f8d" } },
  { id: "bone-resume", name: "Bone Resume", description: "鲜明但克制的中文视觉表达", suitable: "内容、设计与创意岗位", methodologyId: "design_content", sourceName: "bone-resume", sourceUrl: "https://typst.app/universe/package/bone-resume/", license: "Apache-2.0", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.45, pageMargin: 38, accentColor: "#7757a9" } },
  { id: "brilliant-cv", name: "Brilliant CV", description: "完整、模块化、带中文配置的多页履历", suitable: "中高级通用、科研与完整履历", methodologyId: "academic_research", sourceName: "brilliant-cv", sourceUrl: "https://typst.app/universe/package/brilliant-cv/", license: "Apache-2.0", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.5, pageMargin: 42, accentColor: "#287d69" } },
  { id: "modern-cv", name: "Modern CV", description: "Awesome-CV 的 Typst 移植版，成熟商务排版", suitable: "金融、咨询、商务与管理", methodologyId: "finance_business", sourceName: "modern-cv", sourceUrl: "https://typst.app/universe/package/modern-cv/", license: "MIT", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.46, pageMargin: 40, accentColor: "#8a1538" } },
  { id: "basic-resume", name: "Basic Resume", description: "单栏、机器可读优先的极简简历", suitable: "ATS、国企与海投", methodologyId: "general", sourceName: "basic-resume", sourceUrl: "https://typst.app/universe/package/basic-resume/", license: "Unlicense", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.48, pageMargin: 44, accentColor: "#222222" } },
  { id: "altacv", name: "AltaCV", description: "真实 JSON Resume 驱动模板，支持本地化与单双栏", suitable: "产品、运营与海外双栏", methodologyId: "product_operations", sourceName: "altacv", sourceUrl: "https://typst.app/universe/package/altacv/", license: "MIT", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.44, pageMargin: 38, accentColor: "#276e9e" } },
  { id: "vivid-cv", name: "Vivid CV", description: "横幅式专业视觉，支持多语言和可选头像", suitable: "社招形象、设计与科技岗位", methodologyId: "design_content", sourceName: "vivid-cv", sourceUrl: "https://typst.app/universe/package/vivid-cv/", license: "MIT", engine: "Typst", preset: { fontFamily: "source-han-sans", fontSize: 10, lineHeight: 1.45, pageMargin: 38, accentColor: "#06332a" } },
];

const LEGACY_TEMPLATE_MAP: Record<string, ResumeTemplateId> = {
  ats: "basic-resume", classic: "habaneraa-one-page-resume-zh", modern: "modern-cv", compact: "habaneraa-one-page-resume-zh", executive: "modern-cv", tech: "golixp-resume-zh-cn", academic: "brilliant-cv",
  billryan: "habaneraa-one-page-resume-zh", hijiangtao: "habaneraa-one-page-resume-zh", "resume-ng": "golixp-resume-zh-cn", "deedy-cn": "altacv", liweitianux: "brilliant-cv", "awesome-cv": "modern-cv", "chinese-one-column": "basic-resume", "forfrt-cn": "golixp-resume-zh-cn",
};

export function normalizeResumeTemplate(id: string | undefined): ResumeTemplateId {
  if (id && RESUME_TEMPLATE_REFERENCES.some((template) => template.id === id)) return id as ResumeTemplateId;
  return (id && LEGACY_TEMPLATE_MAP[id]) || "habaneraa-one-page-resume-zh";
}

export const RESUME_METHODS: ResumeMethodology[] = [
  {
    id: "technology",
    name: "技术 / 数据 / AI",
    keywords: ["开发", "工程师", "前端", "后端", "客户端", "算法", "数据", "ai", "人工智能", "测试", "运维", "架构", "机器学习"],
    recommendedTemplate: "golixp-resume-zh-cn",
    focus: ["技术栈与岗位要求逐项对应", "项目中的个人职责、难点和工程结果", "性能、质量、效率或业务指标"],
    sectionOrder: ["专业技能", "工作与实习经历", "项目经历", "教育经历", "获奖、证书与成果"],
    bulletRules: ["写清使用什么技术解决什么问题", "区分团队成果与个人贡献", "保留真实性能、规模、稳定性或效率数据"],
    avoid: ["只罗列技术名词", "把课程作业包装成生产项目", "没有证据的精通或专家表述"],
  },
  {
    id: "product_operations",
    name: "产品 / 运营 / 增长",
    keywords: ["产品", "运营", "增长", "用户", "市场", "内容", "活动", "社区", "品牌", "电商", "商业化"],
    recommendedTemplate: "altacv",
    focus: ["业务目标与用户问题", "策略、协作、落地过程", "转化、留存、增长和效率结果"],
    sectionOrder: ["个人优势", "工作与实习经历", "项目经历", "专业技能", "教育经历"],
    bulletRules: ["用目标—判断—动作—结果组织要点", "说明指标口径和负责边界", "优先保留与目标岗位场景一致的案例"],
    avoid: ["负责日常运营等流水账", "只写参与不写决策与动作", "堆叠热点词但没有结果"],
  },
  {
    id: "finance_business",
    name: "金融 / 咨询 / 商务",
    keywords: ["金融", "银行", "证券", "保险", "基金", "投行", "咨询", "审计", "财务", "会计", "销售", "商务", "客户经理"],
    recommendedTemplate: "modern-cv",
    focus: ["客户或业务问题", "分析框架、合规意识与专业工具", "收入、成本、风险或交付结果"],
    sectionOrder: ["个人优势", "工作与实习经历", "项目经历", "教育经历", "证书与成果", "专业技能"],
    bulletRules: ["采用行动—分析方法—业务结果", "证书与硬性资质使用准确名称", "客户、金额等敏感信息需脱敏"],
    avoid: ["花哨双栏和技能进度条", "泛泛自我评价", "没有依据的客户规模与收入数据"],
  },
  {
    id: "design_content",
    name: "设计 / 内容 / 创意",
    keywords: ["设计", "视觉", "交互", "ux", "ui", "创意", "文案", "编导", "视频", "新媒体", "作品集"],
    recommendedTemplate: "vivid-cv",
    focus: ["3—4 个最能代表能力的项目", "项目背景、目标、思考过程、角色与结果", "清晰可访问的作品集链接"],
    sectionOrder: ["个人优势", "项目经历", "工作与实习经历", "专业技能", "教育经历", "作品与成果"],
    bulletRules: ["写清设计判断而不只是交付物", "说明本人角色和协作边界", "用用户反馈或业务结果验证方案"],
    avoid: ["让简历本身过度装饰", "无上下文堆砌软件名称", "用大图挤占正文信息"],
  },
  {
    id: "academic_research",
    name: "科研 / 教育 / 学术",
    keywords: ["研究", "科研", "博士", "硕士", "实验室", "论文", "教师", "教育", "高校", "课题", "学术"],
    recommendedTemplate: "brilliant-cv",
    focus: ["教育背景、研究方向与方法", "论文、课题、专利和可核验成果", "研究职责、贡献与学术影响"],
    sectionOrder: ["教育经历", "研究与项目经历", "论文、专利与成果", "教学或工作经历", "专业技能"],
    bulletRules: ["论文与项目使用统一引用格式", "明确作者顺序、状态和本人贡献", "区分已发表、录用、投稿与在研"],
    avoid: ["混淆论文状态", "省略本人贡献", "使用商务化夸张表述"],
  },
  {
    id: "manufacturing_supply_chain",
    name: "制造 / 工程 / 供应链",
    keywords: ["制造", "工艺", "机械", "电气", "自动化", "质量", "生产", "供应链", "采购", "物流", "设备", "工程管理"],
    recommendedTemplate: "golixp-resume-zh-cn",
    focus: ["工艺、设备、质量或交付问题", "标准、工具、跨部门协作与改善动作", "良率、成本、周期、安全和产能结果"],
    sectionOrder: ["专业技能", "工作与实习经历", "项目经历", "教育经历", "证书与成果"],
    bulletRules: ["交代生产或工程场景与约束", "写清本人负责的分析和改善动作", "保留可核验的良率、节拍、成本或交期数据"],
    avoid: ["只写服从安排和日常巡检", "混用未经掌握的工程标准", "泄露客户与产线敏感信息"],
  },
  {
    id: "healthcare_life_science",
    name: "医疗 / 医药 / 生命科学",
    keywords: ["医疗", "医药", "药品", "临床", "生物", "医院", "护理", "医学", "器械", "药学", "健康"],
    recommendedTemplate: "brilliant-cv",
    focus: ["专业资质、研究或临床相关背景", "合规流程、方法与本人职责", "质量、效率、患者或业务结果"],
    sectionOrder: ["教育经历", "证书与资质", "工作与实习经历", "研究与项目经历", "专业技能"],
    bulletRules: ["准确区分执业资质与培训经历", "研究与临床数据注明真实范围", "说明合规、伦理或质量体系下的工作"],
    avoid: ["暗示不存在的执业资格", "暴露患者隐私", "夸大研究结论或治疗效果"],
  },
  {
    id: "hr_legal_administration",
    name: "人力 / 法务 / 行政职能",
    keywords: ["人力", "招聘", "hr", "法务", "法律", "行政", "合规", "政府", "公共事务", "秘书", "组织发展"],
    recommendedTemplate: "modern-cv",
    focus: ["制度、流程和服务对象", "沟通协调、风险判断与推进动作", "招聘、交付、合规或组织效率结果"],
    sectionOrder: ["个人优势", "工作与实习经历", "项目经历", "教育经历", "证书与成果", "专业技能"],
    bulletRules: ["说明服务规模和本人负责范围", "将协调工作写成明确动作与结果", "法务合规内容写清事项类型和风险处理"],
    avoid: ["只写沟通能力强", "罗列事务但没有优先级和结果", "泄露员工或案件隐私"],
  },
  {
    id: "general",
    name: "通用 / 校招",
    keywords: [],
    recommendedTemplate: "habaneraa-one-page-resume-zh",
    focus: ["与岗位直接相关的教育、经历和技能", "一页内优先呈现最强证据", "联系方式与求职方向清楚"],
    sectionOrder: ["教育经历", "工作与实习经历", "项目经历", "获奖、证书与成果", "专业技能", "个人优势"],
    bulletRules: ["每条使用动作—方法—真实结果", "每段经历保留 2—4 条强要点", "日期统一为 YYYY.MM—YYYY.MM"],
    avoid: ["照片、年龄、婚育等非必要信息", "技能星级或进度条", "空泛自我评价和未经证实的数字"],
  },
];

function searchableJob(job: unknown) {
  if (!job || typeof job !== "object") return "";
  const record = job as Record<string, unknown>;
  return [record.title, record.company, record.description, record.summary, record.content]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function resolveResumeMethodology(job: unknown) {
  const content = searchableJob(job);
  const title = job && typeof job === "object" ? String((job as Record<string, unknown>).title || "").toLowerCase() : "";
  const ranked = RESUME_METHODS.filter((method) => method.id !== "general").map((method) => ({
    method,
    score: method.keywords.reduce((score, keyword) => {
      const token = keyword.toLowerCase();
      if (!content.includes(token)) return score;
      return score + (title.includes(token) ? 5 : 1) + Math.min(token.length, 4) / 10;
    }, 0),
  })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].method : RESUME_METHODS.find((method) => method.id === "general")!;
}

export function getResumeTemplate(id: string | undefined) {
  return RESUME_TEMPLATE_REFERENCES.find((template) => template.id === normalizeResumeTemplate(id)) || RESUME_TEMPLATE_REFERENCES[0];
}

export function getResumeTemplatePreset(id: string | undefined): ResumeTemplatePreset {
  return { ...getResumeTemplate(id).preset };
}

export function normalizeResumeSection(type: string) {
  if (/个人优势|职业概述|简介|摘要/.test(type)) return "个人优势";
  if (/专业技能|能力|技能/.test(type)) return "专业技能";
  if (/教育|学校|学历/.test(type)) return "教育经历";
  if (/工作|实习|任职/.test(type)) return "工作与实习经历";
  if (/研究|科研|课题/.test(type)) return "研究与项目经历";
  if (/项目/.test(type)) return "项目经历";
  if (/论文|专利|出版/.test(type)) return "论文、专利与成果";
  if (/证书|资质/.test(type)) return "证书与资质";
  if (/成果|奖项|获奖|作品/.test(type)) return "获奖、证书与成果";
  return "其他经历";
}

export function resumeDateRank(date: string | undefined) {
  const value = String(date || "").trim();
  if (/至今|现在|present|current/i.test(value)) return 999999;
  const matches = [...value.matchAll(/((?:19|20)\d{2})(?:[.\-/年](\d{1,2}))?/g)];
  if (!matches.length) return 0;
  const latest = matches[matches.length - 1];
  return Number(latest[1]) * 100 + Math.max(1, Math.min(12, Number(latest[2]) || 12));
}

export function sortResumeEntries<T extends { type: string; date?: string }>(entries: T[], structure: ResumeStructureDecision) {
  const sectionRank = (type: string) => {
    const index = structure.sectionOrder.indexOf(normalizeResumeSection(type));
    return index < 0 ? 99 : index;
  };
  return [...entries].sort((a, b) => sectionRank(a.type) - sectionRank(b.type) || resumeDateRank(b.date) - resumeDateRank(a.date));
}

function materialRecords(materials: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(materials)) return materials.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (!materials || typeof materials !== "object") return [];
  const record = materials as Record<string, unknown>;
  const nested = Array.isArray(record.experiences) ? record.experiences : Array.isArray(record.archives) ? record.archives : [];
  return nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function workMonths(materials: Array<Record<string, unknown>>) {
  const currentYear = new Date().getFullYear();
  return materials.filter((item) => /工作|实习|任职/.test(String(item.type || ""))).reduce((total, item) => {
    const date = String(item.date || "");
    const years = [...date.matchAll(/(?:19|20)\d{2}/g)].map((match) => Number(match[0]));
    if (!years.length) return total;
    const start = years[0];
    const end = /至今|现在|present/i.test(date) ? currentYear : years[1] || start;
    return total + Math.max(3, (end - start) * 12 + (years.length > 1 ? 1 : 6));
  }, 0);
}

export function resolveResumeStructure(job: unknown, materials?: unknown): ResumeStructureDecision {
  const method = resolveResumeMethodology(job);
  const records = materialRecords(materials);
  const currentYear = new Date().getFullYear();
  const education = records.filter((item) => /教育|学校|学历/.test(String(item.type || "")));
  const currentOrRecentEducation = education.some((item) => {
    const text = `${String(item.date || "")} ${String(item.description || "")} ${String(item.subtitle || "")}`;
    const years = [...text.matchAll(/(?:19|20)\d{2}/g)].map((match) => Number(match[0]));
    return /在读|应届|至今|现在|present/i.test(text) || years.some((year) => year >= currentYear - 2);
  });
  const months = workMonths(records);
  const academicJob = method.id === "academic_research" || /博士|博士后|研究员|高校教师|科研/.test(searchableJob(job));
  const educationGate = /(?:学历|学位|专业)(?:要求|限制|优先)|相关专业|对口专业|985|211|双一流|硕士及以上|博士/.test(searchableJob(job));
  const credentialGate = /执业|资格证|持证|cpa|cfa|教师资格|法律职业资格|医师资格|护士资格/.test(searchableJob(job));
  const stage: ResumeCareerStage = academicJob ? "academic" : currentOrRecentEducation && months < 24 ? "student_recent" : months >= 36 ? "experienced" : "early_career";
  const stageLabel = { student_recent: "在校生 / 应届及近两年毕业", early_career: "职场早期（约 0—3 年）", experienced: "有经验候选人（约 3 年以上）", academic: "科研 / 学术申请" }[stage];
  const technical = ["technology", "manufacturing_supply_chain"].includes(method.id);
  const portfolioLed = method.id === "design_content";
  const regulated = method.id === "healthcare_life_science" || credentialGate;
  let stageOrder: string[];
  if (stage === "academic") {
    stageOrder = ["教育经历", "个人优势", "研究与项目经历", "论文、专利与成果", "工作与实习经历", "证书与资质", "专业技能"];
  } else if (stage === "student_recent") {
    stageOrder = portfolioLed
      ? ["教育经历", "项目经历", "工作与实习经历", "专业技能", "获奖、证书与成果", "个人优势"]
      : ["教育经历", "工作与实习经历", "项目经历", "研究与项目经历", "专业技能", "获奖、证书与成果", "个人优势"];
  } else if (regulated) {
    stageOrder = ["个人优势", "证书与资质", "教育经历", "工作与实习经历", "研究与项目经历", "项目经历", "专业技能"];
  } else if (portfolioLed) {
    stageOrder = ["个人优势", "项目经历", "工作与实习经历", "专业技能", "教育经历", "获奖、证书与成果"];
  } else if (technical) {
    stageOrder = ["个人优势", "专业技能", "工作与实习经历", "项目经历", "研究与项目经历", "教育经历", "获奖、证书与成果"];
  } else {
    stageOrder = ["个人优势", "工作与实习经历", "项目经历", "专业技能", "教育经历", "获奖、证书与成果"];
  }
  if (educationGate && stage !== "student_recent" && stage !== "academic" && !regulated) {
    stageOrder = stageOrder.filter((section) => section !== "教育经历");
    stageOrder.splice(Math.min(2, stageOrder.length), 0, "教育经历");
  }
  const sectionOrder = [...stageOrder, ...method.sectionOrder.map(normalizeResumeSection), "其他经历"].filter((section, index, values) => values.indexOf(section) === index);
  const reason = stage === "student_recent"
    ? "教育背景是当前最强身份信号，因此放在正文首段；实习和项目随后证明岗位能力。"
    : stage === "academic"
      ? "学历、研究方向和学术成果是核心筛选依据，因此教育与研究内容优先。"
      : stage === "experienced"
        ? educationGate
          ? "招聘方先判断近期工作成果，同时岗位存在明确学历或专业筛选，教育经历紧随核心经历展示。"
          : "招聘方优先判断近期工作成果，教育经历移到工作与项目之后。"
        : "先展示职业定位和相关经历，同时保留教育背景作为早期职业阶段的重要证据。";
  return {
    stage,
    stageLabel,
    sectionOrder,
    reason,
    rules: [
      ...CHINESE_ONE_PAGE_RESUME_RULES,
      ...FIRST_GENERATION_QUALITY_GATES,
      "不把求职状态、年龄、性别放入简历正文。",
      "当前/最近经历优先，弱相关经历可以缩短但不能伪造。",
      "专业技能的位置取决于岗位：技术/工程岗位可前置；运营、商务和职能岗位通常放在经历之后或摘要之后。",
      "奖项、证书、作品只在与岗位有关或具有明确含金量时独立成节，否则合并到教育或成果章节。",
      "默认一页 A4；科研、论文较多或十年以上经验可使用两页，但第一页必须包含最强岗位证据。",
    ],
  };
}

export function getResumeKnowledgeContext(job: unknown, materials?: unknown) {
  const method = resolveResumeMethodology(job);
  const structure = resolveResumeStructure(job, materials);
  return `【工作台简历方法库：${method.name}】\n候选人阶段判断：${structure.stageLabel}。\n最终章节顺序：${structure.sectionOrder.join(" → ")}。\n顺序原因：${structure.reason}\n结构硬规则：${structure.rules.join("；")}。\n行业重点：${method.focus.join("；")}。\n要点写法：${method.bulletRules.join("；")}。\n避免：${method.avoid.join("；")}。\n版式来源：工作台只使用已打包的真实 Typst 开源模板源码（中文一页简历、中文模块化简历、Bone Resume、Brilliant CV、Modern CV、Basic Resume、AltaCV、Vivid CV）；只学习其章节层级和信息密度，不复制任何示例中的个人内容。\n通用版式：通常控制为 1 页 A4（科研或十年以上经验可 2 页）；正文约 10—10.5pt、行距 1.45—1.55；不用技能进度条；不添加档案中不存在的事实。`;
}
