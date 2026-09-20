import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the overview dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /求职工作台/);
  assert.match(html, /我的求职进展/);
  assert.match(html, /总日程进度/);
  assert.match(html, /全部岗位/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("server-renders the saved jobs workbench", async () => {
  const response = await render("/jobs");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /收藏职位/);
  assert.match(html, /最近收藏/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("server-renders the career profile", async () => {
  const response = await render("/profile");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /职业档案/);
  assert.doesNotMatch(html, /档案可用度|档案准备度/);
  assert.match(html, /编辑求职与个人信息/);
  assert.doesNotMatch(html, /证据来源/);
  assert.doesNotMatch(html, /可确认事实|可用事实/);
  assert.doesNotMatch(html, /用于生成简历/);
  assert.match(html, /还没有职业档案/);
  assert.doesNotMatch(html, /何亚骏|188 8888 8888|heyajun/);
  assert.match(html, /brand-logo\.png/);
});

test("server-renders AI settings", async () => {
  const response = await render("/settings");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /AI 设置/);
  assert.match(html, /DeepSeek/);
  assert.match(html, /deepseek-v4-flash/);
  assert.match(html, /为什么暂时不用 Agent/);
  assert.match(html, /重置所有信息/);
  assert.match(html, /仅 localhost 可用/);
});

test("server-renders the resume generator", async () => {
  const response = await render("/resumes/new");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /生成岗位专属简历/);
  assert.match(html, /选择简历素材/);
  assert.match(html, /本次简历/);
});

test("server-renders the resume library before creation", async () => {
  const response = await render("/resumes");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /简历管理/);
  assert.match(html, /岗位专属版本/);
  assert.match(html, /创建简历/);
  assert.match(html, /预览/);
});

test("server-renders the resume editor", async () => {
  const response = await render("/resumes/frontend-v3/edit");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /还没有可以编辑的简历/);
  assert.match(html, /创建职业档案/);
  assert.doesNotMatch(html, /何亚骏|澄明科技|千帆智能/);
});
