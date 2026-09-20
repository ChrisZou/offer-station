import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const port = Number(process.env.TYPST_COMPILER_PORT || 8791);
const root = resolve(import.meta.dirname, "../apps/web/typst");
const packagePath = join(root, "packages");
const fontPath = join(root, "fonts");

function quote(value) {
  return JSON.stringify(String(value || "").replace(/\r?\n/g, " "));
}

function content(value) {
  return `[${String(value || "").replace(/[[@\\]/g, "\\$&").replace(/\r?\n/g, " ")}]`;
}

function bullets(items = []) {
  return items.map((item) => `- ${String(item).replace(/\r?\n/g, " ")}`).join("\n");
}

function grouped(resume) {
  const groups = new Map();
  for (const entry of resume.experiences || []) {
    const label = entry.type || "经历";
    groups.set(label, [...(groups.get(label) || []), entry]);
  }
  return groups;
}

function typedEntries(resume, entry) {
  return `#resume-entry(title: ${quote(entry.title)}, subtitle: ${quote(entry.subtitle)}, date: ${quote(entry.date)})[\n${bullets(entry.bullets)}\n]`;
}

function habaneraaSections(resume) {
  const sections = [];
  if (resume.summary) sections.push(`// SECTION: 个人优势 — 只写 2—3 行岗位匹配概述，不放任职经历、项目或教育详情。\n= 个人优势\n${content(resume.summary)}`);
  for (const [name, entries] of grouped(resume)) {
    sections.push(`// SECTION: ${name} — 此处只放 ${name}，每条经历使用 resume-entry。\n= ${name}\n${entries.map((entry) => typedEntries(resume, entry)).join("\n")}`);
  }
  if (resume.skills?.length) sections.push(`// SECTION: 专业技能 — 仅放技能关键词，不放经历描述。\n= 专业技能\n${resume.skills.map(content).join(" · ")}`);
  if (resume.layoutAppendText?.length) sections.push(`// SECTION: 用户明确要求的版式附加文字 — 仅用于直接文字编辑，不作为简历事实。\n${resume.layoutAppendText.map(content).join("\n")}`);
  return sections.join("\n\n");
}

function simpleSections(resume) {
  const sections = [];
  if (resume.summary) sections.push(`== 个人优势\n${content(resume.summary)}`);
  for (const [name, entries] of grouped(resume)) {
    sections.push(`== ${name}\n${entries.map((entry) => `*${entry.title}*　${entry.subtitle}　${entry.date}\n${bullets(entry.bullets)}`).join("\n\n")}`);
  }
  if (resume.skills?.length) sections.push(`== 专业技能\n${resume.skills.map((item) => content(item)).join(" · ")}`);
  if (resume.layoutAppendText?.length) sections.push(resume.layoutAppendText.map(content).join("\n"));
  return sections.join("\n\n");
}

