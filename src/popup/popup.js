'use strict';

const FILES = [
  'src/shared/schema.js',
  'src/shared/matcher.js',
  'src/shared/fill.js',
  'src/content/content.js'
];

const SECTION_NAMES = {
  basic: '基本信息',
  education: '教育经历',
  internship: '实习经历',
  project: '项目经历',
  campus: '校园经历',
  skills: '技能证书'
};

const $ = (selector) => document.querySelector(selector);
const els = {
  fill: $('#fillBtn'),
  ai: $('#aiBtn'),
  scan: $('#scanBtn'),
  auto: $('#autoToggle'),
  host: $('#host'),
  name: $('#profileName'),
  percent: $('#percent'),
  bar: $('#barFill'),
  missing: $('#missing'),
  status: $('#status'),
  diag: $('#diag'),
  diagList: $('#diagList'),
  diagSummary: $('#diagSummary'),
  closeDiag: $('#closeDiag'),
  openOptions: $('#openOptions'),
  optionsLink: $('#optionsLink')
};

let activeTab = null;
let settings = null;
let host = '';
let busy = false;

function setStatus(text, tone) {
  els.status.textContent = text;
  els.status.className = 'status' + (tone ? ' ' + tone : '');
}

function clearStatus() {
  els.status.className = 'status hidden';
  els.status.textContent = '';
}

function setBusy(value, label) {
  busy = value;
  [els.fill, els.ai, els.scan].forEach((button) => { button.disabled = value; });
  if (label) {
    els.fill.querySelector('span').textContent = label;
  } else {
    els.fill.querySelector('span').textContent = '一键填写当前页面';
  }
}

function isSupported(url) {
  return /^(https?|file):/i.test(url || '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected() {
  if (!activeTab || activeTab.id == null) throw new Error('找不到当前标签页');
  const probe = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => !!(window.RF && window.RF.ready)
  });
  if (probe && probe[0] && probe[0].result) return;
  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id, allFrames: true },
    files: FILES
  });
}

async function callInFrames(name, payload, allFrames) {
  await ensureInjected();
  const results = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id, allFrames: !!allFrames },
    func: (method, args) => {
      if (!window.RF || typeof window.RF[method] !== 'function') return null;
      try {
        return window.RF[method](args);
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
    args: [name, payload || {}]
  });
  return results.map((entry) => entry.result).filter(Boolean);
}

function sectionLabel(section) {
  return SECTION_NAMES[section] || section || '';
}

function renderProfile(profile) {
  const completeness = RF.profileCompleteness(profile);
  els.name.textContent = profile.basic.name || '未填写简历';
  els.percent.textContent = completeness.percent + '%';
  els.bar.style.width = completeness.percent + '%';
  if (completeness.missing.length) {
    els.missing.textContent = '待补充：' + completeness.missing.join('、');
    els.missing.title = '待补充：' + completeness.missing.join('、');
  } else {
    els.missing.textContent = '资料已完整，可以开始投递';
  }
}

