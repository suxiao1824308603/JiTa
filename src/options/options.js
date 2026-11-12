'use strict';

/* ---------------- 表单配置 ---------------- */

const GROUPS = [
  {
    id: 'basic',
    type: 'fields',
    title: '基本信息',
    desc: '姓名、联系方式等每个网申都会用到的字段。',
    fields: [
      { key: 'name', label: '姓名', type: 'text', placeholder: '张三' },
      { key: 'gender', label: '性别', type: 'select', options: ['男', '女'] },
      { key: 'birthDate', label: '出生日期', type: 'text', placeholder: '2001-03', hint: '年-月' },
      { key: 'phone', label: '手机号', type: 'text', placeholder: '13800138000', inputmode: 'tel' },
      { key: 'email', label: '邮箱', type: 'text', placeholder: 'name@example.com', inputmode: 'email' },
      { key: 'idCard', label: '身份证号', type: 'text', placeholder: '选填' },
      { key: 'ethnicity', label: '民族', type: 'text', placeholder: '汉族' },
      {
        key: 'politicalStatus', label: '政治面貌', type: 'select',
        options: ['中共党员', '中共预备党员', '共青团员', '群众', '民主党派', '无党派人士']
      },
      { key: 'hometown', label: '籍贯', type: 'text', placeholder: '江苏南京' },
      { key: 'household', label: '户口所在地', type: 'text', placeholder: '江苏南京' },
      { key: 'maritalStatus', label: '婚姻状况', type: 'select', options: ['未婚', '已婚'] },
      { key: 'height', label: '身高（cm）', type: 'text', placeholder: '178' },
      { key: 'weight', label: '体重（kg）', type: 'text', placeholder: '68' },
      { key: 'address', label: '现居地址', type: 'text', placeholder: '上海市浦东新区…', span: 2 },
      { key: 'postalCode', label: '邮政编码', type: 'text', placeholder: '200120' },
      { key: 'wechat', label: '微信号', type: 'text', placeholder: '选填' },
      { key: 'qq', label: 'QQ', type: 'text', placeholder: '选填' },
      { key: 'expectedCity', label: '期望城市', type: 'text', placeholder: '上海' },
      { key: 'expectedPosition', label: '期望职位', type: 'text', placeholder: '后端开发工程师' },
      { key: 'expectedSalary', label: '期望薪资', type: 'text', placeholder: '20-25K' },
      { key: 'availableDate', label: '到岗时间', type: 'text', placeholder: '2026-07', hint: '年-月' },
      { key: 'website', label: '个人主页', type: 'text', placeholder: 'https://…' },
      { key: 'github', label: 'GitHub', type: 'text', placeholder: 'https://github.com/…' },
      { key: 'selfEvaluation', label: '自我评价', type: 'textarea', span: 2, placeholder: '两三句话说明你的优势与求职方向，避免空泛形容词。' }
    ]
  },
  {
    id: 'educations',
    type: 'list',
    title: '教育经历',
    desc: '按时间从近到远填写；页面上有多段教育经历时会按顺序对应。',
    itemName: '教育经历',
    factory: RF.emptyEducation,
    fields: [
      { key: 'school', label: '学校', type: 'text', placeholder: '上海交通大学' },
      { key: 'college', label: '学院 / 院系', type: 'text', placeholder: '电子信息与电气工程学院' },
      { key: 'major', label: '专业', type: 'text', placeholder: '计算机技术' },
      { key: 'degree', label: '学历', type: 'select', options: ['大专', '本科', '硕士', '博士', '其他'] },
      { key: 'city', label: '学校所在地', type: 'text', placeholder: '上海' },
      { key: 'startDate', label: '入学时间', type: 'text', placeholder: '2024-09', hint: '年-月' },
      { key: 'endDate', label: '毕业时间', type: 'text', placeholder: '2026-06', hint: '年-月' },
      { key: 'gpa', label: 'GPA / 绩点', type: 'text', placeholder: '3.8/4.0' },
      { key: 'rank', label: '排名', type: 'text', placeholder: '5/120' },
      { key: 'courses', label: '主修课程', type: 'textarea', span: 2, placeholder: '分布式系统、数据库系统…' }
    ]
  },
  {
    id: 'internships',
    type: 'list',
    title: '实习 / 工作经历',
    desc: '建议用「动作 + 方法 + 结果」描述，有数字更有说服力。',
    itemName: '实习经历',
    factory: RF.emptyInternship,
    fields: [
      { key: 'company', label: '公司', type: 'text', placeholder: '星云科技（上海）有限公司' },
      { key: 'department', label: '部门', type: 'text', placeholder: '基础架构部' },
      { key: 'position', label: '岗位', type: 'text', placeholder: '后端开发实习生' },
      { key: 'city', label: '工作地点', type: 'text', placeholder: '上海' },
      { key: 'startDate', label: '开始时间', type: 'text', placeholder: '2025-06', hint: '年-月' },
      { key: 'endDate', label: '结束时间', type: 'text', placeholder: '2025-09', hint: '年-月' },
      { key: 'description', label: '工作内容', type: 'textarea', span: 2, placeholder: '负责什么、怎么做的、和谁协作。' },
      { key: 'achievements', label: '工作成果', type: 'textarea', span: 2, placeholder: '性能提升 75%，支撑峰值 3 万 QPS…' }
    ]
  },
  {
    id: 'projects',
    type: 'list',
    title: '项目经历',
    desc: '课程项目、科研、竞赛作品都可以写。',
    itemName: '项目经历',
    factory: RF.emptyProject,
    fields: [
      { key: 'name', label: '项目名称', type: 'text', placeholder: '分布式任务调度系统' },
      { key: 'role', label: '担任角色', type: 'text', placeholder: '后端负责人' },
      { key: 'tech', label: '技术栈', type: 'text', placeholder: 'Go、etcd、MySQL' },
      { key: 'startDate', label: '开始时间', type: 'text', placeholder: '2024-10' },
      { key: 'endDate', label: '结束时间', type: 'text', placeholder: '2025-03' },
      { key: 'description', label: '项目描述', type: 'textarea', span: 2, placeholder: '解决什么问题、你的方案是什么。' },
      { key: 'achievements', label: '项目成果', type: 'textarea', span: 2, placeholder: '上线效果、数据指标、获奖情况。' }
    ]
  },
  {
    id: 'papers',
    type: 'list',
    title: '论文发表',
    desc: '期刊论文、会议论文、预印本都可以记录；作者排名按「第一作者 / 第二作者」填写。',
    itemName: '论文',
    factory: RF.emptyPaper,
    fields: [
      { key: 'title', label: '论文名称', type: 'text', span: 2, placeholder: '基于 etcd 的分布式任务调度系统设计与实现' },
      { key: 'journal', label: '期刊 / 会议', type: 'text', placeholder: '《计算机工程与应用》' },
      { key: 'publishDate', label: '发表时间', type: 'text', placeholder: '2025-03', hint: '年-月' },
      { key: 'rank', label: '作者排名', type: 'text', placeholder: '第一作者' },
      { key: 'link', label: '论文链接', type: 'text', span: 2, placeholder: 'https://doi.org/10.xxxx/xxxx' }
    ]
  },
  {
    id: 'honors',
    type: 'list',
    title: '荣誉奖励',
    desc: '奖学金、竞赛奖项、荣誉称号等。按时间从近到远填写。',
    itemName: '荣誉奖励',
    factory: RF.emptyHonor,
    fields: [
      { key: 'name', label: '荣誉名称', type: 'text', span: 2, placeholder: '国家奖学金' },
      { key: 'awardDate', label: '获得时间', type: 'text', placeholder: '2023-10', hint: '年-月' }
    ]
  },
  {
    id: 'campus',
    type: 'list',
    title: '校园经历',
    desc: '学生会、社团、志愿服务等，突出组织与协作能力。',
    itemName: '校园经历',
    factory: RF.emptyCampus,
    fields: [
      { key: 'organization', label: '组织 / 社团', type: 'text', placeholder: '校学生会技术部' },
      { key: 'role', label: '担任职务', type: 'text', placeholder: '副部长' },
      { key: 'startDate', label: '开始时间', type: 'text', placeholder: '2021-09' },
      { key: 'endDate', label: '结束时间', type: 'text', placeholder: '2023-06' },
      { key: 'description', label: '经历描述', type: 'textarea', span: 2, placeholder: '负责什么、带了多少人、做出什么结果。' }
    ]
  },
  {
    id: 'skills',
    type: 'fields',
    title: '技能与证书',
    desc: '语言、证书、软件技能，按行或分号分隔即可。获奖情况请在「荣誉奖励」中维护。',
    fields: [
      { key: 'languages', label: '语言能力', type: 'textarea', span: 2, placeholder: '英语 CET-6（580）；日语 N3' },
      { key: 'certificates', label: '证书', type: 'textarea', span: 2, placeholder: '计算机等级考试二级、教师资格证…' },
      { key: 'software', label: '软件 / 专业技能', type: 'textarea', span: 2, placeholder: 'Java、Go、MySQL、Redis、Docker…' }
    ]
  },
  {
    id: 'qa',
    type: 'qa',
    title: '开放题语料库',
    desc: '把常被问到的开放题和你的答案存下来。填表时命中关键词就直接使用，不再调用 AI。',
    itemName: '语料'
  }
];

