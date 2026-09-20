import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertInputSize, boundedNumber, literalLayoutFillFromInstruction } from "../app/api/ai/_guardrails.ts";

test("AI input and layout bounds fail closed", () => {
  assert.throws(() => assertInputSize({ value: "x".repeat(101) }, 100), /过长/);
  assert.equal(boundedNumber(1.8, 1.05, 0.9, 1.5), 1.5);
  assert.equal(boundedNumber(0.2, 1.05, 0.9, 1.5), 0.9);
});

test("explicit visual layout instruction preserves its literal text", () => {
  assert.deepEqual(literalLayoutFillFromInstruction("仅供测试，在专业技能下方填满三行 1"), ["1", "1", "1"]);
  assert.deepEqual(literalLayoutFillFromInstruction("请优化这份简历"), []);
});

test("compiler uses the official Habaneraa package and spacing control", async () => {
  const source = await readFile(new URL("../../../scripts/typst-compiler.mjs", import.meta.url), "utf8");
  assert.match(source, /@preview\/habaneraa-one-page-resume-zh:0\.1\.0/);
  assert.match(source, /element-spaciness:/);
});

test("Qwen connection check uses a model-compatible image", async () => {
  const source = await readFile(new URL("../app/api/ai/qwen-test/route.ts", import.meta.url), "utf8");
  const encoded = source.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(encoded, "connection check should include an image");
  const png = Buffer.from(encoded, "base64");
  assert.equal(png.readUInt32BE(16), 16); // PNG IHDR width
  assert.equal(png.readUInt32BE(20), 16); // PNG IHDR height
});

test("full reset keeps both AI provider keys", async () => {
  const source = await readFile(new URL("../app/components/AiSettings.tsx", import.meta.url), "utf8");
  assert.match(source, /new Set\(\[AI_API_KEY_STORAGE, QWEN_API_KEY_STORAGE\]\)/);
  assert.match(source, /!preservedKeys\.has\(key\)/);
});

test("opening a resume does not automatically invoke visual AI", async () => {
  const source = await readFile(new URL("../app/components/LatexResumeStudio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /resume-needs-visual-review/);
  assert.doesNotMatch(source, /二次视觉验证/);
});

test("resume editor never renders a floating toast", async () => {
  const source = await readFile(new URL("../app/components/LatexResumeStudio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /className="toast"/);
});
