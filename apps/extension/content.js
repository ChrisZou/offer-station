const textOf = (selectors) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element?.textContent?.replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return "";
};

const textsOf = (selectors) => {
  for (const selector of selectors) {
    const values = [...document.querySelectorAll(selector)]
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (values.length) return [...new Set(values)].slice(0, 10);
  }
  return [];
};

const imageOf = (selectors) => {
  for (const selector of selectors) {
    const image = document.querySelector(selector);
    const value = image?.currentSrc || image?.src || image?.getAttribute?.("data-src");
    if (value && /^https?:\/\//i.test(value)) return value;
  }
  return "";
};

const normalizeText = (value) => value?.replace(/\s+/g, " ").trim() || "";

function validCompanyName(value) {
  const name = normalizeText(value)
    .replace(/^(公司名称|公司信息|公司基本信息)[:：]?\s*/, "")
    .replace(/\s*(查看全部职位|在招职位.*)$/i, "")
    .trim();
  if (!name || name.length > 50) return "";
  if (/^(公司|企业|招聘中|查看(全部)?(职位)?[›>]?|暂无信息|logo)$/i.test(name)) return "";
  if (/融资|\d+\s*[-—–]\s*\d+人|\d+人以上|所属行业|公司规模|公司地址|计算机软件|企业服务/.test(name)) return "";
  return name;
}

function imageUrlOf(image) {
  const value = image?.currentSrc || image?.src || image?.getAttribute?.("data-src");
  return value && /^https?:\/\//i.test(value) ? value : "";
}

function likelyCompanyLogo(image) {
  const value = imageUrlOf(image);
  if (!value) return false;
  const clue = `${value} ${image?.getAttribute?.("alt") || ""} ${image?.getAttribute?.("class") || ""}`.toLowerCase();
  if (/map|ditu|location|address|staticmap|amap|baidu|qrcode|qr-code|banner/.test(clue)) return false;
  const width = Number(image?.naturalWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.height || 0);
  return !width || !height || Math.max(width, height) / Math.max(1, Math.min(width, height)) < 2.2;
}

function readCompanySection(section) {
  const companyLink = section.querySelector("a[href*='/gongsi/'],a[href*='/company/']");
  const nameCandidates = [
    companyLink?.textContent,
    section.querySelector("[class*='company-name']")?.textContent,
    section.querySelector("[class*='companyName']")?.textContent,
    section.querySelector("h4")?.textContent,
    section.querySelector("strong")?.textContent,
  ];
  const images = [...section.querySelectorAll("img")];
  const logo = images.find((image) => /logo/i.test(`${image.getAttribute?.("class") || ""} ${image.getAttribute?.("alt") || ""}`) && likelyCompanyLogo(image))
    || images.find((image) => image.closest?.("a[href*='/gongsi/'],a[href*='/company/']") && likelyCompanyLogo(image))
    || images.find(likelyCompanyLogo);
  nameCandidates.push(logo?.getAttribute("alt"), logo?.getAttribute("title"));
  return {
    name: nameCandidates.map(validCompanyName).find(Boolean) || "",
    logoUrl: imageUrlOf(logo),
    cardText: normalizeText(section.textContent),
  };
}

function companyFromLabeledSection() {
  const headings = [...document.querySelectorAll("h1,h2,h3")]
    .filter((element) => /^公司基本信息$|^公司信息$/.test(normalizeText(element.textContent)));
  for (const heading of headings) {
    let section = heading.parentElement;
    for (let depth = 0; section && depth < 5; depth += 1, section = section.parentElement) {
      const result = readCompanySection(section);
      if (result.name || result.logoUrl) return result;
    }
  }
  return { name: "", logoUrl: "", cardText: "" };
}

function companyFromCard() {
  const labeled = companyFromLabeledSection();
  if (labeled.name || labeled.logoUrl) return labeled;
  const cardSelectors = [
    ".job-detail-company",
    ".sider-company",
    ".company-sider",
    "[class*='company-sider']",
  ];

  for (const cardSelector of cardSelectors) {
    for (const card of document.querySelectorAll(cardSelector)) {
      if (card.closest(`#${FLOATING_HOST_ID}`)) continue;
      const result = readCompanySection(card);
      if (result.name || result.logoUrl) return result;
    }
  }
  return { name: "", logoUrl: "", cardText: "" };
}

function companyNearJobHeader() {
  return validCompanyName(textOf([
    ".job-primary [class*='company'] a[href*='/gongsi/']",
    ".job-primary [class*='company'] a[href*='/company/']",
    ".job-primary [class*='company-name']",
    "[class*='job-primary'] [class*='company-name']",
  ]));
}

function findJobPosting(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const type = value["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return value;
  return findJobPosting(value["@graph"]);
}

function readStructuredJob() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const found = findJobPosting(JSON.parse(script.textContent || "null"));
      if (found) return found;
    } catch {
      // 忽略页面中无效或无关的结构化数据。
    }
  }
  return null;
}