function sourceFor(template, resume) {
  const person = resume.personalInfo || {};
  const name = person.name || "姓名待补充";
  const phone = person.phone || "";
  const email = person.email || "";
  const city = person.city || "";
  const headline = resume.headline || resume.targetRole || "求职意向";
  const entries = resume.experiences || [];
  const elementSpaciness = Math.min(1.5, Math.max(0.9, Number(resume.design?.elementSpaciness) || 1.05));
  if (template === "habaneraa-one-page-resume-zh") return `#import "@preview/habaneraa-one-page-resume-zh:0.1.0": setup-styles
#let (resume-header, resume-entry) = setup-styles(accent-color: rgb("#179299"), font-size: 10pt, element-spaciness: ${elementSpaciness.toFixed(2)})
#show: resume-header.with(author: ${quote(name)}, basic-info: (${[headline, city].filter(Boolean).map(content).join(", ")},), telephone: ${quote(phone)}, email: ${quote(email)})
// TEMPLATE CONTRACT: Keep the import, setup-styles and resume-header unchanged.
// Edit content only inside the labeled SECTION blocks below.
${habaneraaSections(resume)}`;

  if (template === "bone-resume") return `#import "@preview/bone-resume:0.3.1": resume-init, resume-section
#show: resume-init.with(author: ${quote(name)})
= ${headline}
${content(resume.summary)}
${entries.map((entry) => `#resume-section(${content(entry.title + " · " + entry.subtitle)}, ${quote(entry.date)})[\n${bullets(entry.bullets)}\n]`).join("\n")}
= 专业技能
${(resume.skills || []).map(content).join(" · ")}`;

  if (template === "altacv") return `#import "@preview/altacv:1.6.0": alta
#let cv = (basics: (name: ${quote(name)}, label: ${quote(headline)}, summary: ${content(resume.summary)}, email: ${quote(email)}, phone: ${quote(phone)}, location: ${quote(city)}), work: (${entries.map((entry) => `(name: ${quote(entry.subtitle)}, position: ${quote(entry.title)}, startDate: ${quote(entry.date)}, highlights: (${entry.bullets.map(content).join(",")},))`).join(",")},), skills: ((name: "专业技能", keywords: (${(resume.skills || []).map(quote).join(",")},)),))
#alta(cv, preferences: (imagePosition: "center", font: "Noto Sans CJK SC"))`;

  if (template === "vivid-cv" || template === "basic-resume") {
    const pkg = template === "vivid-cv" ? "vivid-cv:0.1.1" : "basic-resume:0.2.9";
    const title = template === "vivid-cv" ? `title: ${quote(headline)}, ` : "";
    return `#import "@preview/${pkg}": *
#show: resume.with(author: ${quote(name)}, ${title}location: ${quote(city)}, email: ${quote(email)}, phone: ${quote(phone)}, ${template === "vivid-cv" ? "show-photo: false, " : ""}font: "Noto Sans CJK SC", ${template === "vivid-cv" ? "lang: \"zh\"" : ""})
${simpleSections(resume)}`;
  }

  // The remaining packages expose their own full layout engines.  We import
  // the genuine package source and keep the content as Typst-native sections;
  // this provides a safe fallback while package-specific mappings evolve.
  const spec = { "golixp-resume-zh-cn": "golixp-resume-zh-cn:0.1.2", "brilliant-cv": "brilliant-cv:4.1.0", "modern-cv": "modern-cv:0.10.0" }[template];
  return `#import "@preview/${spec}": *
#set text(font: "Noto Sans CJK SC", size: 10pt)
#align(center)[#text(size: 22pt, weight: "bold")[${name}]]
#align(center)${content([headline, phone, email].filter(Boolean).join(" · "))}
${resume.summary ? `== 个人优势\n${content(resume.summary)}` : ""}
${entries.map((entry) => `== ${entry.type}\n*${entry.title}*　${entry.subtitle}　${entry.date}\n${bullets(entry.bullets)}`).join("\n\n")}
== 专业技能
${(resume.skills || []).map(content).join(" · ")}`;
}

function compile(directory) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("typst", ["compile", "--font-path", fontPath, join(directory, "resume.typ"), join(directory, "resume.pdf")], {
      env: { ...process.env, TYPST_PACKAGE_PATH: packagePath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise(log) : reject(new Error(log || "Typst 编译失败")));
  });
}

function renderPreview(directory) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.env.PDFTOPPM_BIN || "pdftoppm", ["-f", "1", "-singlefile", "-png", "-r", "150", join(directory, "resume.pdf"), join(directory, "preview")], { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise(log) : reject(new Error(log || "预览渲染失败")));
  });
}

createServer(async (request, response) => {
  const cors = { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  const preview = request.url === "/compile?format=preview";
  const sourceRequest = request.url === "/source";
  if (request.method === "OPTIONS" && (request.url === "/compile" || preview || sourceRequest)) { response.writeHead(204, cors).end(); return; }
  if (request.method !== "POST" || (request.url !== "/compile" && !preview && !sourceRequest)) { response.writeHead(404, cors).end(); return; }
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", async () => {
    let directory;
    try {
      const payload = JSON.parse(body);
      if (!payload?.template || (!payload?.resume && !payload?.source)) throw new Error("缺少模板或简历数据");
      const source = typeof payload.source === "string" && payload.source.trim() ? payload.source.trim() : sourceFor(payload.template, payload.resume);
      if (sourceRequest) {
        response.writeHead(200, { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ source }));
        return;
      }
      directory = await mkdtemp(join(tmpdir(), "job-workbench-typst-"));
      await writeFile(join(directory, "resume.typ"), source, "utf8");
      await compile(directory);
      if (preview) {
        await renderPreview(directory);
        const png = await readFile(join(directory, "preview.png"));
        response.writeHead(200, { ...cors, "Content-Type": "image/png", "Content-Length": png.length, "Cache-Control": "no-store" });
        response.end(png);
      } else {
        const pdf = await readFile(join(directory, "resume.pdf"));
        response.writeHead(200, { ...cors, "Content-Type": "application/pdf", "Content-Length": pdf.length, "Cache-Control": "no-store" });
        response.end(pdf);
      }
    } catch (error) {
      response.writeHead(422, { ...cors, "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 1200) : "Typst 编译失败" }));
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
}).listen(port, "127.0.0.1", () => console.log(`Typst resume compiler listening on http://127.0.0.1:${port}`));
