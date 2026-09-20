"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IoBriefcaseOutline, IoCheckmarkCircleOutline, IoCheckmarkOutline, IoCloseOutline,
  IoCreateOutline, IoLinkOutline, IoLocationOutline, IoMailOutline, IoPersonOutline,
  IoPhonePortraitOutline, IoWalletOutline,
} from "react-icons/io5";

type FieldGroup = "求职信息" | "个人基础信息";
type Field = { id: string; label: string; placeholder: string; group: FieldGroup; type?: string; required?: boolean; icon?: typeof IoPersonOutline };

const fields: Field[] = [
  { id: "name", label: "姓名", placeholder: "请输入真实姓名", group: "求职信息", required: true, icon: IoPersonOutline },
  { id: "targetRole", label: "岗位方向", placeholder: "例如：产品经理、AI 产品、用户增长（可填写多个）", group: "求职信息", icon: IoBriefcaseOutline },
  { id: "targetCity", label: "期望城市", placeholder: "例如：杭州 / 上海", group: "求职信息", icon: IoLocationOutline },
  { id: "salary", label: "期望薪资", placeholder: "例如：20–30K", group: "求职信息", icon: IoWalletOutline },
  { id: "phone", label: "手机号码", placeholder: "请输入常用手机号", group: "个人基础信息", icon: IoPhonePortraitOutline },
  { id: "email", label: "邮箱", placeholder: "请输入求职邮箱", group: "个人基础信息", type: "email", icon: IoMailOutline },
  { id: "gender", label: "性别", placeholder: "选填", group: "个人基础信息" },
  { id: "birthday", label: "出生年月", placeholder: "例如：1999年8月", group: "个人基础信息" },
  { id: "city", label: "现居城市", placeholder: "例如：杭州", group: "个人基础信息", icon: IoLocationOutline },
  { id: "experience", label: "工作年限", placeholder: "例如：3年", group: "个人基础信息", icon: IoBriefcaseOutline },
  { id: "status", label: "求职状态", placeholder: "例如：在职看机会", group: "个人基础信息" },
  { id: "availability", label: "到岗时间", placeholder: "例如：一个月内", group: "个人基础信息" },
  { id: "wechat", label: "微信", placeholder: "选填", group: "个人基础信息" },
  { id: "portfolio", label: "作品集", placeholder: "https://", group: "个人基础信息", type: "url", icon: IoLinkOutline },
  { id: "github", label: "GitHub", placeholder: "https://github.com/", group: "个人基础信息", type: "url", icon: IoLinkOutline },
  { id: "website", label: "个人网站", placeholder: "https://", group: "个人基础信息", type: "url", icon: IoLinkOutline },
  { id: "linkedin", label: "LinkedIn", placeholder: "个人主页链接", group: "个人基础信息", type: "url", icon: IoLinkOutline },
];

const initialValues: Record<string, string> = {};

const jobFieldIds = new Set(["name", "targetRole", "targetCity", "salary"]);
const initialVisible = new Set(["name", "targetRole", "targetCity", "salary", "phone", "email"]);
const personalInfoKey = "job-workbench.personal-info";

