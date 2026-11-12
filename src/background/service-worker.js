/* 简填 · 后台 Service Worker
 * 只做三件事：初始化默认设置、转发 AI 请求、给设置页做连通性测试。
 * 简历数据始终保存在 chrome.storage.local。
 */
'use strict';

const PROFILE_KEY = 'rf_profile_v1';
const SETTINGS_KEY = 'rf_settings_v1';

const DEFAULT_SETTINGS = {
  autoFillDomains: [],
  overwriteExisting: false,
  highlight: true,
  ai: {
    enabled: false,
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.4
  }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  const got = await chrome.storage.local.get(SETTINGS_KEY);
  if (!got[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

function normalizeEndpoint(baseURL) {
  const base = String(baseURL || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('请先填写 AI 接口地址');
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

function compactProfile(profile) {
  const out = {};
  const basic = profile.basic || {};
  Object.keys(basic).forEach((key) => {
    if (String(basic[key] || '').trim()) out[key] = String(basic[key]).trim();
  });
  const groups = {
    educations: ['school', 'major', 'degree', 'startDate', 'endDate', 'gpa', 'rank', 'city', 'courses'],
    internships: ['company', 'department', 'position', 'startDate', 'endDate', 'city', 'description', 'achievements'],
    projects: ['name', 'role', 'startDate', 'endDate', 'description', 'achievements', 'tech'],
    campus: ['organization', 'role', 'startDate', 'endDate', 'description']
  };
  Object.entries(groups).forEach(([group, keys]) => {
    const list = (profile[group] || []).map((record) => {
      const item = {};
      keys.forEach((key) => {
        if (String(record[key] || '').trim()) item[key] = String(record[key]).trim();
      });
      return item;
    }).filter((item) => Object.keys(item).length);
    if (list.length) out[group] = list;
  });
  if (profile.skills) {
    const skills = {};
    Object.keys(profile.skills).forEach((key) => {
      if (String(profile.skills[key] || '').trim()) skills[key] = String(profile.skills[key]).trim();
    });
    if (Object.keys(skills).length) out.skills = skills;
  }
  return out;
}

function parseAnswers(content, count) {
  const text = String(content || '').trim();
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      const obj = JSON.parse(brace[0]);
      if (Array.isArray(obj.answers)) {
        return obj.answers.slice(0, count).map((item) => String(item || '').trim());
      }
    } catch (error) {
      /* 继续尝试其它格式 */
    }
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      const obj = JSON.parse(fenced[1]);
      if (Array.isArray(obj.answers)) return obj.answers.slice(0, count).map((item) => String(item || '').trim());
    } catch (error) { /* ignore */ }
  }
  return null;
}

async function requestAnswers(ai, questions, profile) {
  const endpoint = normalizeEndpoint(ai.baseURL);
  const count = questions.length;
  const systemPrompt = [
    '你是一名中文校园招聘网申助手，帮助候选人撰写申请表单中的开放题回答。',
    '要求：',
    '1. 只使用候选人资料中已有的事实，不要编造公司、学校、奖项或数字；资料不足时用克制的表达，不虚构具体经历。',
    '2. 第一人称、简体中文，语气真诚具体，避免空话套话和感叹号堆砌。',
    '3. 每道题 120—220 字；如输入框有字数上限，尽量靠近上限但不要超出。',
    '4. 结合目标岗位与候选人经历，突出与岗位相关的能力和结果。',
    `5. 输出严格的 JSON 对象：{"answers":["第1题答案","第2题答案", ...]}，数组长度必须等于 ${count}，不要输出任何其它文字。`
  ].join('\n');

  const userPrompt = JSON.stringify({
    candidate: compactProfile(profile),
    questions: questions.map((question, index) => ({ index, question: String(question).slice(0, 500) }))
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model || 'deepseek-chat',
        temperature: Number(ai.temperature) || 0.4,
        max_tokens: 2200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('AI 请求超时（60 秒）');
    throw new Error(`无法连接 AI 接口：${error && error.message ? error.message : error}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      detail = text.slice(0, 200);
    } catch (error) { /* ignore */ }
    throw new Error(`AI 接口返回 ${response.status}${detail ? `：${detail}` : ''}`);
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error('AI 返回内容为空');
  const answers = parseAnswers(content, count);
  if (!answers) throw new Error('AI 返回格式无法解析，请换一个模型或稍后重试');
  return answers;
}

function parseJsonObject(content) {
  const text = String(content || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate.trim());
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch (error) { /* 尝试下一个候选 */ }
  }
  return null;
}

async function requestResumeProfile(ai, text) {
  const endpoint = normalizeEndpoint(ai.baseURL);
  const systemPrompt = [
    '你是一个严谨的中文简历结构化解析器。输入是从 PDF 简历中提取的纯文本，可能包含排版噪声、页眉页脚或断行。',
    '任务：抽取候选人的信息，只使用原文中明确存在的事实，绝对不要编造学校、公司、奖项、论文或数字。',
    '缺失的字段留空字符串或直接省略；日期统一为 YYYY-MM（只有年份时用 YYYY）。',
    '论文和荣誉要逐条拆开，不要把多条塞进同一条；论文作者排名只从原文的「第一作者 / 第二作者 / 排名」等表述中提取。',
    '输出严格的 JSON 对象，不要输出解释、Markdown 代码块或其它文字。JSON 结构如下：',
    '{"basic":{"name":"","gender":"","birthDate":"","phone":"","email":"","idCard":"","ethnicity":"","politicalStatus":"","hometown":"","household":"","maritalStatus":"","address":"","expectedCity":"","expectedPosition":"","website":"","github":"","selfEvaluation":""},',
    '"educations":[{"school":"","major":"","degree":"","startDate":"","endDate":"","gpa":"","rank":""}],',
    '"internships":[{"company":"","department":"","position":"","startDate":"","endDate":"","city":"","description":"","achievements":""}],',
    '"projects":[{"name":"","role":"","startDate":"","endDate":"","description":"","achievements":"","tech":""}],',
    '"papers":[{"title":"","journal":"","publishDate":"","rank":""}],',
    '"honors":[{"name":"","awardDate":""}],',
    '"campus":[{"organization":"","role":"","startDate":"","endDate":"","description":""}],',
    '"skills":{"languages":"","certificates":"","software":""}}'
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model || 'deepseek-chat',
        temperature: 0.1,
        max_tokens: 3500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: String(text).slice(0, 16000) }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('AI 解析超时（90 秒）');
    throw new Error(`无法连接 AI 接口：${error && error.message ? error.message : error}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch (error) { /* ignore */ }
    throw new Error(`AI 接口返回 ${response.status}${detail ? `：${detail}` : ''}`);
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error('AI 返回内容为空');
  const profile = parseJsonObject(content);
  if (!profile) throw new Error('AI 返回格式无法解析，请换一个模型或稍后重试');
  return profile;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  if (message.type === 'RF_AI_ANSWER') {
    (async () => {
      const got = await chrome.storage.local.get(SETTINGS_KEY);
      const settings = Object.assign({}, DEFAULT_SETTINGS, got[SETTINGS_KEY] || {});
      const ai = Object.assign({}, DEFAULT_SETTINGS.ai, settings.ai || {});
      if (!ai.apiKey) throw new Error('尚未填写 AI API Key');
      if (!Array.isArray(message.questions) || !message.questions.length) {
        return { ok: true, answers: [] };
      }
      const answers = await requestAnswers(ai, message.questions.slice(0, 6), message.profile || {});
      return { ok: true, answers };
    })()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error && error.message ? error.message : String(error) }));
    return true;
  }

  if (message.type === 'RF_AI_RESUME') {
    (async () => {
      const got = await chrome.storage.local.get(SETTINGS_KEY);
      const settings = Object.assign({}, DEFAULT_SETTINGS, got[SETTINGS_KEY] || {});
      const ai = Object.assign({}, DEFAULT_SETTINGS.ai, settings.ai || {});
      if (!ai.apiKey) throw new Error('尚未填写 AI API Key');
      if (!message.text || String(message.text).trim().length < 20) {
        throw new Error('简历文本太短，无法解析');
      }
      const profile = await requestResumeProfile(ai, message.text);
      return { ok: true, profile };
    })()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error && error.message ? error.message : String(error) }));
    return true;
  }

  if (message.type === 'RF_TEST_AI') {
    (async () => {
      const got = await chrome.storage.local.get(SETTINGS_KEY);
      const settings = Object.assign({}, DEFAULT_SETTINGS, got[SETTINGS_KEY] || {});
      const ai = Object.assign({}, DEFAULT_SETTINGS.ai, settings.ai || {});
      if (!ai.apiKey) throw new Error('尚未填写 API Key');
      const answers = await requestAnswers(
        ai,
        ['请用一句话说明你已成功连接，并回答“你为什么适合这个岗位”。'],
        message.profile || {}
      );
      return { ok: true, sample: answers[0] || '' };
    })()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error && error.message ? error.message : String(error) }));
    return true;
  }

  return false;
});