const $ = (selector) => document.querySelector(selector);
const formRoot = $('#formRoot');
const nav = $('#nav');
const saveState = $('#saveState');
const toastEl = $('#toast');

let profile = null;
let settings = null;
let saveTimer = null;
let settingsTimer = null;
let testBusy = false;

/* ---------------- 工具 ---------------- */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setSaveState(text, tone) {
  saveState.textContent = text;
  saveState.className = 'save-state' + (tone ? ' ' + tone : '');
}

function toast(text, tone) {
  toastEl.textContent = text;
  toastEl.className = 'toast show' + (tone ? ' ' + tone : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toastEl.className = 'toast' + (tone ? ' ' + tone : ''); }, 2800);
}

function scheduleSave() {
  setSaveState('保存中…', 'saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    profile = await RF.saveProfile(profile);
    setSaveState('已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), 'ok');
  }, 450);
}

async function saveNow() {
  clearTimeout(saveTimer);
  profile = await RF.saveProfile(profile);
  setSaveState('已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), 'ok');
}

function scheduleSettingsSave() {
  setSaveState('保存中…', 'saving');
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    settings = await RF.saveSettings(settings);
    setSaveState('已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), 'ok');
  }, 450);
}

/* ---------------- 渲染 ---------------- */

function renderField(field, path, value) {
  const cls = 'field' + (field.span === 2 ? ' span-2' : '');
  const label = `<span class="field-label">${escapeHtml(field.label)}</span>`;
  const hint = field.hint ? `<small>${escapeHtml(field.hint)}</small>` : '';
  let control = '';

  if (field.type === 'select') {
    const options = ['<option value="">请选择</option>'].concat(
      (field.options || []).map((option) => {
        const selected = String(value) === option ? ' selected' : '';
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
      })
    ).join('');
    control = `<select data-path="${path}">${options}</select>`;
  } else if (field.type === 'textarea') {
    control = `<textarea data-path="${path}" rows="3" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(value)}</textarea>`;
  } else {
    control = `<input type="${field.type || 'text'}" data-path="${path}" value="${escapeHtml(value)}"` +
      ` placeholder="${escapeHtml(field.placeholder || '')}"` +
      (field.inputmode ? ` inputmode="${field.inputmode}"` : '') + '>';
  }

  return `<label class="${cls}">${label}${control}${hint}</label>`;
}

