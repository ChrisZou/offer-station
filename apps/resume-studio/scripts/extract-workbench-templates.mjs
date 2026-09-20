import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const input = readFileSync(resolve(root, 'doc/简历模板.json'), 'utf8');
const mongoJson = `[${input
  .replace(/ObjectId\("([^"]+)"\)/g, '"$1"')
  .replace(/ISODate\("([^"]+)"\)/g, '"$1"')
  .replace(/NumberInt\((-?\d+)\)/g, '$1')
  .replace(/}\s*{/g, '},{')}]`;

const source = JSON.parse(mongoJson);
const templates = source.map((item, index) => ({
  id: item.ID || `maobu-${index + 1}`,
  name: `猫步专业模板 ${String(index + 1).padStart(2, '0')}`,
  layout: item.LAYOUT || 'classical',
  categories: item.CATEGORY || [],
  previewUrl: item.previewUrl || '',
  globalStyle: item.GLOBAL_STYLE || {},
  components: (item.COMPONENTS || []).map((component) => ({
    model: component.model,
    cptName: component.cptName,
    cptOptionsName: component.cptOptionsName,
    cptTitle: component.cptTitle,
    cptHeight: component.cptHeight,
    cptWidth: component.cptWidth,
    layout: component.layout,
    show: component.show,
    style: component.style || {}
  }))
}));

writeFileSync(
  resolve(root, 'src/workbench/maobuTemplates.json'),
  `${JSON.stringify(templates, null, 2)}\n`
);
console.log(`Extracted ${templates.length} MaoBu templates.`);