function structuredLogo(organization) {
  const logo = organization?.logo;
  if (typeof logo === "string" && /^https?:\/\//i.test(logo)) return logo;
  if (logo && typeof logo.url === "string" && /^https?:\/\//i.test(logo.url)) return logo.url;
  return "";
}

const FLOATING_HOST_ID = "job-workbench-floating-host";
const FLOATING_POSITION_KEY = "floatingWidgetPosition";
const FLOATING_SIZE_KEY = "floatingWidgetSizeV3";
let currentDisplayMode = "floating";
let floatingSize = null;

function extensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function getFloatingHost() {
  return document.getElementById(FLOATING_HOST_ID);
}

function setFloatingFrameLoaded(host, shouldLoad) {
  const frame = host?.shadowRoot?.querySelector("iframe");
  if (!frame || !extensionContextValid()) return;
  if (shouldLoad) {
    if (frame.dataset.loaded === "true") return;
    frame.src = chrome.runtime.getURL("sidepanel.html?mode=floating");
    frame.dataset.loaded = "true";
    return;
  }
  if (frame.dataset.loaded !== "true") return;
  frame.src = "about:blank";
  frame.dataset.loaded = "false";
}

async function refreshFloatingFrameActivity() {
  const host = getFloatingHost();
  if (!host || currentDisplayMode !== "floating" || host.style.display === "none" || document.visibilityState !== "visible") {
    setFloatingFrameLoaded(host, false);
    return;
  }
  try {
    const result = await chrome.runtime.sendMessage({ type: "IS_ACTIVE_ANALYSIS_TAB" });
    const stillEligible = currentDisplayMode === "floating" && host.style.display !== "none" && document.visibilityState === "visible";
    setFloatingFrameLoaded(host, stillEligible && result?.active === true);
  } catch {
    setFloatingFrameLoaded(host, false);
  }
}

function setFloatingExpanded(host, expanded) {
  const oldGrip = host.shadowRoot?.querySelector(".grip")?.getBoundingClientRect();
  const anchorX = oldGrip?.width ? oldGrip.left + oldGrip.width / 2 : null;
  host.dataset.expanded = expanded ? "true" : "false";
  const width = floatingSize?.width || Math.min(420, Math.max(320, window.innerWidth - 24));
  const height = floatingSize?.height || Math.min(620, Math.max(420, window.innerHeight - 24));
  const targetWidth = expanded ? width : 188;
  const targetHeight = expanded ? height : 62;
  host.style.width = `${targetWidth}px`;
  host.style.height = `${targetHeight}px`;
  host.style.minHeight = expanded ? "420px" : "0";
  host.style.minWidth = expanded ? "320px" : "0";
  const grip = host.shadowRoot?.querySelector(".grip");
  if (grip && anchorX !== null) {
    host.style.left = `${anchorX - targetWidth / 2}px`;
    host.style.right = "auto";
    grip.style.left = `${targetWidth / 2}px`;
  }
  window.requestAnimationFrame(() => {
    keepDragHandleVisible(host);
  });
}

function floatingIsOutside(host) {
  const rect = host.getBoundingClientRect();
  return rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight;
}

function keepDragHandleVisible(host) {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const halfWidth = rect.width / 2;
  const halfGrip = 18;
  const left = Math.min(Math.max(rect.left, halfGrip - halfWidth), window.innerWidth - halfGrip - halfWidth);
  const top = Math.min(Math.max(rect.top, 3), Math.max(3, window.innerHeight - 22));
  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
  host.style.right = "auto";

  const grip = host.shadowRoot?.querySelector(".grip");
  if (grip) grip.style.left = `${halfWidth}px`;
}

function resetFloatingPosition(host) {
  const rect = host.getBoundingClientRect();
  host.style.left = `${Math.max(16, window.innerWidth - rect.width - 18)}px`;
  host.style.top = "72px";
  host.style.right = "auto";
}

function enableFloatingDrag(host, surfaces) {
  for (const surface of surfaces) {
    surface.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = host.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const startX = event.clientX;
      const startY = event.clientY;
      host.dataset.dragged = "false";
      surface.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 5) host.dataset.dragged = "true";
        const width = host.getBoundingClientRect().width;
        const left = Math.min(Math.max(moveEvent.clientX - offsetX, 18 - width / 2), window.innerWidth - 18 - width / 2);
        const top = Math.min(Math.max(moveEvent.clientY - offsetY, 3), Math.max(3, window.innerHeight - 22));
        host.style.left = `${left}px`;
        host.style.top = `${top}px`;
        host.style.right = "auto";
        keepDragHandleVisible(host);
      };

      const end = () => {
        surface.removeEventListener("pointermove", move);
        const { left, top } = host.getBoundingClientRect();
        if (extensionContextValid()) void chrome.storage.local.set({ [FLOATING_POSITION_KEY]: { left, top } }).catch(() => {});
        window.setTimeout(() => { host.dataset.dragged = "false"; }, 80);
      };

      surface.addEventListener("pointermove", move);
      surface.addEventListener("pointerup", end, { once: true });
      surface.addEventListener("pointercancel", end, { once: true });
    });
  }
}