function renderFields(group) {
  const fields = group.fields.map((field) => {
    const path = `${group.id}.${field.key}`;
    return renderField(field, path, RF.getAtPath(profile, path));
  }).join('');
  return `<div class="field-grid">${fields}</div>`;
}

function renderList(group) {
  const list = profile[group.id] || [];
  const cards = list.map((record, index) => {
    const fields = group.fields.map((field) => {
      const path = `${group.id}.${index}.${field.key}`;
      return renderField(field, path, RF.getAtPath(profile, path));
    }).join('');
    return `
      <article class="card" id="card-${group.id}-${index}">
        <header class="card-head">
          <h3>${escapeHtml(group.itemName)} ${index + 1}</h3>
          <button type="button" class="link danger" data-action="remove" data-group="${group.id}" data-index="${index}"
            ${list.length <= 1 ? 'disabled title="至少保留一条"' : ''}>删除</button>
        </header>
        <div class="field-grid">${fields}</div>
      </article>`;
  }).join('');

  return `${cards}
    <button type="button" class="add-btn" data-action="add" data-group="${group.id}">＋ 添加${escapeHtml(group.itemName)}</button>`;
}

function renderQA() {
  const list = profile.qa || [];
  if (!list.length) {
    return `<div class="empty">
      <p>还没有语料。常见题目如「为什么选择我们公司」「你的职业规划」「最有成就感的一件事」。</p>
      <button type="button" class="add-btn" data-action="add-qa">＋ 添加一条语料</button>
    </div>`;
  }
  const cards = list.map((qa, index) => `
    <article class="card">
      <header class="card-head">
        <h3>语料 ${index + 1}</h3>
        <button type="button" class="link danger" data-action="remove-qa" data-index="${index}">删除</button>
      </header>
      <div class="field-grid">
        <label class="field span-2">
          <span class="field-label">关键词</span>
          <input type="text" data-path="qa.${index}.keywords" value="${escapeHtml(qa.keywords)}" placeholder="职业规划, 五年, 未来">
          <small>用逗号分隔。题目命中任意关键词时使用这条答案。</small>
        </label>
        <label class="field span-2">
          <span class="field-label">题目（可选）</span>
          <input type="text" data-path="qa.${index}.question" value="${escapeHtml(qa.question)}" placeholder="你的职业规划是什么？">
        </label>
        <label class="field span-2">
          <span class="field-label">参考答案</span>
          <textarea data-path="qa.${index}.answer" rows="4" placeholder="第一人称、具体、结合经历，120—220 字。">${escapeHtml(qa.answer)}</textarea>
        </label>
      </div>
    </article>`).join('');
  return `${cards}<button type="button" class="add-btn" data-action="add-qa">＋ 添加一条语料</button>`;
}

