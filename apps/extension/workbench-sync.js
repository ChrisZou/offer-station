(() => {
if (window.__jobWorkbenchSyncActive) return;
window.__jobWorkbenchSyncActive = true;

const API_KEY_STORAGE = "job-workbench.deepseek-api-key";
const PROFILE_STORAGE = "job-workbench.ai-profile";
const PERSONAL_INFO_STORAGE = "job-workbench.personal-info";
const WORKSPACE_ID_STORAGE = "job-workbench.local-workspace-id";
const RELEVANT_KEYS = new Set([API_KEY_STORAGE, PROFILE_STORAGE, PERSONAL_INFO_STORAGE]);

let ready = false;
let applyingRemote = false;
let lastSentFingerprint = "";

function readJson(storage, key) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readLocalContext() {
  return {
    apiKey: window.localStorage.getItem(API_KEY_STORAGE) || window.sessionStorage.getItem(API_KEY_STORAGE) || "",
    profile: readJson(window.localStorage, PROFILE_STORAGE),
    personalInfo: readJson(window.localStorage, PERSONAL_INFO_STORAGE),
  };
}

function fingerprint(context) {
  return JSON.stringify([context.apiKey || "", context.profile || null, context.personalInfo || null]);
}

function applyRemoteContext(workspaceId, context) {
  applyingRemote = true;
  try {
    if (workspaceId) window.localStorage.setItem(WORKSPACE_ID_STORAGE, workspaceId);
    if (context?.apiKey) {
      window.localStorage.setItem(API_KEY_STORAGE, context.apiKey);
      window.sessionStorage.removeItem(API_KEY_STORAGE);
    }
    if (context?.profile) window.localStorage.setItem(PROFILE_STORAGE, JSON.stringify(context.profile));
    if (context?.personalInfo) window.localStorage.setItem(PERSONAL_INFO_STORAGE, JSON.stringify(context.personalInfo));
    window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
    window.dispatchEvent(new CustomEvent("job-workbench:personal-info-updated", { detail: context?.personalInfo || null }));
  } finally {
    applyingRemote = false;
  }
}

async function pushWorkbenchContext(force = false) {
  if (!ready || applyingRemote) return;
  const context = readLocalContext();
  const nextFingerprint = fingerprint(context);
  if (!force && nextFingerprint === lastSentFingerprint) return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SYNC_WORKBENCH_CONTEXT",
      ...context,
      sourceOrigin: window.location.origin,
    });
    if (response?.ok) {
      lastSentFingerprint = nextFingerprint;
      if (response.workspaceId) window.localStorage.setItem(WORKSPACE_ID_STORAGE, response.workspaceId);
      window.dispatchEvent(new CustomEvent("job-workbench:plugin-sync-status", { detail: { connected: true, hasApiKey: Boolean(context.apiKey) } }));
    } else {
      window.dispatchEvent(new CustomEvent("job-workbench:plugin-sync-status", { detail: { connected: false, reason: response?.reason || "sync_rejected" } }));
    }
  } catch {
    window.dispatchEvent(new CustomEvent("job-workbench:plugin-sync-status", { detail: { connected: false, reason: "extension_unavailable" } }));
    // 扩展更新后旧页面上下文会失效，刷新工作台即可恢复。
  }
}

async function initializeWorkbenchSync() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_WORKBENCH_CONTEXT", sourceOrigin: window.location.origin });
    if (response?.ok) applyRemoteContext(response.workspaceId, response.context);
    else window.dispatchEvent(new CustomEvent("job-workbench:plugin-sync-status", { detail: { connected: false, reason: response?.reason || "sync_rejected" } }));
  } catch {
    window.dispatchEvent(new CustomEvent("job-workbench:plugin-sync-status", { detail: { connected: false, reason: "extension_unavailable" } }));
    // 插件暂不可用时保留工作台本地数据，不做覆盖。
  } finally {
    ready = true;
    await pushWorkbenchContext(true);
  }
}

void initializeWorkbenchSync();
window.addEventListener("job-workbench:ai-context-updated", () => void pushWorkbenchContext());
window.addEventListener("job-workbench:personal-info-updated", () => void pushWorkbenchContext());
window.addEventListener("storage", (event) => {
  if (event.key && !RELEVANT_KEYS.has(event.key)) return;
  if (event.key === PERSONAL_INFO_STORAGE) {
    window.dispatchEvent(new CustomEvent("job-workbench:personal-info-updated", { detail: readJson(window.localStorage, PERSONAL_INFO_STORAGE) }));
  } else {
    window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
  }
  void pushWorkbenchContext();
});
window.setInterval(() => void pushWorkbenchContext(), 5000);
})();
