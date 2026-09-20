function serialized(value: unknown) {
  try { return JSON.stringify(value); } catch { return ""; }
}

export function assertInputSize(value: unknown, maxChars: number, label = "AI 输入") {
  const length = serialized(value).length;
  if (!length) throw new Error(`${label}为空或格式无效`);
  if (length > maxChars) throw new Error(`${label}过长，请精简后重试`);
}

export function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
}

function chineseCount(value: string) {
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return /^\d+$/.test(value) ? Number(value) : map[value] ?? 0;
}

/**
 * A user may explicitly ask to put literal test text on a number of lines,
 * e.g. “在专业技能下方填满三行 1”. This is layout content, not a resume fact.
 */
export function literalLayoutFillFromInstruction(instruction: string) {
  const match = instruction.match(/(?:填满|填充|补充)\s*(?:为|成)?\s*([一二三四五六七八九十\d]+)\s*行\s*(?:文字)?\s*[“"']?([^\s，。；;“”"'：:]+)[”"']?/u);
  if (!match) return [];
  const count = chineseCount(match[1]);
  const literal = match[2].trim();
  return count >= 1 && count <= 6 && literal.length <= 80 ? Array.from({ length: count }, () => literal) : [];
}