function renderGroup(group) {
  const body = group.type === 'qa' ? renderQA() : group.type === 'list' ? renderList(group) : renderFields(group);
  return `
    <section class="panel" id="group-${group.id}">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(group.title)}</h2>
          <p>${escapeHtml(group.desc)}</p>
        </div>
      </div>
      ${body}
    </section>`;
}

function renderAll() {
  formRoot.innerHTML = GROUPS.map(renderGroup).join('');
  bindAutoTextareas();
}

function bindAutoTextareas() {
  formRoot.querySelectorAll('textarea').forEach((textarea) => {
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(74, textarea.scrollHeight) + 'px';
    };
    textarea.addEventListener('input', resize);
    resize();
  });
}

function renderNav() {
  nav.innerHTML = GROUPS.map((group) => `
    <button type="button" data-target="group-${group.id}">
      <span>${escapeHtml(group.title)}</span>
    </button>`).join('') +
    '<button type="button" data-target="ai"><span>AI 开放题</span></button>';
  nav.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function updateActiveNav() {
  const sections = Array.from(document.querySelectorAll('.panel'));
  let current = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= 140) current = section;
  });
  nav.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.target === current.id);
  });
}

/* ---------------- 数据绑定 ---------------- */

formRoot.addEventListener('input', (event) => {
  const control = event.target.closest('[data-path]');
  if (!control) return;
  RF.setAtPath(profile, control.dataset.path, control.value);
  scheduleSave();
});