function enableFloatingResize(host, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || host.dataset.expanded !== "true") return;
    event.preventDefault();
    const rect = host.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    let animationFrame = 0;
    let pendingSize = { width: rect.width, height: rect.height };
    host.dataset.resizing = "true";
    handle.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      pendingSize = {
        width: Math.max(320, Math.min(900, rect.width + moveEvent.clientX - startX)),
        height: Math.max(420, Math.min(1000, rect.height + moveEvent.clientY - startY)),
      };
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        floatingSize = pendingSize;
        host.style.width = `${pendingSize.width}px`;
        host.style.height = `${pendingSize.height}px`;
        const label = host.shadowRoot?.querySelector(".resize-status");
        if (label) label.textContent = `${Math.round(pendingSize.width)} × ${Math.round(pendingSize.height)}`;
        keepDragHandleVisible(host);
      });
    };

    const end = () => {
      handle.removeEventListener("pointermove", move);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      floatingSize = pendingSize;
      host.style.width = `${pendingSize.width}px`;
      host.style.height = `${pendingSize.height}px`;
      window.requestAnimationFrame(() => { delete host.dataset.resizing; });
      if (floatingSize && extensionContextValid()) void chrome.storage.local.set({ [FLOATING_SIZE_KEY]: floatingSize }).catch(() => {});
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end, { once: true });
    handle.addEventListener("pointercancel", end, { once: true });
  });
}

