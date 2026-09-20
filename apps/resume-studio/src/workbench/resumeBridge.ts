import { cloneDeep } from 'lodash';
import { MATERIAL_JSON } from '@/schema/materialList';
import MODEL_DATA_JSON from '@/schema/modelData';
import RESUME_JSON from '@/schema/resume';
import type IRESUMEJSON from '@/interface/resume';
import maobuTemplates from './maobuTemplates.json';

export const WORKBENCH_RESUME_STORAGE = 'job-workbench.maobu-resume';
const materialJson = MATERIAL_JSON as unknown as Record<string, any[]>;
const modelDataJson = MODEL_DATA_JSON as unknown as Record<string, any>;

type WorkbenchExperience = {
  type?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  bullets?: string[];
};

export type WorkbenchResume = {
  title?: string;
  targetRole?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  experiences?: WorkbenchExperience[];
  personalInfo?: Record<string, string>;
  job?: { title?: string; company?: string };
  createdAt?: string;
};

function uuid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function splitDate(value = '') {
  const parts = value.split(/\s*(?:—|–|至|~|－|-{2,})\s*/).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[1]];
  return value ? [value, '至今'] : ['', ''];
}

function material(model: keyof typeof MATERIAL_JSON, data: Record<string, unknown>) {
  const item = cloneDeep(materialJson[model][0]);
  item.keyId = uuid();
  item.data = { ...cloneDeep(modelDataJson[model]), ...data };
  return item;
}

function mapExperience(item: WorkbenchExperience) {
  return {
    date: splitDate(item.date),
    companyName: item.subtitle || '',
    schoolName: item.subtitle || '',
    specialized: item.title || '',
    degree: '',
    majorCourse: (item.bullets || []).join('；'),
    posts: item.title || '',
    projectName: item.title || '',
    jobContent: (item.bullets || []).map((content) => ({ content })),
    projectContent: (item.bullets || []).map((content) => ({ content }))
  };
}

export function createWorkbenchResume(source?: WorkbenchResume): IRESUMEJSON {
  const draft = source || {};
  const personal = draft.personalInfo || {};
  const experiences = draft.experiences || [];
  const education = experiences.filter((item) => /教育|学历|学校/.test(item.type || ''));
  const projects = experiences.filter((item) => /项目|作品|成果/.test(item.type || ''));
  const work = experiences.filter((item) => !education.includes(item) && !projects.includes(item));

  const resume = cloneDeep(RESUME_JSON);
  resume.ID = draft.createdAt || uuid();
  resume.NAME = 'workbench';
  resume.TITLE = draft.title || `${draft.job?.title || draft.targetRole || '岗位'}定制简历`;
  resume.LAYOUT = 'classical';
  resume.GLOBAL_STYLE = {
    ...resume.GLOBAL_STYLE,
    themeColor: '#087f7a',
    fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    textFontColor: '#334155',
    secondTitleColor: '#15324b',
    pLeftRight: '42px',
    modelMarginBottom: '26px',
    resumeBackgroundCom: 'RESUME_BACKGROUND_DEFAULT'
  };

  const name = personal.name || '姓名待补充';
  resume.COMPONENTS = [
    material('BASE_INFO', {
      ...cloneDeep(MODEL_DATA_JSON.BASE_INFO),
      name,
      age: personal.age || '',
      address: personal.city || personal.location || '',
      phoneNumber: personal.phone || '',
      email: personal.email || '',
      abstract: draft.headline || draft.targetRole || '',
      degree: personal.degree || '',
      avatar: personal.avatar || '',
      isShow: {
        ...cloneDeep(MODEL_DATA_JSON.BASE_INFO.isShow),
        avatar: Boolean(personal.avatar),
        age: Boolean(personal.age),
        workService: false
      }
    }),
    material('JOB_INTENTION', {
      ...cloneDeep(MODEL_DATA_JSON.JOB_INTENTION),
      intendedPositions: draft.targetRole || draft.job?.title || '',
      intendedCity: personal.city || '',
      expectSalary: personal.expectedSalary || '',
      jobStatus: '',
      jobSearchType: ''
    }),
    ...(education.length
      ? [material('EDU_BACKGROUND', {
          ...cloneDeep(MODEL_DATA_JSON.EDU_BACKGROUND),
          LIST: education.map(mapExperience)
        })]
      : []),
    ...(work.length
      ? [material('WORK_EXPERIENCE', {
          ...cloneDeep(MODEL_DATA_JSON.WORK_EXPERIENCE),
          LIST: work.map(mapExperience)
        })]
      : []),
    ...(projects.length
      ? [material('PROJECT_EXPERIENCE', {
          ...cloneDeep(MODEL_DATA_JSON.PROJECT_EXPERIENCE),
          LIST: projects.map(mapExperience)
        })]
      : []),
    ...(draft.skills?.length
      ? [material('SKILL_SPECIALTIES', {
          ...cloneDeep(MODEL_DATA_JSON.SKILL_SPECIALTIES),
          LIST: draft.skills.map((skillName) => ({ skillName, proficiency: '', introduce: '' }))
        })]
      : []),
    ...(draft.summary
      ? [material('SELF_EVALUATION', {
          ...cloneDeep(MODEL_DATA_JSON.SELF_EVALUATION),
          title: '个人优势',
          content: draft.summary
        })]
      : [])
  ];
  return resume;
}

export const workbenchTemplatePresets = maobuTemplates;

export function applyWorkbenchTemplate(resume: IRESUMEJSON, templateIndex: number) {
  const next = cloneDeep(resume);
  const preset = maobuTemplates[templateIndex] || maobuTemplates[0];
  next.NAME = preset.id;
  next.LAYOUT = preset.layout;
  next.GLOBAL_STYLE = {
    ...next.GLOBAL_STYLE,
    ...cloneDeep(preset.globalStyle),
    fontFamily: next.GLOBAL_STYLE.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif'
  };
  next.COMPONENTS = next.COMPONENTS.map((current) => {
    const variant = preset.components.find((item) => item.model === current.model);
    if (!variant) return current;
    return {
      ...current,
      ...cloneDeep(variant),
      keyId: current.keyId || uuid(),
      data: cloneDeep(current.data),
      style: { ...current.style, ...cloneDeep(variant.style) }
    };
  });
  return next;
}

export function loadWorkbenchResume(source?: WorkbenchResume) {
  try {
    const saved = localStorage.getItem(WORKBENCH_RESUME_STORAGE);
    if (saved) {
      const parsed = JSON.parse(saved) as { createdAt?: string; resume?: IRESUMEJSON };
      if (parsed.resume && (!source?.createdAt || parsed.createdAt === source.createdAt)) return parsed.resume;
    }
  } catch {
    // 损坏的草稿使用重新生成的数据。
  }
  return createWorkbenchResume(source);
}

export function saveWorkbenchResume(resume: IRESUMEJSON, createdAt?: string) {
  localStorage.setItem(WORKBENCH_RESUME_STORAGE, JSON.stringify({ createdAt, resume }));
}