formRoot.addEventListener('change', (event) => {
  const control = event.target.closest('[data-path]');
  if (!control) return;
  RF.setAtPath(profile, control.dataset.path, control.value);
  scheduleSave();
});

formRoot.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'add') {
    const group = GROUPS.find((item) => item.id === button.dataset.group);
    profile[group.id].push(group.factory());
    renderAll();
    await saveNow();
    const cards = formRoot.querySelectorAll(`#group-${group.id} .card`);
    const last = cards[cards.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('已添加一条' + group.itemName);
    return;
  }

  if (action === 'remove') {
    const groupId = button.dataset.group;
    const index = Number(button.dataset.index);
    if (!confirm('确定删除这条记录吗？')) return;
    profile[groupId].splice(index, 1);
    renderAll();
    await saveNow();
    toast('已删除');
    return;
  }

  if (action === 'add-qa') {
    profile.qa.push(RF.emptyQA());
    renderAll();
    await saveNow();
    toast('已添加一条语料');
    return;
  }

  if (action === 'remove-qa') {
    const index = Number(button.dataset.index);
    if (!confirm('确定删除这条语料吗？')) return;
    profile.qa.splice(index, 1);
    renderAll();
    await saveNow();
    toast('已删除');
  }
});

/* ---------------- AI 设置 ---------------- */

function syncAiInputs() {
  const ai = settings.ai;
  document.querySelectorAll('[data-ai]').forEach((input) => {
    const key = input.dataset.ai;
    if (input.type === 'checkbox') input.checked = !!ai[key];
    else input.value = ai[key] == null ? '' : ai[key];
  });
}

document.querySelectorAll('[data-ai]').forEach((input) => {
  const handler = () => {
    const key = input.dataset.ai;
    if (input.type === 'checkbox') settings.ai[key] = input.checked;
    else if (key === 'temperature') settings.ai[key] = Number(input.value) || 0.4;
    else settings.ai[key] = input.value;
    scheduleSettingsSave();
  };
  input.addEventListener('input', handler);
  input.addEventListener('change', handler);
});

$('#toggleKey').addEventListener('click', () => {
  const input = document.querySelector('[data-ai="apiKey"]');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('#toggleKey').textContent = show ? '隐藏' : '显示';
});

$('#testAiBtn').addEventListener('click', async () => {
  if (testBusy) return;
  const result = $('#testResult');
  testBusy = true;
  $('#testAiBtn').disabled = true;
  result.className = '';
  result.textContent = '正在调用接口…';
  try {
    clearTimeout(settingsTimer);
    settings = await RF.saveSettings(settings);
    if (!settings.ai.apiKey) {
      result.textContent = '请先填写 API Key。';
      return;
    }
    const response = await chrome.runtime.sendMessage({ type: 'RF_TEST_AI', profile });
    if (response && response.ok) {
      result.className = 'ok';
      result.textContent = '连接成功，示例：' + String(response.sample || '').slice(0, 120) + '…';
    } else {
      result.className = 'err';
      result.textContent = '失败：' + ((response && response.error) || '未知错误');
    }
  } catch (error) {
    result.className = 'err';
    result.textContent = '失败：' + (error && error.message ? error.message : String(error));
  } finally {
    testBusy = false;
    $('#testAiBtn').disabled = false;
  }
});

/* ---------------- PDF 简历导入 ---------------- */

const pdfEls = {
  dialog: $('#pdfDialog'),
  openBtn: $('#pdfImportBtn'),
  file: $('#pdfFile'),
  drop: $('#pdfDrop'),
  status: $('#pdfStatus'),
  preview: $('#pdfPreview'),
  rawWrap: $('#pdfRawWrap'),
  raw: $('#pdfRaw'),
  ai: $('#pdfAi'),
  apply: $('#pdfApply'),
  cancel: $('#pdfCancel'),
  close: $('#pdfClose')
};

const pdfState = { parsed: null, text: '', busy: false, usedAI: false };

