const DEFAULT_MODE = "floating";
const MODE_DEFAULT_VERSION = "floating-v1";
const WORKBENCH_URL_PATTERNS = [
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
  "https://qiuzhi-job-workbench.eichornaskew.chatgpt.site/*",
];
let displayMode = null;

async function injectWorkbenchSyncIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: WORKBENCH_URL_PATTERNS }).catch(() => []);
  await Promise.all(tabs.map((tab) => tab.id
    ? chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["workbench-sync.js"] }).catch(() => {})
    : Promise.resolve()));
}

async function ensureWorkspaceId() {
  const saved = await chrome.storage.local.get("localWorkspaceId");
  if (saved.localWorkspaceId) return saved.localWorkspaceId;
  const localWorkspaceId = crypto.randomUUID();
  await chrome.storage.local.set({ localWorkspaceId });
  return localWorkspaceId;
}

function normalizeMode(value) {
  return value === "sidepanel" ? "sidepanel" : DEFAULT_MODE;
}

async function applyDisplayMode(value) {
  displayMode = normalizeMode(value);
  // 侧边栏由 Chrome 直接响应工具栏点击，避免 sidePanel.open() 脱离用户手势。
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: displayMode === "sidepanel",
  }).catch(() => {});
}

async function syncDisplayMode() {
  const saved = await chrome.storage.local.get("displayMode");
  await applyDisplayMode(saved.displayMode);
}

void syncDisplayMode();

chrome.runtime.onInstalled.addListener(async () => {
  const saved = await chrome.storage.local.get(["displayMode", "modeDefaultVersion", "autoMatch"]);
  const mode = saved.modeDefaultVersion ? normalizeMode(saved.displayMode) : DEFAULT_MODE;
  await chrome.storage.local.set({
    ...(!saved.modeDefaultVersion ? { displayMode: mode, modeDefaultVersion: MODE_DEFAULT_VERSION } : {}),
    ...(typeof saved.autoMatch !== "boolean" ? { autoMatch: true } : {}),
  });
  await applyDisplayMode(mode);
  await ensureWorkspaceId();
  await injectWorkbenchSyncIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void syncDisplayMode();
  void ensureWorkspaceId();
  void injectWorkbenchSyncIntoOpenTabs();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.displayMode) {
    void applyDisplayMode(changes.displayMode.newValue);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "REFRESH_WORKBENCH_SYNC") {
    void injectWorkbenchSyncIntoOpenTabs().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "IS_ACTIVE_ANALYSIS_TAB") {
    void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([activeTab]) => {
      sendResponse({ active: Boolean(sender.tab?.id && sender.tab.id === activeTab?.id) });
    }).catch(() => sendResponse({ active: false }));
    return true;
  }
  if (!["GET_WORKBENCH_CONTEXT", "SYNC_WORKBENCH_CONTEXT"].includes(message?.type)) return undefined;
  const source = sender.url || sender.tab?.url || "";
  if (!/^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|qiuzhi-job-workbench\.eichornaskew\.chatgpt\.site)\//i.test(source)) {
    sendResponse({ ok: false });
    return undefined;
  }
  void (async () => {
    const syncSettings = await chrome.storage.local.get(["apiBase", "workbenchContext", "aiApiKey", "aiProfile", "personalInfo"]);
    const expectedOrigin = new URL(syncSettings.apiBase || "http://localhost:3000").origin;
    const sourceOrigin = new URL(source).origin;
    if (sourceOrigin !== expectedOrigin) {
      sendResponse({ ok: false, reason: "inactive_workbench_origin" });
      return;
    }
    const workspaceId = await ensureWorkspaceId();
    if (message.type === "GET_WORKBENCH_CONTEXT") {
      const existing = syncSettings.workbenchContext || {
        apiKey: syncSettings.aiApiKey || "",
        profile: syncSettings.aiProfile || null,
        personalInfo: syncSettings.personalInfo || null,
      };
      sendResponse({ ok: true, workspaceId, context: existing });
      return;
    }
    if (typeof message.apiKey === "string" && message.apiKey.trim()) {
      await chrome.storage.session.set({ aiApiKey: message.apiKey.trim() });
      await chrome.storage.local.set({ aiApiKey: message.apiKey.trim() });
    } else {
      await chrome.storage.session.remove("aiApiKey");
      await chrome.storage.local.remove("aiApiKey");
    }
    const nextProfile = message.profile || null;
    const personalInfo = message.personalInfo || null;
    const workbenchContext = {
      apiKey: typeof message.apiKey === "string" ? message.apiKey.trim() : "",
      profile: nextProfile,
      personalInfo,
      workspaceId,
      updatedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({
      aiProfile: nextProfile,
      personalInfo,
      workbenchContext,
      workbenchSyncedAt: workbenchContext.updatedAt,
      workbenchOrigin: sourceOrigin,
    });
    sendResponse({ ok: true, workspaceId });
  })().catch(() => sendResponse({ ok: false }));
  return true;
});

async function notifyAnalysisActivityChanged() {
  const tabs = await chrome.tabs.query({ url: ["https://*.zhipin.com/*", "https://*.bosszhipin.com/*"] }).catch(() => []);
  await Promise.all(tabs.map((tab) => tab.id
    ? chrome.tabs.sendMessage(tab.id, { type: "ANALYSIS_ACTIVITY_CHANGED" }).catch(() => {})
    : Promise.resolve()));
}

chrome.tabs.onActivated.addListener(() => { void notifyAnalysisActivityChanged(); });
chrome.windows.onFocusChanged.addListener(() => { void notifyAnalysisActivityChanged(); });

chrome.action.onClicked.addListener((tab) => {
  if (displayMode === "floating" && tab.id) {
    // 不在发送消息前等待异步操作，保持浏览器点击的用户手势链。
    void chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING" }).catch(() => {
      // 页面不支持浮窗时保持静默；用户可在设置中切回侧边栏。
    });
    return;
  }

  // 正常侧边栏模式由 openPanelOnActionClick 处理。仅在 service worker
  // 刚冷启动、模式尚未读取完成时同步兜底，调用仍处于用户点击事件内。
  if (displayMode === null && typeof tab.windowId === "number") {
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});