function ensureFloatingHost() {
  let host = getFloatingHost();
  if (host) return host;
  if (!extensionContextValid()) return null;

  host = document.createElement("div");
  host.id = FLOATING_HOST_ID;
  host.style.cssText = "all:initial;position:fixed;right:18px;top:96px;z-index:2147483647;display:block;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box} .shell{width:100%;height:100%;position:relative;padding-top:16px;font-family:Inter,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
      .grip{position:absolute;top:3px;left:50%;transform:translateX(-50%);width:36px;height:16px;border:1px solid rgba(151,169,179,.42);border-bottom:0;border-radius:7px 7px 0 0;background:rgba(250,252,253,.94);color:#9caab3;display:grid;place-items:center;cursor:grab;font-size:10px;line-height:1;box-shadow:none;outline:none;z-index:4}
      .grip:focus{outline:none}.grip:focus-visible{box-shadow:inset 0 0 0 1px rgba(0,166,160,.28)}
      .grip:active{cursor:grabbing}.rail{width:188px;height:46px;border:1px solid #cfe4e3;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 8px 26px rgba(23,50,77,.18);color:#17324d;display:flex;align-items:center;gap:10px;cursor:grab;padding:6px 9px 6px 7px;text-align:left}
      .rail b{width:32px;height:32px;flex:0 0 32px;border-radius:9px;background:#e8f8f7;display:grid;place-items:center;overflow:hidden}.rail b img{width:27px;height:27px;object-fit:contain}.rail span{min-width:0;display:grid;gap:2px;font-size:12px;font-weight:700;line-height:1.1;letter-spacing:0}.rail span small{color:#7d8a98;font-size:9px;font-weight:400}.rail em{margin-left:auto;width:24px;height:24px;border-radius:50%;background:#e9f7f6;color:#087f7a;display:grid;place-items:center;font-style:normal;font-size:13px}.rail:active{cursor:grabbing}
      iframe{display:none;width:100%;height:100%;border:1px solid #dce5ec;border-radius:14px;background:#fbfcfe;box-shadow:0 20px 60px rgba(23,50,77,.24)}
      .resize{display:none;position:absolute;right:2px;bottom:2px;width:20px;height:20px;border:0;background:linear-gradient(135deg,transparent 45%,#9eb2bd 46%,#9eb2bd 55%,transparent 56%,transparent 67%,#6f8b98 68%,#6f8b98 77%,transparent 78%);cursor:nwse-resize;z-index:3}
      .resize-status{display:none;position:absolute;inset:16px 0 0;background:rgba(246,248,250,.96);border:1px solid #dce5ec;border-radius:14px;color:#607086;place-items:center;font:600 13px Inter,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;letter-spacing:.03em;z-index:2}
      :host([data-resizing="true"]) iframe{display:none!important;visibility:hidden;content-visibility:hidden}:host([data-resizing="true"]) .resize-status{display:grid}
      :host([data-expanded="true"]) .rail{display:none}:host([data-expanded="true"]) iframe,:host([data-expanded="true"]) .resize{display:block}
    </style>
    <div class="shell"><button class="grip" title="拖动求职工作台" aria-label="拖动求职工作台">•••</button><button class="rail" title="展开求职工作台"><b><img class="rail-logo" alt="" /></b><span>求职助手<small>岗位识别已开启</small></span><em>⌃</em></button><iframe title="求职工作台浮窗"></iframe><div class="resize-status">调整窗口大小</div><button class="resize" title="调整浮窗大小" aria-label="调整浮窗大小"></button></div>`;
  const frame = shadow.querySelector("iframe");
  frame.dataset.loaded = "false";
  const grip = shadow.querySelector(".grip");
  const rail = shadow.querySelector(".rail");
  const resize = shadow.querySelector(".resize");
  shadow.querySelector(".rail-logo").src = chrome.runtime.getURL("assets/logo-toolbar-v2.png");
  rail.addEventListener("click", () => {
    if (host.dataset.dragged !== "true") setFloatingExpanded(host, true);
  });
  enableFloatingDrag(host, [grip, rail]);
  enableFloatingResize(host, resize);
  document.documentElement.append(host);
  setFloatingExpanded(host, false);
  void refreshFloatingFrameActivity();

  void chrome.storage.local.get([FLOATING_POSITION_KEY, FLOATING_SIZE_KEY]).then((saved) => {
    const position = saved[FLOATING_POSITION_KEY];
    const size = saved[FLOATING_SIZE_KEY];
    if (Number.isFinite(size?.width) && Number.isFinite(size?.height)) floatingSize = size;
    if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
      host.style.left = `${position.left}px`;
      host.style.top = `${position.top}px`;
      host.style.right = "auto";
      keepDragHandleVisible(host);
    }
  });
  return host;
}

function showFloating(recoverIfOutside = false) {
  const host = ensureFloatingHost();
  if (!host) return;
  host.style.display = "block";
  void refreshFloatingFrameActivity();
  setFloatingExpanded(host, true);
  if (recoverIfOutside && floatingIsOutside(host)) resetFloatingPosition(host);
}

function hideFloating() {
  const host = getFloatingHost();
  if (host) setFloatingExpanded(host, false);
}

function closeFloating() {
  const host = getFloatingHost();
  if (host) {
    host.style.display = "none";
    setFloatingFrameLoaded(host, false);
  }
}

function toggleFloating() {
  const host = ensureFloatingHost();
  if (!host) return;
  if (floatingIsOutside(host) || host.style.display === "none" || host.dataset.expanded !== "true") showFloating(true);
  else hideFloating();
}

function parseCurrentJob() {
  const structuredJob = readStructuredJob();
  const organization = structuredJob?.hiringOrganization;
  const title = textOf([
    ".job-primary .name h1",
    ".job-name",
    "[class*='job-name']",
    "[class*='job-title'] h1",
    "h1",
  ]) || (typeof structuredJob?.title === "string" && structuredJob.title.trim()) || "";
  const companyCard = companyFromCard();
  const headerCompany = companyNearJobHeader();
  const structuredCompany = validCompanyName(typeof organization?.name === "string" ? organization.name : "");
  const structuredMatchesCard = structuredCompany && companyCard.cardText.includes(structuredCompany);
  const company = companyCard.name || headerCompany || (structuredMatchesCard ? structuredCompany : "");
  const companyLogoUrl = companyCard.logoUrl || imageOf([
    ".job-detail-company .company-logo img",
    ".sider-company img",
    ".company-sider img",
    "[class*='company-logo'] img",
  ]) || (structuredMatchesCard ? structuredLogo(organization) : "");
  const salaryText = textOf([".job-primary .salary", ".salary", "[class*='salary']"]);
  const locationText = textOf([".job-location", "[class*='job-location']", ".location-address"]);
  const jobLimit = textOf([".job-primary .job-limit", ".job-limit", "[class*='job-limit']"]);
  const jobDescription = textOf([
    ".job-sec-text",
    ".job-detail-section .text",
    "[class*='job-detail'] [class*='text']",
    "[class*='job-description']",
  ]);
  const skillTags = textsOf([".job-tags span", ".tag-list span", "[class*='job-tags'] span"]);
  const limits = jobLimit.split(/[·｜|]/).map((value) => value.trim()).filter(Boolean);

  const isSupported = /(^|\.)zhipin\.com$|(^|\.)bosszhipin\.com$/i.test(location.hostname);
  const recognized = isSupported && Boolean(title && (company || jobDescription));

  return {
    recognized,
    job: {
      source: "boss",
      sourceUrl: location.href,
      title,
      company: company || "公司待补充",
      companyLogoUrl,
      salaryText: salaryText || "薪资面议",
      locationText: locationText || limits.find((value) => /北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|苏州|天津|重庆/.test(value)) || "地点待补充",
      experienceText: limits.find((value) => /经验|年|应届|不限/.test(value)) || "经验不限",
      educationText: limits.find((value) => /本科|大专|硕士|博士|学历/.test(value)) || "学历不限",
      jobDescription,
      skillTags,
    },
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PARSE_CURRENT_JOB") {
    sendResponse(parseCurrentJob());
  } else if (message?.type === "TOGGLE_FLOATING") {
    toggleFloating();
    sendResponse({ ok: true });
  } else if (message?.type === "SHOW_FLOATING") {
    showFloating();
    sendResponse({ ok: true });
  } else if (message?.type === "HIDE_FLOATING") {
    hideFloating();
    sendResponse({ ok: true });
  } else if (message?.type === "COLLAPSE_FLOATING") {
    hideFloating();
    sendResponse({ ok: true });
  } else if (message?.type === "CLOSE_FLOATING") {
    closeFloating();
    sendResponse({ ok: true });
  } else if (message?.type === "ANALYSIS_ACTIVITY_CHANGED") {
    void refreshFloatingFrameActivity();
    sendResponse({ ok: true });
  }
});

void chrome.storage.local.get("displayMode").then((saved) => {
  currentDisplayMode = saved.displayMode === "sidepanel" ? "sidepanel" : "floating";
  if (currentDisplayMode === "floating") {
    ensureFloatingHost();
  }
}).catch(() => closeFloating());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.displayMode) return;
  currentDisplayMode = changes.displayMode.newValue === "sidepanel" ? "sidepanel" : "floating";
  if (currentDisplayMode === "floating") {
    const host = ensureFloatingHost();
    if (!host) return;
    host.style.display = "block";
    setFloatingExpanded(host, false);
    void refreshFloatingFrameActivity();
  } else {
    closeFloating();
  }
});

window.addEventListener("resize", () => {
  const host = getFloatingHost();
  if (host && host.style.display !== "none") keepDragHandleVisible(host);
});

document.addEventListener("visibilitychange", () => {
  void refreshFloatingFrameActivity();
});