const BASIC_LABELS = {
  name: '姓名', gender: '性别', birthDate: '出生日期', phone: '手机号', email: '邮箱',
  idCard: '身份证号', ethnicity: '民族', politicalStatus: '政治面貌', hometown: '籍贯',
  household: '户口所在地', maritalStatus: '婚姻状况', height: '身高', weight: '体重',
  address: '现居地址', postalCode: '邮编', wechat: '微信', qq: 'QQ',
  expectedCity: '期望城市', expectedPosition: '期望职位', expectedSalary: '期望薪资',
  availableDate: '到岗时间', website: '个人主页', github: 'GitHub', selfEvaluation: '自我评价'
};

function pdfSetStatus(text, tone) {
  pdfEls.status.textContent = text || '';
  pdfEls.status.className = 'pdf-status' + (tone ? ' ' + tone : '');
}

function pdfReset() {
  pdfState.parsed = null;
  pdfState.text = '';
  pdfState.busy = false;
  pdfState.usedAI = false;
  pdfEls.file.value = '';
  pdfEls.apply.disabled = true;
  pdfEls.preview.classList.add('hidden');
  pdfEls.rawWrap.classList.add('hidden');
  pdfEls.preview.innerHTML = '';
  pdfEls.raw.textContent = '';
  pdfSetStatus('');
  document.querySelector('input[name="pdfMode"][value="merge"]').checked = true;
}

function pdfOpen() {
  if (!settings) return;
  pdfReset();
  const aiReady = !!(settings.ai.apiKey);
  pdfEls.ai.disabled = !aiReady;
  pdfEls.ai.checked = false;
  pdfEls.ai.closest('label').title = aiReady ? '调用你配置的 AI 接口做更完整的结构化解析' : '请先在下方 AI 设置里填写 API Key';
  if (!window.RFPDF) pdfSetStatus('PDF 解析组件加载中，请稍候…');
  if (!pdfEls.dialog.open) pdfEls.dialog.showModal();
}

function pdfClose() {
  if (pdfEls.dialog.open) pdfEls.dialog.close();
}

function waitForPdf(timeoutMs) {
  return new Promise((resolve, reject) => {
    if (window.RFPDF) {
      resolve(window.RFPDF);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.RFPDF) {
        clearInterval(timer);
        resolve(window.RFPDF);
      } else if (Date.now() - started > (timeoutMs || 8000)) {
        clearInterval(timer);
        reject(new Error('PDF 解析组件加载失败，请刷新设置页重试'));
      }
    }, 100);
  });
}

function pdfChip(text) {
  return `<span class="chip">${escapeHtml(text)}</span>`;
}

