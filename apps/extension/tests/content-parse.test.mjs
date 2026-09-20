import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../content.js", import.meta.url), "utf8");
const panelHtml = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");
const panelScript = await readFile(new URL("../sidepanel.js", import.meta.url), "utf8");
const panelCss = await readFile(new URL("../sidepanel.css", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const workbenchSync = await readFile(new URL("../workbench-sync.js", import.meta.url), "utf8");
const backgroundScript = await readFile(new URL("../background.js", import.meta.url), "utf8");

function element({ text = "", src = "", alt = "", className = "", width = 0, height = 0 } = {}) {
  return {
    textContent: text,
    currentSrc: src,
    src,
    naturalWidth: width,
    naturalHeight: height,
    parentElement: null,
    getAttribute(name) { return name === "alt" ? alt : name === "class" ? className : name === "title" ? "" : null; },
    closest() { return null; },
  };
}

function createContext() {
  const title = element({ text: "具身智能、世界模型科研助理/实习生" });
  const salary = element({ text: "80-100元/天" });
  const location = element({ text: "杭州" });
  const limit = element({ text: "5天/周 3个月 · 本科" });
  const description = element({ text: "浙江大学人工智能学院招聘科研助理/实习生。" });
  const companyLink = element({ text: "浙江大学" });
  const companyLogo = element({ text: "", src: "https://img.bosszhipin.com/zju.png", alt: "浙江大学", className: "company-logo", width: 120, height: 120 });
  companyLogo.closest = () => companyLink;
  const mapImage = element({ src: "https://img.bosszhipin.com/static-map.png", alt: "公司地图", className: "map-image", width: 300, height: 180 });
  const companyCard = {
    textContent: "公司基本信息 浙江大学 不需要融资 计算机软件 查看全部职位",
    parentElement: null,
    closest() { return null; },
    querySelector(selector) {
      if (selector.includes("/gongsi/") || selector.includes("/company/")) return companyLink;
      if (selector.includes("company-name") || selector.includes("companyName")) return companyLink;
      return null;
    },
    querySelectorAll(selector) { return selector === "img" ? [mapImage, companyLogo] : []; },
  };
  const companyHeading = element({ text: "公司基本信息" });
  companyHeading.parentElement = companyCard;
  const structured = element({ text: JSON.stringify({
    "@type": "JobPosting",
    title: "具身智能、世界模型科研助理/实习生",
    hiringOrganization: { "@type": "Organization", name: "华为", logo: "https://example.com/huawei.png" },
  }) });

  const single = new Map([
    [".job-name", title], [".job-primary .salary", salary], [".job-location", location],
    [".job-primary .job-limit", limit], [".job-sec-text", description],
  ]);
  const document = {
    querySelector(selector) { return single.get(selector) || null; },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') return [structured];
      if (selector === "h1,h2,h3") return [companyHeading];
      return [];
    },
    getElementById() { return null; },
    addEventListener() {},
    documentElement: { append() {} },
  };
  const chrome = {
    runtime: { id: "test-extension", getURL: (path) => path, onMessage: { addListener() {} } },
    storage: {
      local: { get: async () => ({ displayMode: "sidepanel" }), set: async () => {} },
      onChanged: { addListener() {} },
    },
  };
  const context = vm.createContext({ document, chrome, location: { hostname: "www.zhipin.com", href: "https://www.zhipin.com/job_detail/test.html" }, window: { addEventListener() {} }, console, URL, setTimeout, clearTimeout, Promise });
  vm.runInContext(source, context);
  return context;
}

test("pairs the company name and logo from the current company card", () => {
  const result = createContext().parseCurrentJob();
  assert.equal(result.recognized, true);
  assert.equal(result.job.title, "具身智能、世界模型科研助理/实习生");
  assert.equal(result.job.company, "浙江大学");
  assert.equal(result.job.companyLogoUrl, "https://img.bosszhipin.com/zju.png");
  assert.notEqual(result.job.company, "华为");
  assert.doesNotMatch(result.job.companyLogoUrl, /map/);
});

test("uses the default floating size and a real workbench matching flow", () => {
  assert.match(source, /floatingWidgetSizeV3/);
  assert.match(source, /const width = floatingSize\?\.width \|\| Math\.min\(420,/);
  assert.match(source, /const height = floatingSize\?\.height \|\| Math\.min\(620,/);
  assert.match(panelHtml, /id="match-card"/);
  assert.match(panelHtml, /id="run-match"/);
  assert.match(panelHtml, /class="role-summary"/);
  assert.match(panelHtml, /id="job-summary"/);
  assert.doesNotMatch(panelHtml, /data-field="jobDescription"/);
  assert.match(panelScript, /async function runMatch\(job\)/);
  assert.match(panelScript, /chrome\.tabs\.query\(\{\}\)/);
  assert.match(panelScript, /setMatchFeedback/);
  assert.match(panelScript, /function updateAvatar\(\)/);
  assert.match(panelScript, /personalInfo\.newValue/);
  assert.match(panelHtml, /id="match-feedback"/);
  assert.match(panelHtml, /id="auto-match"/);
  assert.match(panelHtml, /class="ability-requirements"/);
  assert.match(panelHtml, /id="ability-loading"/);
  assert.doesNotMatch(panelHtml, /id="local-signals"/);
  assert.doesNotMatch(panelHtml, /id="job-requirements"/);
  assert.match(panelHtml, /id="ability-comparison"/);
  assert.match(panelHtml, /岗位能力对照/);
  assert.doesNotMatch(panelHtml, /data-field="skillTags"/);
  assert.match(panelHtml, />访<\/button>/);
  assert.match(panelCss, /\.recent-empty/);
  assert.match(panelScript, /\/api\/ai\/job-analysis/);
  assert.match(panelScript, /chrome\.storage\.session\.get\("aiApiKey"\)/);
  assert.match(panelScript, /matchCard\.classList\.add\("analyzed"\)/);
  assert.match(panelCss, /\.match-card\.analyzed/);
  assert.match(panelCss, /\.ability-row\.missing/);
  assert.match(panelCss, /\.requirement-group/);
  assert.match(panelScript, /if \(state\.autoMatch\) void runMatch\(job\)/);
  assert.match(panelScript, /mode: "compact"/);
  assert.match(panelScript, /function compactProfile\(profile\)/);
  assert.match(panelScript, /function renderLocalPreview\(job\)/);
  assert.match(source, /IS_ACTIVE_ANALYSIS_TAB/);
  assert.match(source, /ANALYSIS_ACTIVITY_CHANGED/);
  assert.match(backgroundScript, /lastFocusedWindow: true/);
  assert.doesNotMatch(panelScript, /jobAnalyses: state\.analyses/);
  assert.equal(manifest.version, "0.10.2");
  assert.match(workbenchSync, /SYNC_WORKBENCH_CONTEXT/);
  assert.match(workbenchSync, /GET_WORKBENCH_CONTEXT/);
  assert.match(backgroundScript, /localWorkspaceId/);
  assert.match(workbenchSync, /job-workbench\.ai-profile/);
  assert.match(workbenchSync, /window\.localStorage\.getItem\(API_KEY_STORAGE\)/);
  assert.match(backgroundScript, /inactive_workbench_origin/);
  assert.match(backgroundScript, /injectWorkbenchSyncIntoOpenTabs/);
  assert.match(backgroundScript, /chrome\.scripting\.executeScript/);
  assert.match(backgroundScript, /REFRESH_WORKBENCH_SYNC/);
  assert.match(panelScript, /readSyncedAiContext/);
  assert.match(workbenchSync, /__jobWorkbenchSyncActive/);
  assert.match(workbenchSync, /plugin-sync-status/);
  assert.match(panelScript, /chrome\.storage\.local\.remove\("jobAnalyses"\)/);
});