export default function ProfilePersonalInfo() {
  const [values, setValues] = useState(initialValues);
  const [visible, setVisible] = useState(initialVisible);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const optionalCount = fields.filter((field) => field.group === "个人基础信息" && visible.has(field.id)).length;
  const completed = useMemo(() => fields.filter((field) => visible.has(field.id) && values[field.id]?.trim()).length, [values, visible]);
  const visibleCount = fields.filter((field) => visible.has(field.id)).length;

  useEffect(() => {
    const restore = (incoming?: { values?: Record<string, string>; visible?: string[] }) => {
      try {
        const saved = incoming ?? JSON.parse(window.localStorage.getItem(personalInfoKey) || "null") as { values?: Record<string, string>; visible?: string[] } | null;
        if (saved?.values) setValues(saved.values);
        if (saved?.visible) setVisible(new Set([...saved.visible, ...jobFieldIds]));
      } catch { /* 保持空白新用户状态 */ }
    };
    const timer = window.setTimeout(() => restore(), 0);
    const update = (event: Event) => restore((event as CustomEvent<{ values?: Record<string, string>; visible?: string[] }>).detail);
    const openEditor = () => setEditing(true);
    window.addEventListener("job-workbench:personal-info-updated", update);
    window.addEventListener("job-workbench:edit-personal-info", openEditor);
    return () => { window.clearTimeout(timer); window.removeEventListener("job-workbench:personal-info-updated", update); window.removeEventListener("job-workbench:edit-personal-info", openEditor); };
  }, []);

  function toggleField(field: Field) {
    if (field.required) return;
    setVisible((current) => { const next = new Set(current); if (next.has(field.id)) next.delete(field.id); else next.add(field.id); return next; });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const detail = { values, visible: [...visible] };
    window.localStorage.setItem(personalInfoKey, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("job-workbench:personal-info-updated", { detail }));
    setEditing(false);
    setNotice("个人信息已更新");
    window.setTimeout(() => setNotice(""), 2200);
  }

  const displayFields = fields.filter((field) => ["targetRole", "targetCity", "salary"].includes(field.id));

  return <>
    <section className="personal-info-panel">
      <div className="personal-summary">
        <span className="personal-avatar">{values.name?.trim().slice(0, 1) || "访"}</span>
        <div><div className="personal-name"><h2>{values.name || "待填写姓名"}</h2>{values.name && values.targetRole && values.targetCity && <span><IoCheckmarkCircleOutline /> 求职信息已填写</span>}</div><p>{values.targetRole || "填写岗位方向"} · {values.targetCity || "填写期望城市"}</p><div className="personal-contact"><span><IoPhonePortraitOutline /> {values.phone || "填写手机号码"}</span><span><IoMailOutline /> {values.email || "填写邮箱"}</span><span><IoLocationOutline /> {values.city || "填写现居城市"}</span></div></div>
      </div>
      <div className="personal-fields-preview">{displayFields.slice(0, 6).map((field) => { const Icon = field.icon ?? IoCheckmarkOutline; return <div key={field.id}><span><Icon /></span><p>{field.label}<strong>{values[field.id] || "待填写"}</strong></p></div>; })}</div>
      <div className="personal-info-actions"><div><span>信息完整度</span><strong>{Math.round((completed / visibleCount) * 100)}%</strong></div><i><em style={{ width: `${(completed / visibleCount) * 100}%` }} /></i><small>已启用 {optionalCount} 个可选字段</small><button type="button" onClick={() => setEditing(true)}><IoCreateOutline /> 编辑求职与个人信息</button></div>
    </section>

    {editing && <div className="modal-backdrop personal-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}><form className="personal-info-modal" onSubmit={save}>
      <header><div><p className="eyebrow">求职基础资料</p><h2>编辑求职与个人信息</h2><span>先填写常用求职信息；下方个人资料可按需启用。</span></div><button type="button" aria-label="关闭" onClick={() => setEditing(false)}><IoCloseOutline /></button></header>
      <div className="personal-form-content">
        {(["求职信息", "个人基础信息"] as FieldGroup[]).map((group) => <section className={`personal-form-group ${group === "求职信息" ? "job-preference-group" : ""}`} key={group}><div className="personal-form-group-title"><div><h3>{group}</h3><p>{group === "求职信息" ? "用于岗位匹配和生成岗位专属简历" : "只保存你主动选择启用的资料"}</p></div>{group === "个人基础信息" && <span>{fields.filter((field) => field.group === group && visible.has(field.id)).length}/{fields.filter((field) => field.group === group).length} 已启用</span>}</div><div className="personal-form-grid">{fields.filter((field) => field.group === group).map((field) => { const fixed = group === "求职信息"; return <div className={`personal-form-field ${!visible.has(field.id) ? "disabled" : ""}`} key={field.id}><div className="field-heading"><label htmlFor={`personal-${field.id}`}>{field.label}{field.required && <em>必填</em>}</label>{!fixed && <button className={visible.has(field.id) ? "enabled" : ""} type="button" onClick={() => toggleField(field)} aria-label={`${visible.has(field.id) ? "停用" : "启用"}${field.label}`}><i>{visible.has(field.id) && <IoCheckmarkOutline />}</i>{visible.has(field.id) ? "已选择" : "选择填写"}</button>}</div><input id={`personal-${field.id}`} type={field.type ?? "text"} disabled={!visible.has(field.id)} required={field.required} value={values[field.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.placeholder} /></div>; })}</div></section>)}
      </div>
      <footer><p>这些资料将作为生成岗位专属简历时的默认个人信息。</p><div><button type="button" onClick={() => setEditing(false)}>取消</button><button type="submit">保存信息</button></div></footer>
    </form></div>}
    {notice && <div className="toast personal-info-toast" role="status"><IoCheckmarkCircleOutline /> {notice}</div>}
  </>;
}