function pdfRender(parsed, usedAI, warning) {
  const basic = parsed.basic || {};
  const papers = parsed.papers || [];
  const honors = parsed.honors || [];
  const educations = parsed.educations || [];
  const internships = parsed.internships || [];
  const skills = parsed.skills || {};

  const chips = [];
  if (basic.name) chips.push(pdfChip('姓名：' + basic.name));
  if (educations.length) chips.push(pdfChip(`教育 ${educations.length} 条`));
  if (papers.length) chips.push(pdfChip(`论文 ${papers.length} 篇`));
  if (honors.length) chips.push(pdfChip(`荣誉 ${honors.length} 项`));
  if (internships.length) chips.push(pdfChip(`实习 ${internships.length} 段`));
  if (usedAI) chips.push(pdfChip('AI 精细解析'));

  const sections = [];

  const basicLines = Object.keys(BASIC_LABELS)
    .filter((key) => String(basic[key] || '').trim() && key !== 'selfEvaluation')
    .map((key) => `${BASIC_LABELS[key]}：${basic[key]}`);
  if (basicLines.length) {
    sections.push(`<h3>基本信息</h3><ul>${basicLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  if (educations.length) {
    const items = educations.map((edu) => [
      edu.school, edu.college, edu.degree, edu.major,
      [edu.startDate, edu.endDate].filter(Boolean).join(' — ')
    ].filter(Boolean).join(' · '));
    sections.push(`<h3>教育经历</h3><ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  if (papers.length) {
    const items = papers.map((paper) => [
      paper.title, paper.journal, paper.publishDate, paper.rank, paper.link
    ].filter(Boolean).join(' · '));
    sections.push(`<h3>论文发表</h3><ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  if (honors.length) {
    const items = honors.map((honor) => [honor.awardDate, honor.name].filter(Boolean).join(' · '));
    sections.push(`<h3>荣誉奖励</h3><ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  if (internships.length) {
    const items = internships.map((item) => [item.company, item.position].filter(Boolean).join(' · '));
    sections.push(`<h3>实习经历</h3><ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  const skillLines = [
    skills.languages ? `语言：${skills.languages}` : '',
    skills.certificates ? `证书：${skills.certificates}` : '',
    skills.software ? `技能：${skills.software}` : ''
  ].filter(Boolean);
  if (skillLines.length) {
    sections.push(`<h3>技能与证书</h3><ul>${skillLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
  }

  if (basic.selfEvaluation) {
    sections.push(`<h3>自我评价</h3><p class="muted">${escapeHtml(String(basic.selfEvaluation).slice(0, 300))}</p>`);
  }

  const body = sections.length
    ? sections.join('')
    : '<p class="muted">没有识别到可填充内容。扫描件或排版特殊的 PDF 可能需要手动补充。</p>';

  pdfEls.preview.innerHTML = `
    <div class="summary-chips">${chips.join('')}</div>
    ${warning ? `<p class="muted">${escapeHtml(warning)}</p>` : ''}
    ${body}
  `;
  pdfEls.preview.classList.remove('hidden');
}

async function pdfReadFile(file) {
  if (!file || pdfState.busy) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    pdfSetStatus('请选择 PDF 文件。', 'error');
    return;
  }

  pdfState.busy = true;
  pdfEls.apply.disabled = true;
  pdfEls.preview.classList.add('hidden');
  pdfEls.rawWrap.classList.add('hidden');
  pdfSetStatus('正在读取 PDF…');

  try {
    const api = await waitForPdf();
    const text = await api.extractText(file);
    if (String(text).replace(/\s/g, '').length < 20) {
      throw new Error('没有提取到文字，可能是扫描件或图片型 PDF；请换一份文字版 PDF。');
    }

    pdfState.text = text;
    pdfEls.raw.textContent = text;
    pdfEls.rawWrap.classList.remove('hidden');

    pdfSetStatus('正在识别字段…');
    let parsed = RF.parseResumeText(text);
    let usedAI = false;
    let warning = '';

    if (pdfEls.ai.checked && settings.ai.apiKey) {
      pdfSetStatus('正在调用 AI 精细解析…');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'RF_AI_RESUME', text });
        if (response && response.ok && response.profile) {
          parsed = RF.mergeParsedProfile(response.profile, parsed, 'merge');
          usedAI = true;
        } else {
          warning = 'AI 解析失败：' + ((response && response.error) || '未知错误') + '，已使用本地规则。';
        }
      } catch (error) {
        warning = 'AI 解析失败：' + (error && error.message ? error.message : String(error)) + '，已使用本地规则。';
      }
    }

    pdfState.parsed = parsed;
    pdfState.usedAI = usedAI;
    pdfRender(parsed, usedAI, warning);

    const counts = [
      parsed.educations.length ? `教育 ${parsed.educations.length}` : '',
      parsed.internships.length ? `实习 ${parsed.internships.length}` : '',
      parsed.papers.length ? `论文 ${parsed.papers.length}` : '',
      parsed.honors.length ? `荣誉 ${parsed.honors.length}` : ''
    ].filter(Boolean).join(' · ');
    pdfSetStatus(`已提取 ${text.length} 字${counts ? '，识别到 ' + counts : ''}。确认后点击「应用到简历」。`, 'ok');
    pdfEls.apply.disabled = false;
  } catch (error) {
    pdfSetStatus('解析失败：' + (error && error.message ? error.message : String(error)), 'error');
    pdfEls.apply.disabled = true;
  } finally {
    pdfState.busy = false;
  }
}

async function pdfApply() {
  if (!pdfState.parsed) return;
  const mode = document.querySelector('input[name="pdfMode"]:checked')?.value || 'merge';
  try {
    profile = RF.mergeParsedProfile(profile, pdfState.parsed, mode);
    await saveNow();
    renderAll();
    pdfClose();
    toast(mode === 'overwrite' ? '已用 PDF 解析结果覆盖对应模块' : '已把 PDF 解析结果合并到简历');
  } catch (error) {
    pdfSetStatus('应用失败：' + (error && error.message ? error.message : String(error)), 'error');
  }
}

pdfEls.openBtn.addEventListener('click', pdfOpen);
pdfEls.cancel.addEventListener('click', pdfClose);
pdfEls.close.addEventListener('click', pdfClose);
pdfEls.apply.addEventListener('click', pdfApply);
pdfEls.file.addEventListener('change', () => {
  const file = pdfEls.file.files && pdfEls.file.files[0];
  if (file) pdfReadFile(file);
});
['dragenter', 'dragover'].forEach((type) => {
  pdfEls.drop.addEventListener(type, (event) => {
    event.preventDefault();
    pdfEls.drop.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((type) => {
  pdfEls.drop.addEventListener(type, () => pdfEls.drop.classList.remove('dragover'));
});
pdfEls.drop.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) pdfReadFile(file);
});
pdfEls.dialog.addEventListener('click', (event) => {
  if (event.target === pdfEls.dialog) pdfClose();
});
window.addEventListener('rf-pdf-ready', () => {
  if (pdfEls.dialog.open && /加载中/.test(pdfEls.status.textContent)) pdfSetStatus('');
});

/* ---------------- 导入 / 导出 / 示例 / 清空 ---------------- */

$('#exportBtn').addEventListener('click', async () => {
  await saveNow();
  const payload = {
    app: '简填 · 网申助手',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    profile
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const name = profile.basic.name || '简历';
  link.href = url;
  link.download = `简填-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('已导出简历 JSON（不含 API Key）');
});

$('#importBtn').addEventListener('click', () => $('#importFile').click());

$('#importFile').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = parsed.profile || parsed;
    if (!incoming || typeof incoming !== 'object') throw new Error('JSON 中没有简历数据');
    if (!confirm('导入会覆盖当前简历资料，继续吗？')) return;
    profile = await RF.saveProfile(incoming);
    renderAll();
    toast('导入成功');
  } catch (error) {
    toast('导入失败：' + (error && error.message ? error.message : String(error)), 'error');
  } finally {
    event.target.value = '';
  }
});

$('#demoBtn').addEventListener('click', async () => {
  if (!confirm('载入示例资料会覆盖当前简历，继续吗？')) return;
  profile = await RF.saveProfile(RF.demoProfile());
  renderAll();
  toast('示例资料已载入，去任意网申页面点插件试试');
});

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('将清空本机保存的简历、语料和 AI 配置，且无法恢复。继续吗？')) return;
  if (!confirm('再确认一次：确定清空全部资料？')) return;
  await chrome.storage.local.remove([RF.PROFILE_KEY, RF.SETTINGS_KEY]);
  profile = RF.defaultProfile();
  settings = RF.defaultSettings();
  await RF.saveProfile(profile);
  await RF.saveSettings(settings);
  syncAiInputs();
  renderAll();
  toast('已清空本机资料');
});

/* ---------------- 初始化 ---------------- */

async function init() {
  const state = await RF.getState();
  profile = state.profile;
  settings = state.settings;
  renderNav();
  renderAll();
  syncAiInputs();

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  if (!RF.isMeaningfulProfile(profile)) {
    setSaveState('等待填写', '');
  }
}

init().catch((error) => {
  toast('初始化失败：' + (error && error.message ? error.message : String(error)), 'error');
});
