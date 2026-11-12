/**
 * 静态检查：清单 JSON、引用文件、HTML 资源是否都存在。
 *
 *   node tools/check-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
let failed = 0;

function fail(message) {
  failed += 1;
  console.error('✗ ' + message);
}

function ok(message) {
  console.log('✓ ' + message);
}

function requireFile(relative, label) {
  const full = path.join(ROOT, relative);
  if (!fs.existsSync(full)) {
    fail(`${label} 缺少文件：${relative}`);
    return false;
  }
  return true;
}

const manifestPath = path.join(ROOT, 'manifest.json');
if (!requireFile('manifest.json', '清单')) process.exit(1);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  ok('manifest.json 是合法 JSON');
} catch (error) {
  fail('manifest.json 解析失败：' + error.message);
  process.exit(1);
}

if (manifest.manifest_version !== 3) fail('manifest_version 应为 3');
else ok('Manifest V3');

const required = [
  [manifest.background?.service_worker, 'Service Worker'],
  [manifest.action?.default_popup, '弹窗页面'],
  [manifest.options_page, '设置页面']
];
required.forEach(([relative, label]) => {
  if (relative) requireFile(relative, label);
  else fail(`未配置${label}`);
});

(manifest.content_scripts || []).forEach((script, index) => {
  (script.js || []).forEach((relative) => requireFile(relative, `content_scripts[${index}]`));
  (script.css || []).forEach((relative) => requireFile(relative, `content_scripts[${index}] 样式`));
});

Object.values(manifest.icons || {}).forEach((relative) => requireFile(relative, '扩展图标'));
Object.values(manifest.action?.default_icon || {}).forEach((relative) => requireFile(relative, '工具栏图标'));

[
  ['vendor/pdfjs/pdf.min.mjs', 'PDF 解析库'],
  ['vendor/pdfjs/pdf.worker.min.mjs', 'PDF Worker'],
  ['vendor/pdfjs/cmaps/Adobe-GB1-UCS2.bcmap', 'PDF 中文字符映射'],
  ['src/shared/resume-parser.js', 'PDF 文本解析'],
  ['src/options/pdf-import.js', 'PDF 导入模块']
].forEach(([relative, label]) => requireFile(relative, label));

// 检查页面里的本地 script / link 引用
['src/popup/popup.html', 'src/options/options.html'].forEach((relative) => {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const matches = [...html.matchAll(/(?:src|href)="([^"]+)"/g)];
  matches.forEach(([, reference]) => {
    if (/^(https?:|data:|#)/.test(reference)) return;
    const resolved = path.resolve(path.dirname(file), reference);
    if (!fs.existsSync(resolved)) fail(`${relative} 引用了不存在的资源：${reference}`);
  });
  ok(`${relative} 资源引用完整`);
});

if (failed) {
  console.error(`\n${failed} 项检查失败`);
  process.exit(1);
}
console.log('\n静态检查全部通过');
