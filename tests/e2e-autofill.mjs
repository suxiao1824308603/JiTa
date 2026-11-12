/**
 * 端到端测试：用真实浏览器加载插件，打开仿真网申页面，验证自动填写结果。
 *
 * 运行：
 *   node tests/e2e-autofill.mjs
 *
 * 环境变量：
 *   RF_BROWSER  浏览器可执行文件路径（默认使用 Edge；Chrome 137+ 已禁用 --load-extension）
 *
 * 产物（截图）输出到 tests/artifacts/。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ARTIFACTS = path.join(ROOT, 'tests', 'artifacts');
const PORT = 8791;
const CDP_PORT = 9333;
const BROWSER = process.env.RF_BROWSER ||
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DEMO_URL = `${BASE_URL}/demo/application-form.html`;
const VARIANT_URL = `${BASE_URL}/demo/form-variants.html`;
const ANTD_URL = `${BASE_URL}/demo/antd-form.html`;
const DYNAMIC_URL = `${BASE_URL}/demo/dynamic-add.html`;

fs.mkdirSync(ARTIFACTS, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- 静态服务器 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    // 本地 mock 的 OpenAI 兼容接口，用来验证 AI 链路（不访问外网）
    if (req.method === 'POST' && url.pathname === '/mock-ai/chat/completions') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try {
          payload = JSON.parse(body);
        } catch (error) { /* 忽略无效请求 */ }

        const system = String(payload.messages?.[0]?.content || '');
        if (system.includes('简历结构化解析器')) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  basic: { name: '李四', phone: '13700000000' },
                  papers: [{
                    title: 'AI 解析出的论文', journal: '《AI 学报》',
                    publishDate: '2025-01', rank: '第一作者'
                  }],
                  honors: [{ name: 'AI 解析出的荣誉', awardDate: '2024-05' }]
                })
              }
            }]
          }));
          return;
        }

        let questions = [];
        try {
          const user = JSON.parse(payload.messages[1].content);
          questions = user.questions || [];
        } catch (error) { /* 使用空数组 */ }
        const answers = questions.map((item, index) =>
          `这是第 ${index + 1} 道题的模拟回答：结合候选人的后端实习与项目经历，说明自己与岗位的匹配度。`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ answers }) } }]
        }));
      });
      return;
    }

    const relative = decodeURIComponent(url.pathname === '/' ? '/demo/application-form.html' : url.pathname);
    const filePath = path.resolve(ROOT, '.' + relative);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

/* ---------------- CDP 客户端 ---------------- */

class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params?.exceptionDetails;
        this.errors.push(detail?.exception?.description || detail?.text || 'unknown exception');
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
        this.errors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

async function waitFor(fn, timeoutMs, intervalMs, label) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`等待超时：${label}${lastError ? `（最后错误：${lastError.message}）` : ''}`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
}