function renderDiagnostics(result) {
  els.diag.classList.remove('hidden');
  const fields = (result && result.fields) || [];
  const matched = fields.filter((field) => field.key);
  const unmatched = fields.filter((field) => !field.key);
  els.diagSummary.textContent = `识别到 ${fields.length} 个控件，已匹配 ${matched.length} 个` +
    (unmatched.length ? `，${unmatched.length} 个未识别` : '');

  const rows = [];
  matched.forEach((field) => {
    const score = Math.min(Number(field.score || 0), 1);
    const tone = score >= 0.99 ? '' : 'weak';
    rows.push(`
      <div class="diag-item">
        <div>
          <div class="diag-label">${escapeHtml(field.label || '(无标签)')}${field.recordIndex ? ` · 第 ${field.recordIndex + 1} 条` : ''}</div>
          <div class="diag-key">${escapeHtml(sectionLabel(field.section))} / ${escapeHtml(field.key)} · ${escapeHtml(field.type)}</div>
        </div>
        <span class="diag-score ${tone}">${score.toFixed(2)}</span>
      </div>`);
  });
  unmatched.slice(0, 20).forEach((field) => {
    rows.push(`
      <div class="diag-item">
        <div>
          <div class="diag-label">${escapeHtml(field.label || '(无标签)')}</div>
          <div class="diag-key">${escapeHtml(field.tag)} · ${escapeHtml(field.type)}${field.name ? ' · ' + escapeHtml(field.name) : ''}</div>
        </div>
        <span class="diag-score none">未识别</span>
      </div>`);
  });

  els.diagList.innerHTML = rows.length
    ? rows.join('')
    : '<div class="diag-empty">没有发现可填写控件。部分站点使用 iframe 或 Shadow DOM，可能需要手动展开表单。</div>';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function handleFill() {
  if (busy) return;
  clearStatus();
  const state = await RF.getState();
  if (!RF.isMeaningfulProfile(state.profile)) {
    setStatus('还没有简历资料，请先点「编辑简历」填写', 'error');
    return;
  }
  setBusy(true, '正在填写…');
  try {
    const results = await callInFrames('runFill', {}, true);
    const filled = results.reduce((sum, item) => sum + (item.filled || 0), 0);
    const existing = results.reduce((sum, item) => sum + (item.existing || 0), 0);
    const failed = results.reduce((sum, item) => sum + (item.failed || 0), 0);
    const unsupported = results.reduce((sum, item) => sum + (item.unsupported || 0), 0);
    const total = results.reduce((sum, item) => sum + (item.total || 0), 0);
    const firstError = results.map((item) => item.error).filter(Boolean)[0];

    if (firstError === 'EMPTY_PROFILE') {
      setStatus('简历资料为空，请先编辑简历', 'error');
    } else if (filled > 0) {
      const extra = [
        existing ? `已有内容 ${existing} 项` : '',
        failed ? `未匹配 ${failed} 项` : '',
        unsupported ? `需手动上传 ${unsupported} 项` : ''
      ].filter(Boolean).join(' · ');
      setStatus(`已填写 ${filled} 项${extra ? '；' + extra : ''}。请核对后再提交。`, 'success');
    } else if (total === 0) {
      setStatus('当前页面没有检测到可填写的表单。若是弹窗或 iframe，请先展开表单再试。', 'error');
    } else {
      setStatus(`识别到 ${total} 个控件，但没有可填入的字段（${existing} 项已有内容）。可点「检测字段」查看匹配情况。`, 'info');
    }
  } catch (error) {
    setStatus(`填写失败：${error && error.message ? error.message : error}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function handleScan() {
  if (busy) return;
  clearStatus();
  setBusy(true, '正在检测…');
  try {
    const results = await callInFrames('scanPage', {}, false);
    renderDiagnostics(results[0]);
  } catch (error) {
    setStatus(`检测失败：${error && error.message ? error.message : error}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function handleAI() {
  if (busy) return;
  clearStatus();
  const state = await RF.getState();
  if (!RF.isMeaningfulProfile(state.profile)) {
    setStatus('请先填写简历资料，再生成开放题回答', 'error');
    return;
  }
  setBusy(true, '正在作答…');
  try {
    const results = await callInFrames('fillOpenQuestions', {}, true);
    const filled = results.reduce((sum, item) => sum + (item.filled || 0), 0);
    const error = results.map((item) => item.error).filter(Boolean)[0];
    if (filled > 0) {
      setStatus(`已填写 ${filled} 道开放题，请按岗位微调后提交。`, 'success');
    } else {
      setStatus(error || '没有找到待回答的开放题，或未命中本地语料库。', 'error');
    }
  } catch (error) {
    setStatus(`操作失败：${error && error.message ? error.message : error}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function handleToggleAuto() {
  if (!host) return;
  const enabled = els.auto.checked;
  const domains = new Set(settings.autoFillDomains || []);
  if (enabled) domains.add(host);
  else domains.delete(host);
  settings = await RF.saveSettings(Object.assign({}, settings, { autoFillDomains: Array.from(domains) }));
  setStatus(enabled ? `已开启 ${host} 的自动填写，刷新页面后生效。` : `已关闭 ${host} 的自动填写。`, 'info');
}

async function init() {
  activeTab = await getActiveTab();
  const state = await RF.getState();
  settings = state.settings;
  renderProfile(state.profile);

  if (!isSupported(activeTab && activeTab.url)) {
    setStatus('当前页面不支持填写（仅支持 http/https 网页）。', 'error');
    [els.fill, els.ai, els.scan].forEach((button) => { button.disabled = true; });
    els.host.textContent = '—';
    return;
  }

  try {
    host = new URL(activeTab.url).hostname.toLowerCase();
  } catch (error) {
    host = '';
  }
  els.host.textContent = host || '—';
  els.auto.checked = (settings.autoFillDomains || []).includes(host);
  els.host.title = host;

  if (!state.profile.basic.name && !state.profile.basic.phone && !state.profile.educations[0].school) {
    setStatus('首次使用：先点「编辑简历」，或一键载入示例资料体验填表。', 'info');
  }
}

els.fill.addEventListener('click', handleFill);
els.scan.addEventListener('click', handleScan);
els.ai.addEventListener('click', handleAI);
els.auto.addEventListener('change', handleToggleAuto);
els.closeDiag.addEventListener('click', () => els.diag.classList.add('hidden'));
els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) handleFill();
});

init().catch((error) => {
  setStatus(`初始化失败：${error && error.message ? error.message : error}`, 'error');
});