function extensionIdFromUrl(url) {
  const match = String(url).match(/chrome-extension:\/\/([a-p]{32})\//);
  return match ? match[1] : '';
}

/* ---------------- 启动浏览器 ---------------- */

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-browser-'));
const browserProcess = spawn(BROWSER, [
  '--headless=new',
  '--no-sandbox',
  '--disable-crash-reporter',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  `--disable-extensions-except=${ROOT}`,
  `--load-extension=${ROOT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--remote-allow-origins=*',
  '--window-size=1280,1700',
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

let browser = null;
let optionsSession = null;

async function cleanup() {
  try {
    if (browser) browser.ws.close();
  } catch (error) { /* ignore */ }
  await new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(browserProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    });
    killer.on('exit', resolve);
    killer.on('error', resolve);
  });
  server.close();
}

try {
  const version = await waitFor(async () => {
    try {
      return await getJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    } catch (error) {
      return null;
    }
  }, 20000, 250, '浏览器 DevTools 端口');

  browser = new CDP(version.webSocketDebuggerUrl);
  await browser.connect();

  // 找到插件自动打开的设置页，或本扩展的 Service Worker，从而拿到扩展 ID
  const extensionTarget = await waitFor(async () => {
    const { targetInfos } = await browser.send('Target.getTargets');
    return targetInfos.find((target) => target.url.includes('/src/options/options.html') ||
      target.url.includes('/src/background/service-worker.js')) || null;
  }, 20000, 300, '插件设置页 / Service Worker');

  const extensionId = extensionIdFromUrl(extensionTarget.url);
  if (!extensionId) throw new Error('无法从目标 URL 解析扩展 ID：' + extensionTarget.url);

  let optionsTargetId = extensionTarget.type === 'page' ? extensionTarget.targetId : '';
  if (!optionsTargetId) {
    const created = await browser.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/src/options/options.html`
    });
    optionsTargetId = created.targetId;
  }

  const attached = await browser.send('Target.attachToTarget', { targetId: optionsTargetId, flatten: true });
  optionsSession = attached.sessionId;
  await browser.send('Runtime.enable', {}, optionsSession);
  await browser.send('Page.enable', {}, optionsSession);

  const evaluateOptions = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    }, optionsSession);
    if (result.exceptionDetails) {
      throw new Error('设置页执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  // 等待设置页脚本渲染完成
  try {
    await waitFor(async () => {
      const count = await evaluateOptions("document.querySelectorAll('[data-path]').length");
      return count > 30 ? count : 0;
    }, 10000, 250, '设置页渲染');
  } catch (error) {
    const diagnostics = await evaluateOptions(`(() => ({
      href: location.href,
      title: document.title,
      ready: document.readyState,
      rf: typeof RF,
      paths: document.querySelectorAll('[data-path]').length
    }))()`);
    console.error('设置页诊断：', diagnostics);
    throw error;
  }

  const optionsInfo = await evaluateOptions(`(async () => {
    const profile = RF.demoProfile();
    await RF.saveProfile(profile);
    await RF.saveSettings(Object.assign(RF.defaultSettings(), {
      autoFillDomains: ['127.0.0.1'],
      overwriteExisting: false,
      highlight: true
    }));
    return {
      title: document.title,
      fields: document.querySelectorAll('[data-path]').length,
      name: profile.basic.name
    };
  })()`);

  // 重载设置页，验证保存的资料能正确回填到表单
  await browser.send('Page.reload', {}, optionsSession);
  await waitFor(async () => {
    const email = await evaluateOptions("document.querySelector('[data-path=\"basic.email\"]')?.value || ''");
    return email === 'zhangsan@example.com';
  }, 10000, 300, '设置页读取已保存资料');
  const persisted = await evaluateOptions(`(() => ({
    name: document.querySelector('[data-path="basic.name"]').value,
    email: document.querySelector('[data-path="basic.email"]').value,
    school: document.querySelector('[data-path="educations.0.school"]').value,
    gender: document.querySelector('[data-path="basic.gender"]').value
  }))()`);

  // 设置页截图
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false
  }, optionsSession);
  const optionsShot = await browser.send('Page.captureScreenshot', { format: 'png' }, optionsSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'options-page.png'), Buffer.from(optionsShot.data, 'base64'));

  // 打开演示网申页面
  const demoCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const demoTargetId = demoCreated.targetId;
  const demoAttached = await browser.send('Target.attachToTarget', { targetId: demoTargetId, flatten: true });
  const demoSession = demoAttached.sessionId;
  await browser.send('Runtime.enable', {}, demoSession);
  await browser.send('Page.enable', {}, demoSession);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 1700, deviceScaleFactor: 1, mobile: false
  }, demoSession);
  await browser.send('Page.navigate', { url: DEMO_URL }, demoSession);

  const evaluateDemo = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    }, demoSession);
    if (result.exceptionDetails) {
      throw new Error('演示页执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  const data = await waitFor(async () => {
    const value = await evaluateDemo('window.__demoFormData ? window.__demoFormData() : null');
    return value && value.realName ? value : null;
  }, 15000, 300, '自动填写');

  // 自定义下拉带展开/选择动画，等填写流程完全结束后再统一断言
  await sleep(2600);
  const settled = await evaluateDemo('window.__demoFormData()');
  Object.keys(settled).forEach((key) => { data[key] = settled[key]; });

  const checks = [];
  const expect = (field, expected) => {
    const actual = data[field];
    const pass = String(actual || '').trim() === String(expected).trim();
    checks.push({ field, expected, actual: actual ?? '', pass });
  };

  // 旧版本数据：新增学院 / 论文链接 / 岗位字段时，原有内容必须保留
  const legacy = await evaluateOptions(`(() => {
    const profile = RF.normalizeProfile({
      basic: { name: '旧用户', phone: '13900000000' },
      educations: [{ school: '旧大学', major: '旧专业' }],
      internships: [{ company: '旧公司', position: '旧岗位' }],
      papers: [{ title: '旧论文', journal: '旧期刊' }],
      skills: { awards: '旧奖学金；旧荣誉' }
    });
    return {
      name: profile.basic.name,
      phone: profile.basic.phone,
      school: profile.educations[0].school,
      major: profile.educations[0].major,
      college: profile.educations[0].college,
      company: profile.internships[0].company,
      position: profile.internships[0].position,
      paperTitle: profile.papers[0].title,
      paperJournal: profile.papers[0].journal,
      paperLink: profile.papers[0].link,
      honors: profile.honors.map((honor) => honor.name)
    };
  })()`);
  checks.push({
    field: '旧数据保留',
    expected: '原有字段不丢失，新增字段为空',
    actual: `${legacy.name} / ${legacy.school} / ${legacy.position} / ${legacy.paperTitle} / 荣誉 ${legacy.honors.length} 项`,
    pass: legacy.name === '旧用户' && legacy.phone === '13900000000' &&
      legacy.school === '旧大学' && legacy.major === '旧专业' && legacy.college === '' &&
      legacy.company === '旧公司' && legacy.position === '旧岗位' &&
      legacy.paperTitle === '旧论文' && legacy.paperJournal === '旧期刊' && legacy.paperLink === '' &&
      legacy.honors.includes('旧奖学金') && legacy.honors.includes('旧荣誉')
  });

  expect('realName', '张三');
  expect('gender', '男');
  expect('birth', '2001-03');
  expect('phone', '13800138000');
  expect('email', 'zhangsan@example.com');
  expect('political', '中共党员');
  expect('hometown', '江苏南京');
  expect('expectedCity', '上海');
  expect('position', '后端开发工程师');
  expect('available', '2026-07');
  expect('edu1_school', '上海交通大学');
  expect('edu1_college', '电子信息与电气工程学院');
  expect('edu1_major', '计算机技术');
  expect('edu1_degree', '硕士');
  expect('edu1_start', '2024-09');
  expect('edu1_end', '2026-06');
  expect('edu1_gpa', '3.8/4.0');
  expect('edu2_school', '南京大学');
  expect('edu2_college', '计算机学院');
  expect('edu2_major', '软件工程');
  expect('edu2_degree', '本科');
  expect('edu2_start', '2020-09');
  expect('int_company', '星云科技（上海）有限公司');
  expect('int_dept', '基础架构部');
  expect('int_position', '后端开发实习生');
  expect('int_city', '上海');
  expect('int_start', '2025-06');
  expect('int_end', '2025-09');
  expect('proj_name', '分布式任务调度系统');
  expect('proj_role', '后端负责人');
  expect('proj_tech', 'Go、etcd、MySQL、Prometheus、Docker');
  expect('paper1_title', '基于 etcd 的分布式任务调度系统设计与实现');
  expect('paper1_journal', '《计算机工程与应用》');
  expect('paper1_date', '2025-03');
  expect('paper1_rank', '第一作者');
  expect('paper1_link', 'https://doi.org/10.3778/j.issn.1002-8331.2403-0123');
  expect('paper2_title', '面向高并发场景的缓存分层优化方法');
  expect('paper2_journal', '《计算机应用研究》');
  expect('paper2_date', '2024-11');
  expect('paper2_rank', '第二作者');
  expect('paper2_link', 'https://doi.org/10.3969/j.issn.1001-3695.2024.11.008');
  expect('honor1_name', '国家奖学金');
  expect('honor1_date', '2023-10');
  expect('honor2_name', '全国大学生软件创新大赛二等奖');
  expect('honor2_date', '2023-08');
  expect('honor3_name', '校优秀学生干部');
  expect('honor3_date', '2022-12');
  expect('lang', '英语 CET-6（580）；日语 N3');
  expect('cert', '计算机技术与软件专业技术资格（中级）；CET-6');
  expect('skills', 'Java、Go、MySQL、Redis、Kafka、Docker、Kubernetes、Git');

  checks.push({
    field: 'int_desc(包含)',
    expected: '包含「订单中心」',
    actual: String(data.int_desc || '').slice(0, 30),
    pass: String(data.int_desc || '').includes('订单中心')
  });
  checks.push({
    field: 'proj_desc(包含)',
    expected: '包含「任务调度平台」',
    actual: String(data.proj_desc || '').slice(0, 30),
    pass: String(data.proj_desc || '').includes('任务调度平台')
  });
  const agreeChecked = await evaluateDemo('document.getElementById("agree").checked');
  checks.push({
    field: 'agree(不应勾选)',
    expected: 'false',
    actual: String(agreeChecked),
    pass: agreeChecked === false
  });

  // 字段诊断（从设置页调用 scripting API）
  const scan = await evaluateOptions(`(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((item) => item.url && item.url.includes('application-form'));
    if (!tab) return { error: '找不到演示页面标签页' };
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.RF.scanPage()
    });
    return result[0].result;
  })()`);

  const matched = scan ? scan.fields.filter((field) => field.key).length : 0;
  checks.push({
    field: 'scan.total',
    expected: '>= 58',
    actual: scan ? scan.total : 'null',
    pass: !!scan && scan.total >= 58
  });
  checks.push({
    field: 'scan.matched',
    expected: '>= 54',
    actual: matched,
    pass: matched >= 54
  });

  // 开放题：本地语料库应命中「职业规划」
  const aiResult = await evaluateOptions(`(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((item) => item.url && item.url.includes('application-form'));
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.RF.fillOpenQuestions({ silent: true })
    });
    return result[0].result;
  })()`);

  const q3 = await evaluateDemo('document.getElementById("q3").value');
  checks.push({
    field: '开放题-语料库',
    expected: 'q3 已填写且来自语料库',
    actual: `${aiResult ? aiResult.fromBank : 0} 条 / ${String(q3).slice(0, 18)}…`,
    pass: !!aiResult && aiResult.fromBank === 1 && String(q3).includes('短期')
  });

  // 截图（填表后的页面）
  const layout = await browser.send('Page.getLayoutMetrics', {}, demoSession);
  const contentHeight = Math.min(Math.ceil(layout.cssContentSize.height), 5200);
  await sleep(300);
  const shot = await browser.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1280, height: contentHeight, scale: 1 }
  }, demoSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'filled-form.png'), Buffer.from(shot.data, 'base64'));

  // 用本地 mock 接口验证 AI 通道（不访问外网）
  await evaluateOptions(`(async () => {
    const state = await RF.getState();
    state.settings.ai = Object.assign({}, state.settings.ai, {
      enabled: true,
      baseURL: 'http://127.0.0.1:${PORT}/mock-ai',
      apiKey: 'test-key',
      model: 'mock-model'
    });
    await RF.saveSettings(state.settings);
    return true;
  })()`);

  const aiFill = await evaluateOptions(`(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((item) => item.url && item.url.includes('application-form'));
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.RF.fillOpenQuestions({ silent: true })
    });
    return result[0].result;
  })()`);
  const q1 = await evaluateDemo('document.getElementById("q1").value');
  const q2 = await evaluateDemo('document.getElementById("q2").value');
  checks.push({
    field: '开放题-AI',
    expected: 'q1/q2 各由 AI 填写',
    actual: `${aiFill ? aiFill.fromAI : 0} 条 / ${String(q1).slice(0, 16)}…`,
    pass: !!aiFill && aiFill.fromAI === 2 &&
      String(q1).includes('模拟回答') && String(q2).includes('模拟回答')
  });

  // 弹窗实测：把「当前标签页」模拟成演示页面
  const demoTabId = await evaluateOptions(`(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((item) => item.url && item.url.includes('application-form'));
    return tab ? tab.id : null;
  })()`);

  const popupCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const popupSession = (await browser.send('Target.attachToTarget', {
    targetId: popupCreated.targetId,
    flatten: true
  })).sessionId;
  await browser.send('Runtime.enable', {}, popupSession);
  await browser.send('Page.enable', {}, popupSession);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 380, height: 620, deviceScaleFactor: 2, mobile: false
  }, popupSession);
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
      chrome.tabs.query = async () => ([{
        id: ${demoTabId},
        url: ${JSON.stringify(DEMO_URL)},
        active: true,
        windowId: 1
      }]);
    } catch (error) {
      window.__rfPatchError = String(error);
    }`
  }, popupSession);
  await browser.send('Page.navigate', {
    url: `chrome-extension://${extensionId}/src/popup/popup.html`
  }, popupSession);

  const evaluatePopup = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true
    }, popupSession);
    if (result.exceptionDetails) {
      throw new Error('弹窗执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  const popupName = await waitFor(async () => {
    const name = await evaluatePopup("document.getElementById('profileName').textContent");
    return name && name !== '未填写简历' ? name : '';
  }, 10000, 300, '弹窗渲染');

  const popupShot = await browser.send('Page.captureScreenshot', { format: 'png' }, popupSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'popup.png'), Buffer.from(popupShot.data, 'base64'));

  // 弹窗「一键填写」真实链路：先重置演示表单，再通过弹窗触发填写
  await evaluateDemo('document.getElementById("resetBtn").click()');
  await evaluatePopup("document.getElementById('fillBtn').click()");
  const fillStatus = await waitFor(async () => {
    const text = await evaluatePopup("document.getElementById('status').textContent");
    return text && text.includes('已填写') ? text : '';
  }, 15000, 400, '弹窗一键填写');
  const refilled = await evaluateDemo('window.__demoFormData()');
  checks.push({
    field: '弹窗一键填写',
    expected: '状态显示已填写，且表单重新填好',
    actual: `${fillStatus} / 姓名=${refilled.realName} / 城市=${refilled.expectedCity}`,
    pass: fillStatus.includes('已填写') && refilled.realName === '张三' && refilled.expectedCity === '上海'
  });

  await evaluatePopup("document.getElementById('scanBtn').click()");
  const diagSummary = await waitFor(async () => {
    const text = await evaluatePopup("document.getElementById('diagSummary').textContent");
    return text && text.includes('识别到') ? text : '';
  }, 10000, 300, '弹窗字段诊断');
  const diagShot = await browser.send('Page.captureScreenshot', { format: 'png' }, popupSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'popup-diagnostics.png'), Buffer.from(diagShot.data, 'base64'));

  checks.push({
    field: '设置页回填',
    expected: '张三 / zhangsan@example.com / 上海交通大学',
    actual: `${persisted.name} / ${persisted.email} / ${persisted.school}`,
    pass: persisted.name === '张三' && persisted.email === 'zhangsan@example.com' &&
      persisted.school === '上海交通大学' && persisted.gender === '男'
  });
  checks.push({
    field: '弹窗渲染',
    expected: '张三',
    actual: popupName,
    pass: popupName === '张三'
  });
  checks.push({
    field: '弹窗诊断',
    expected: `包含「已匹配 ${matched}」`,
    actual: diagSummary,
    pass: String(diagSummary).includes(`已匹配 ${matched}`)
  });

  // 结构变体：表格布局、占位符、英文标签、隐藏单选框、跨章节同名「开始时间」
  const variantCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const variantSession = (await browser.send('Target.attachToTarget', {
    targetId: variantCreated.targetId,
    flatten: true
  })).sessionId;
  await browser.send('Runtime.enable', {}, variantSession);
  await browser.send('Page.enable', {}, variantSession);
  await browser.send('Page.navigate', { url: VARIANT_URL }, variantSession);

  const evaluateVariant = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    }, variantSession);
    if (result.exceptionDetails) {
      throw new Error('变体页执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  await waitFor(async () => {
    const value = await evaluateVariant('window.__variantData ? window.__variantData() : null');
    return value && value.v_name ? value : null;
  }, 15000, 300, '变体页自动填写');
  await sleep(800);
  const variant = await evaluateVariant('window.__variantData()');

  [
    ['v_name', '张三'],
    ['v_phone', '13800138000'],
    ['v_email', 'zhangsan@example.com'],
    ['v_gender', 'male'],
    ['v_fullname', '张三'],
    ['v_school', '上海交通大学'],
    ['v_major', '计算机技术'],
    ['v_start', '2024-09'],
    ['v_company', '星云科技（上海）有限公司'],
    ['v_int_start', '2025-06']
  ].forEach(([field, expected]) => {
    const actual = variant[field];
    checks.push({
      field: '变体页-' + field,
      expected,
      actual: actual ?? '',
      pass: String(actual || '') === expected
    });
  });

  // Ant Design 风格：自定义下拉（学历）+ 年月日三下拉 + 只读日期选择器
  const antdCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const antdSession = (await browser.send('Target.attachToTarget', {
    targetId: antdCreated.targetId,
    flatten: true
  })).sessionId;
  await browser.send('Runtime.enable', {}, antdSession);
  await browser.send('Page.enable', {}, antdSession);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1100, height: 900, deviceScaleFactor: 1, mobile: false
  }, antdSession);
  await browser.send('Page.navigate', { url: ANTD_URL }, antdSession);

  const evaluateAntd = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    }, antdSession);
    if (result.exceptionDetails) {
      throw new Error('AntD 页执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  let antd;
  try {
    antd = await waitFor(async () => {
      const value = await evaluateAntd('window.__antdData ? window.__antdData() : null');
      return value && value.degree !== '请选择' && value.major === '计算机技术' && value.grad ? value : null;
    }, 20000, 300, 'AntD 表单填写');
  } catch (error) {
    console.log('ANTD DEBUG', await evaluateAntd(`(() => ({
      data: window.__antdData(),
      search: document.getElementById('majorSearch').value,
      dropdownClass: document.getElementById('majorDropdown').className,
      dropdownHtml: document.getElementById('majorDropdown').innerHTML.slice(0, 300)
    }))()`));
    const scan = await evaluateOptions(`(async () => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((item) => item.url && item.url.includes('antd-form'));
      if (!tab) return null;
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.RF.scanPage()
      });
      return result[0].result;
    })()`);
    console.log('ANTD SCAN', JSON.stringify((scan?.fields || []).map((field) => ({
      label: field.label, key: field.key, section: field.section, type: field.type, filled: field.filled, score: field.score
    })), null, 2));
    throw error;
  }

  checks.push({
    field: 'AntD 学历下拉',
    expected: '硕士研究生',
    actual: antd.degree,
    pass: antd.degree === '硕士研究生'
  });
  checks.push({
    field: '专业搜索选择',
    expected: '计算机技术',
    actual: antd.major,
    pass: antd.major === '计算机技术'
  });
  checks.push({
    field: '排名最高档',
    expected: '前5%',
    actual: antd.rankText,
    pass: antd.rankText === '前5%'
  });
  checks.push({
    field: 'AntD 年月日下拉',
    expected: '2024 / 9',
    actual: `${antd.year} / ${antd.month}`,
    pass: antd.year === '2024' && antd.month === '9'
  });
  checks.push({
    field: 'AntD 日期选择器',
    expected: '2026-06-01',
    actual: antd.grad,
    pass: antd.grad === '2026-06-01'
  });

  const antdShot = await browser.send('Page.captureScreenshot', { format: 'png' }, antdSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'antd-form.png'), Buffer.from(antdShot.data, 'base64'));

  // 默认只有一条记录：插件需要先点“添加”再填第二条
  const dynamicCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const dynamicSession = (await browser.send('Target.attachToTarget', {
    targetId: dynamicCreated.targetId,
    flatten: true
  })).sessionId;
  await browser.send('Runtime.enable', {}, dynamicSession);
  await browser.send('Page.enable', {}, dynamicSession);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1000, height: 900, deviceScaleFactor: 1, mobile: false
  }, dynamicSession);
  await browser.send('Page.navigate', { url: DYNAMIC_URL }, dynamicSession);

  const evaluateDynamic = async (expression) => {
    const result = await browser.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    }, dynamicSession);
    if (result.exceptionDetails) {
      throw new Error('动态页执行出错：' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    }
    return result.result?.value;
  };

  const dynamic = await waitFor(async () => {
    const value = await evaluateDynamic('window.__dynamicData ? window.__dynamicData() : null');
    return value && value.eduCount >= 2 && value.paperCount >= 2 && value.school2 && value.paper2 ? value : null;
  }, 25000, 400, '动态添加并填写');

  checks.push({
    field: '自动添加经历',
    expected: '教育 2 条 / 论文 2 篇',
    actual: `教育 ${dynamic.eduCount} 条 / 论文 ${dynamic.paperCount} 篇`,
    pass: dynamic.eduCount >= 2 && dynamic.paperCount >= 2
  });
  checks.push({
    field: '添加后继续填写',
    expected: '第二条学校和论文已填',
    actual: `${dynamic.school2} / ${dynamic.paper2}`,
    pass: dynamic.school2 === '南京大学' &&
      dynamic.paper2 === '面向高并发场景的缓存分层优化方法'
  });

  const dynamicShot = await browser.send('Page.captureScreenshot', { format: 'png' }, dynamicSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'dynamic-add.png'), Buffer.from(dynamicShot.data, 'base64'));

  // PDF 导入：把简历 HTML 打印成真实 PDF，再走「选择文件 → 解析 → 应用」完整链路
  const resumeCreated = await browser.send('Target.createTarget', { url: 'about:blank' });
  const resumeSession = (await browser.send('Target.attachToTarget', {
    targetId: resumeCreated.targetId,
    flatten: true
  })).sessionId;
  await browser.send('Runtime.enable', {}, resumeSession);
  await browser.send('Page.enable', {}, resumeSession);
  await browser.send('Page.navigate', { url: `${BASE_URL}/tests/fixtures/resume.html` }, resumeSession);
  await waitFor(async () => {
    const result = await browser.send('Runtime.evaluate', {
      expression: 'document.readyState', returnByValue: true
    }, resumeSession);
    return result.result?.value === 'complete';
  }, 10000, 200, '简历 PDF 页面加载');

  const printed = await browser.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true
  }, resumeSession);
  const pdfPath = path.join(ARTIFACTS, 'resume-import-test.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(printed.data, 'base64'));

  await waitFor(async () => evaluateOptions('!!window.RFPDF'), 10000, 200, 'PDF 解析组件加载');
  await evaluateOptions("document.getElementById('pdfImportBtn').click()");
  await browser.send('DOM.enable', {}, optionsSession);
  const { root } = await browser.send('DOM.getDocument', { depth: -1 }, optionsSession);
  const { nodeId } = await browser.send('DOM.querySelector', {
    nodeId: root.nodeId, selector: '#pdfFile'
  }, optionsSession);
  await browser.send('DOM.setFileInputFiles', { files: [pdfPath], nodeId }, optionsSession);
  await evaluateOptions("document.getElementById('pdfFile').dispatchEvent(new Event('change', {bubbles:true}))");

  await waitFor(async () => {
    const disabled = await evaluateOptions("document.getElementById('pdfApply').disabled");
    return disabled === false;
  }, 30000, 400, 'PDF 解析完成');

  const pdfStatus = await evaluateOptions("document.getElementById('pdfStatus').textContent");
  const pdfPreview = await evaluateOptions("document.getElementById('pdfPreview').textContent");
  const pdfShot = await browser.send('Page.captureScreenshot', { format: 'png' }, optionsSession);
  fs.writeFileSync(path.join(ARTIFACTS, 'pdf-import.png'), Buffer.from(pdfShot.data, 'base64'));
  checks.push({
    field: 'PDF-识别内容',
    expected: '包含学院、论文链接、实习岗位',
    actual: String(pdfStatus).slice(0, 60),
    pass: String(pdfPreview).includes('张伟') &&
      String(pdfPreview).includes('计算机学报') &&
      String(pdfPreview).includes('国家奖学金') &&
      String(pdfPreview).includes('计算机科学技术学院') &&
      String(pdfPreview).includes('doi.org') &&
      String(pdfPreview).includes('数据开发实习生')
  });

  await evaluateOptions("document.getElementById('pdfApply').click()");
  await sleep(800);
  const imported = await evaluateOptions(`(async () => {
    const state = await RF.getState();
    return {
      name: state.profile.basic.name,
      papers: state.profile.papers.map((paper) => ({ title: paper.title, link: paper.link })),
      honors: state.profile.honors.map((honor) => honor.name),
      educations: state.profile.educations.map((edu) => ({ school: edu.school, college: edu.college })),
      internships: state.profile.internships.map((item) => ({ company: item.company, position: item.position }))
    };
  })()`);
  const paperTitles = imported.papers.map((paper) => paper.title);
  checks.push({
    field: 'PDF-合并到简历',
    expected: '论文 ≥4 篇 / 荣誉 ≥5 项，且带学院、论文链接、实习岗位',
    actual: `${imported.name} / 论文 ${imported.papers.length} 篇 / 荣誉 ${imported.honors.length} 项 / 实习 ${imported.internships.length} 段`,
    pass: imported.name === '张三' &&
      imported.papers.length >= 4 && imported.honors.length >= 5 &&
      new Set(paperTitles).size === paperTitles.length &&
      paperTitles.includes('基于图神经网络的异构信息网络节点表示方法') &&
      imported.papers.some((paper) => /doi\.org/i.test(paper.link)) &&
      imported.honors.includes('国家奖学金') &&
      imported.honors.includes('校优秀毕业生') &&
      imported.educations.some((edu) => edu.college === '计算机科学技术学院') &&
      imported.internships.some((item) => item.company === '云帆数据科技有限公司' && item.position === '数据开发实习生')
  });

  // AI 精细解析通道（本地 mock）
  const aiResume = await evaluateOptions(`chrome.runtime.sendMessage({
    type: 'RF_AI_RESUME',
    text: '张伟，13912345678，复旦大学计算机技术硕士，发表论文，获得国家奖学金，熟悉 Java 与 Go。'
  })`);
  checks.push({
    field: 'PDF-AI 解析通道',
    expected: '返回结构化 profile',
    actual: aiResume && aiResume.ok ? aiResume.profile?.basic?.name : JSON.stringify(aiResume),
    pass: !!aiResume && aiResume.ok && aiResume.profile?.basic?.name === '李四' &&
      aiResume.profile?.papers?.[0]?.title === 'AI 解析出的论文'
  });

  const failed = checks.filter((check) => !check.pass);
  const report = {
    options: optionsInfo,
    persisted,
    popup: { name: popupName, diagnostics: diagSummary },
    ai: aiFill ? { filled: aiFill.filled, fromAI: aiFill.fromAI } : null,
    scan: scan ? { total: scan.total, matched } : null,
    openQuestionBank: aiResult,
    pdf: {
      status: pdfStatus,
      papers: imported.papers.length,
      honors: imported.honors.length,
      internships: imported.internships.length
    },
    aiResume: aiResume && aiResume.ok ? aiResume.profile?.basic?.name : aiResume,
    passed: checks.length - failed.length,
    total: checks.length,
    failed: failed.map((check) => ({ field: check.field, expected: check.expected, actual: check.actual })),
    pageErrors: browser.errors
  };

  console.log(JSON.stringify(report, null, 2));

  if (failed.length) {
    console.error(`\n${failed.length} 项断言失败`);
    process.exitCode = 1;
  } else {
    console.log(`\n全部 ${checks.length} 项检查通过`);
  }
} catch (error) {
  console.error('测试执行失败：', error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
