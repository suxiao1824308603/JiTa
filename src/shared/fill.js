/* 简填 · 填表引擎
 * 负责把简历值写入页面控件，并尽量触发 React/Vue 等框架能识别的原生事件。
 */
(function (global) {
  'use strict';

  const RF = (global.RF = global.RF || {});

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function fire(el, type, data) {
    let event;
    try {
      event = new Event(type, { bubbles: true, cancelable: true });
    } catch (e) {
      event = document.createEvent('HTMLEvents');
      event.initEvent(type, true, true);
    }
    if (data) Object.assign(event, data);
    el.dispatchEvent(event);
  }

  function setNativeValue(el, value) {
    const proto = el instanceof global.HTMLTextAreaElement
      ? global.HTMLTextAreaElement.prototype
      : global.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(el, value);
    else el.value = value;
  }

  /* ---------------- 值匹配（性别/学历/政治面貌等同义） ---------------- */

  const SEMANTIC_GROUPS = [
    ['男', '男性', 'male', 'm'],
    ['女', '女性', 'female', 'f'],
    ['本科', '大学本科', '全日制本科', '统招本科', '学士', '本科生', 'bachelor', 'undergraduate'],
    ['硕士', '研究生', '硕士研究生', '硕士生', '全日制硕士', '统招硕士', 'master', 'postgraduate'],
    ['博士', '博士研究生', '博士研究生学历', '全日制博士', 'doctor', 'phd'],
    ['大专', '专科', '大学专科', '高职', 'associate'],
    ['中共党员', '党员', '中国共产党党员'],
    ['中共预备党员', '预备党员'],
    ['共青团员', '团员', '中国共产主义青年团团员'],
    ['群众', '普通群众'],
    ['未婚', '单身'],
    ['已婚']
  ];
  const NORMALIZED_GROUPS = SEMANTIC_GROUPS.map((group) => group.map((v) => RF.normalizeLabel(v)));

  function sameGroup(a, b) {
    return NORMALIZED_GROUPS.some((group) => group.includes(a) && group.includes(b));
  }

  function valueScore(value, text) {
    const v = RF.normalizeLabel(value);
    const t = RF.normalizeLabel(text);
    if (!v || !t) return 0;
    if (v === t) return 1;
    if (sameGroup(v, t)) return 0.94;
    if (v.length >= 2 && t.includes(v)) return 0.9;
    if (t.length >= 2 && v.includes(t)) return 0.84;
    return 0;
  }

  function optionLabel(option) {
    return RF.cleanText(option.label || option.textContent || option.value || '');
  }

  function pickBest(value, candidates) {
    let best = null;
    for (const candidate of candidates) {
      const text = candidate.text;
      const score = valueScore(value, text);
      if (!score) continue;
      if (!best || score > best.score) best = { candidate, score, text };
    }
    return best && best.score >= 0.82 ? best : null;
  }

  function pickBestBy(value, candidates, scoreFn) {
    let best = null;
    for (const candidate of candidates) {
      const score = scoreFn(value, candidate.text);
      if (!score) continue;
      if (!best || score > best.score) best = { candidate, score, text: candidate.text };
    }
    return best && best.score >= 0.82 ? best : null;
  }

  function longestCommonPrefix(a, b) {
    let index = 0;
    while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
    return index;
  }

  // 专业名称常出现“计算机技术 vs 计算机科学与技术”这类不完全包含的情况
  function majorScore(value, text) {
    const base = valueScore(value, text);
    if (base) return base;
    const v = RF.normalizeLabel(value);
    const t = RF.normalizeLabel(text);
    if (!v || !t) return 0;
    const prefix = longestCommonPrefix(v, t);
    if (prefix >= 3) {
      return Math.min(0.95, 0.84 + prefix * 0.02 + Math.min(t.length, 20) * 0.001);
    }
    return 0;
  }

  /* ---------------- 日期格式 ---------------- */

  function formatDateFor(el, raw) {
    const text = String(raw || '');
    const m = text.match(/^(\d{4})(?:[-/.\s年](\d{1,2}))?(?:[-/.\s月](\d{1,2}))?/);
    if (!m) return text;
    const year = m[1];
    const month = m[2] ? String(parseInt(m[2], 10)).padStart(2, '0') : '';
    const day = m[3] ? String(parseInt(m[3], 10)).padStart(2, '0') : '';
    const type = (el.type || '').toLowerCase();
    const hint = `${el.getAttribute('placeholder') || ''} ${el.getAttribute('data-format') || ''} ${el.getAttribute('maxlength') || ''}`;

    if (type === 'month') return month ? `${year}-${month}` : year;
    if (type === 'date') return `${year}-${month || '01'}-${day || '01'}`;
    if (/年.*月.*日|YYYY年MM月DD日/.test(hint)) {
      return month ? `${year}年${Number(month)}月${day ? Number(day) + '日' : ''}` : year;
    }
    if (/年.*月|YYYY年MM月|YYYY-MM(?!-)/.test(hint)) return month ? `${year}年${Number(month)}月` : year;
    if (/YYYY\/MM/.test(hint) && month) return `${year}/${month}`;
    if (Number(el.getAttribute('maxlength')) === 4) return year;
    return month ? `${year}-${month}${day ? '-' + day : ''}` : year;
  }

  /* ---------------- 控件读写 ---------------- */

  function isFilled(el, type) {
    if (type === 'select') {
      const opt = el.options[el.selectedIndex];
      return !!opt && !!opt.value && !/^(请选择|请选择|--|—|select|choose)$/i.test(opt.textContent.trim());
    }
    if (type === 'custom-select') {
      const placeholder = el.querySelector('.ant-select-selection-placeholder,.el-select__placeholder,.ivu-select-placeholder,.placeholder,[class*="placeholder"],[class*="Placeholder"]');
      if (placeholder && RF.isVisible(placeholder)) return false;
      const text = RF.cleanText(el.textContent);
      if (!text || /^(请选择|请选取|选择|select|pleaseselect)/i.test(text)) return false;
      return true;
    }
    if (type === 'contenteditable') return !!RF.cleanText(el.textContent);
    if (type === 'radio') {
      const group = RF.radioInputs ? RF.radioInputs(el) : [];
      return group.some((input) => input.checked);
    }
    return !!RF.cleanText(el.value);
  }

  function highlight(el) {
    const target = el.closest && el.closest('.ant-form-item,.el-form-item,.form-item,.form-group,.field') || el;
    const previous = {
      outline: target.style.outline,
      outlineOffset: target.style.outlineOffset,
      transition: target.style.transition,
      boxShadow: target.style.boxShadow
    };
    target.style.transition = 'outline-color .2s ease, box-shadow .2s ease';
    target.style.outline = '2px solid #10b981';
    target.style.outlineOffset = '2px';
    target.style.boxShadow = '0 0 0 4px rgba(16,185,129,.12)';
    setTimeout(() => {
      target.style.outline = previous.outline;
      target.style.outlineOffset = previous.outlineOffset;
      target.style.transition = previous.transition;
      target.style.boxShadow = previous.boxShadow;
    }, 1600);
  }

  function fillText(el, value) {
    const max = parseInt(el.getAttribute('maxlength') || '0', 10);
    let next = String(value);
    if (max > 0 && next.length > max) next = next.slice(0, max);

    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* ignore */ } }
    if (el.isContentEditable) {
      el.textContent = next;
      fire(el, 'input', { inputType: 'insertText', data: next });
      fire(el, 'change');
    } else {
      setNativeValue(el, next);
      fire(el, 'input', { inputType: 'insertText', data: next });
      fire(el, 'change');
      fire(el, 'blur');
      if (el.value !== next) {
        // 少数框架会重置，再尝试一次
        setNativeValue(el, next);
        fire(el, 'input', { inputType: 'insertText', data: next });
      }
    }
    return String(el.isContentEditable ? el.textContent : el.value).trim() === next.trim();
  }

  function chooseSelect(select, value, scoreFn) {
    const candidates = Array.from(select.options)
      .filter((opt) => !opt.disabled && opt.value !== '')
      .map((opt) => ({ text: optionLabel(opt), option: opt }));
    const best = scoreFn ? pickBestBy(value, candidates, scoreFn) : pickBest(value, candidates);
    if (!best) return false;
    select.value = best.candidate.option.value;
    fire(select, 'input');
    fire(select, 'change');
    return true;
  }

  /* ---------------- 排名档位 ---------------- */

  function rankPercent(text) {
    const matches = String(text || '').match(/\d{1,3}(?:\.\d+)?\s*[%％]/g) || [];
    const values = matches
      .map((item) => parseFloat(item))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
    return values.length ? Math.min(...values) : null;
  }

  function rankScore(text) {
    const percent = rankPercent(text);
    // 分数越高越优先，5% 的分数高于 10%
    return percent == null ? 0 : 100 - percent;
  }

  async function fillRank(item) {
    const type = item.type;

    if (type === 'select') {
      const candidates = Array.from(item.el.options)
        .filter((option) => !option.disabled && option.value !== '')
        .map((option) => ({ option, percent: rankPercent(optionLabel(option)) }))
        .filter((candidate) => candidate.percent != null)
        .sort((a, b) => a.percent - b.percent);
      if (!candidates.length) return false;
      item.el.value = candidates[0].option.value;
      fire(item.el, 'input');
      fire(item.el, 'change');
      return true;
    }

    if (type === 'custom-select') {
      return fillCustomSelect(item.el, '', (text) => rankScore(text));
    }

    if (type === 'radio') {
      const inputs = radioInputs(item.el);
      const candidates = inputs
        .map((input) => ({ input, text: radioText(input), percent: rankPercent(radioText(input)) }))
        .filter((candidate) => candidate.percent != null)
        .sort((a, b) => a.percent - b.percent);
      if (!candidates.length) return false;
      const input = candidates[0].input;
      if (!input.checked) {
        input.click();
        if (!input.checked) {
          input.checked = true;
          fire(input, 'input');
          fire(input, 'change');
        }
      }
      return true;
    }

    return false;
  }

  function customSelectOptions() {
    const selectors = [
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      '.el-select-dropdown .el-select-dropdown__item',
      '.ivu-select-dropdown .ivu-select-item',
      '.el-popper[role="tooltip"] .el-select-dropdown__item',
      '[role="listbox"] [role="option"]'
    ];
    const nodes = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (RF.isVisible(node)) nodes.push(node);
      });
    });
    return nodes;
  }

  function typeSearch(input, text) {
    if (!input || input.readOnly) return false;
    try {
      input.focus();
      setNativeValue(input, '');
      fire(input, 'input');
      setNativeValue(input, text);
      fire(input, 'input', { inputType: 'insertText', data: text });
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: String(text).slice(-1), bubbles: true
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function selectOptionNodes() {
    const selectors = [
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      '.el-select-dropdown .el-select-dropdown__item',
      '.ivu-select-dropdown .ivu-select-item',
      '.el-autocomplete-suggestion li',
      '.ivu-auto-complete .ivu-select-item',
      '[role="listbox"] [role="option"]'
    ];
    const nodes = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (RF.isVisible(node)) nodes.push(node);
      });
    });
    return nodes;
  }

  async function fillCustomSelect(host, value, scoreFn, config) {
    const opts = config || {};
    const trigger = host.querySelector('.ant-select-selector,.el-select__wrapper,.el-input__inner,.ivu-select-selection,input,[role="combobox"]') || host;
    try { trigger.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
    // 不同组件库分别在 mousedown / click 时展开，先按 mousedown 试探，没展开再点击
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: global }));
    if (host.matches('.el-select')) host.click();
    await sleep(150);

    let options = customSelectOptions();
    if (!options.length) {
      trigger.click();
      await sleep(300);
      options = customSelectOptions();
    }
    if (!options.length) {
      await sleep(300);
      options = customSelectOptions();
    }

    const searchInput = host.querySelector(
      '.ant-select-selection-search-input,input[role="combobox"],.el-input__inner,input'
    );
    if (opts.forceSearch && searchInput) {
      typeSearch(searchInput, value);
      await sleep(500);
      options = customSelectOptions();
    }
    if (!options.length && searchInput) {
      typeSearch(searchInput, value);
      await sleep(500);
      options = customSelectOptions();
    }
    if (!options.length) return false;

    const scoreOf = (text) => (scoreFn ? scoreFn(text) : valueScore(value, text));
    let best = null;
    for (const node of options) {
      const text = RF.cleanText(node.textContent);
      const score = scoreOf(text);
      if (score >= 0.82 && (!best || score > best.score)) best = { node, text, score };
    }

    // 长列表 / 远程搜索：先输入关键词，再重新匹配一次
    if (!best && searchInput && !opts.forceSearch) {
      typeSearch(searchInput, value);
      await sleep(500);
      options = customSelectOptions();
      for (const node of options) {
        const text = RF.cleanText(node.textContent);
        const score = scoreOf(text);
        if (score >= 0.82 && (!best || score > best.score)) best = { node, text, score };
      }
    }

    if (!best) {
      if (searchInput && !searchInput.readOnly) {
        setNativeValue(searchInput, '');
        fire(searchInput, 'input');
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    best.node.scrollIntoView({ block: 'nearest' });
    best.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: global }));
    best.node.click();
    await sleep(150);
    return true;
  }

  async function fillSearchSelect(input, value, scoreFn) {
    if (!typeSearch(input, value)) return false;
    await sleep(500);
    let options = selectOptionNodes();
    if (!options.length) {
      await sleep(350);
      options = selectOptionNodes();
    }
    if (!options.length) return false;

    const candidates = options.map((node) => ({ node, text: RF.cleanText(node.textContent) }));
    const best = scoreFn
      ? pickBestBy(value, candidates, scoreFn)
      : pickBest(value, candidates);
    if (!best) {
      setNativeValue(input, '');
      fire(input, 'input');
      return false;
    }
    best.candidate.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: global }));
    best.candidate.node.click();
    await sleep(150);
    return true;
  }

  /* ---------------- 日期组合与日期选择器 ---------------- */

  function parseDateValue(value) {
    const match = String(value || '').match(/^(\d{4})(?:[-/.\s年](\d{1,2}))?(?:[-/.\s月](\d{1,2}))?/);
    return {
      year: match ? match[1] : '',
      month: match && match[2] ? String(parseInt(match[2], 10)) : '',
      day: match && match[3] ? String(parseInt(match[3], 10)) : ''
    };
  }

  function datePartHasValue(part) {
    if (part.type === 'select') {
      const option = part.el.options[part.el.selectedIndex];
      return !!option && !!option.value && !/请选择|select/i.test(option.textContent);
    }
    if (part.type === 'custom-select') {
      return isFilled(part.el, 'custom-select');
    }
    return !!RF.cleanText(part.el.value);
  }

  function isDateGroupFilled(item) {
    return (item.parts || []).every((part) => datePartHasValue(part));
  }

  function numericScore(text, target, part) {
    const numbers = (String(text).match(/\d+/g) || []).map((value) => parseInt(value, 10));
    if (!numbers.length) return 0;
    if (part === 'year') return numbers.includes(Number(target)) ? 1 : 0;
    return numbers.includes(Number(target)) ? (numbers.length === 1 ? 1 : 0.92) : 0;
  }

  function chooseNumericSelect(select, target, part) {
    const options = Array.from(select.options).filter((option) => !option.disabled && option.value !== '');
    let best = null;
    for (const option of options) {
      const score = numericScore(optionLabel(option), target, part);
      if (!best || score > best.score) best = { option, score };
    }
    if (!best || best.score < 0.82) return false;
    select.value = best.option.value;
    fire(select, 'input');
    fire(select, 'change');
    return true;
  }

  async function fillDateGroup(item, value, options) {
    const parts = parseDateValue(value);
    let changed = false;
    for (const part of item.parts || []) {
      const target = parts[part.part];
      if (!target) continue;
      if (!options.overwriteExisting && datePartHasValue(part)) continue;
      let ok = false;
      if (part.type === 'select') {
        ok = chooseNumericSelect(part.el, target, part.part);
      } else if (part.type === 'custom-select') {
        ok = await fillCustomSelect(part.el, target, (text) => numericScore(text, target, part.part));
      } else {
        ok = fillText(part.el, part.part === 'year' ? target : String(target).padStart(2, '0'));
      }
      if (ok) changed = true;
    }
    return changed;
  }

  function formatPickerDate(input, raw) {
    const parts = parseDateValue(raw);
    if (!parts.year) return String(raw || '');
    const placeholder = `${input.getAttribute('placeholder') || ''} ${
      input.closest('.ant-picker,.el-date-editor,.ivu-date-picker')?.textContent || ''
    }`;
    if (/月/.test(placeholder) && !/日/.test(placeholder) && parts.month) {
      return `${parts.year}-${parts.month.padStart(2, '0')}`;
    }
    return `${parts.year}-${(parts.month || '01').padStart(2, '0')}-${(parts.day || '01').padStart(2, '0')}`;
  }

  function visiblePickerDropdown() {
    const selectors = [
      '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
      '.el-picker-panel',
      '.ivu-picker-panel'
    ];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => RF.isVisible(node));
      if (nodes.length) return nodes[nodes.length - 1];
    }
    return null;
  }

  async function pickFromDatePanel(input, value) {
    let dropdown = visiblePickerDropdown();
    if (!dropdown) {
      const host = input.closest('.ant-picker,.el-date-editor,.ivu-date-picker') || input;
      try { host.click(); } catch (error) { /* ignore */ }
      try { input.click(); } catch (error) { /* ignore */ }
      await sleep(300);
      dropdown = visiblePickerDropdown();
    }
    if (!dropdown) {
      await sleep(300);
      dropdown = visiblePickerDropdown();
    }
    if (!dropdown) return false;

    const { year, month, day } = parseDateValue(value);
    if (!year) return false;
    const monthText = (month || '01').padStart(2, '0');
    const dayText = (day || '01').padStart(2, '0');
    const findCell = (title) => Array.from(dropdown.querySelectorAll(`[title="${title}"]`))
      .find((node) => RF.isVisible(node));

    // AntD：先打开年份面板，选年后再选月、日
    const yearButton = dropdown.querySelector('.ant-picker-year-btn');
    if (yearButton && !dropdown.querySelector('.ant-picker-year-panel')) {
      yearButton.click();
      await sleep(150);
    }
    const yearCell = findCell(year);
    if (yearCell) {
      yearCell.click();
      await sleep(180);
    }

    let monthCell = findCell(`${year}-${monthText}`);
    if (!monthCell) {
      const monthButton = dropdown.querySelector('.ant-picker-month-btn');
      if (monthButton) {
        monthButton.click();
        await sleep(150);
        monthCell = findCell(`${year}-${monthText}`);
      }
    }
    if (monthCell) {
      monthCell.click();
      await sleep(180);
    }

    const dayCell = findCell(`${year}-${monthText}-${dayText}`);
    if (dayCell) {
      dayCell.click();
      await sleep(150);
    }

    const current = String(input.value || '');
    return current.includes(year) && (!month || current.includes(monthText) || current.includes(month));
  }

  async function fillDatePicker(input, value) {
    const text = formatPickerDate(input, value);

    // 大多数 AntD / Element 日期输入框允许直接键入
    if (!input.readOnly) {
      try {
        input.focus();
        setNativeValue(input, text);
        fire(input, 'input', { inputType: 'insertText', data: text });
        fire(input, 'change');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
        input.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
        fire(input, 'blur');
        await sleep(120);
        if (String(input.value || '').includes(text.slice(0, 7))) return true;
      } catch (error) { /* 继续尝试面板选择 */ }
    }

    return pickFromDatePanel(input, text);
  }

  function radioInputs(el) {
    const name = el.getAttribute('name');
    const form = el.closest('form');
    if (name && form) return Array.from(form.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
    if (name) return Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
    const group = el.closest('.ant-radio-group,.el-radio-group,.ivu-radio-group,[role="radiogroup"]');
    if (group) return Array.from(group.querySelectorAll('input[type="radio"]'));
    return [el];
  }
  RF.radioInputs = radioInputs;
  function radioText(input) {
    if (input.labels && input.labels.length) return RF.cleanText(input.labels[0].textContent);
    const label = input.closest('label');
    if (label) return RF.cleanText(label.textContent);
    const next = input.nextElementSibling;
    if (next && RF.cleanText(next.textContent).length <= 20) return RF.cleanText(next.textContent);
    const parent = input.parentElement;
    if (parent) return RF.cleanText(parent.textContent).replace(RF.cleanText(input.value), '').trim();
    return RF.cleanText(input.value);
  }

  function fillRadio(item, value) {
    const inputs = radioInputs(item.el);
    const candidates = inputs.map((input) => ({ text: radioText(input), input })).filter((c) => c.text);
    const best = pickBest(value, candidates);
    if (!best) return false;
    const input = best.candidate.input;
    if (input.checked) return true;
    input.click();
    if (!input.checked) {
      input.checked = true;
      fire(input, 'input');
      fire(input, 'change');
    }
    highlight(input);
    return true;
  }

  /* ---------------- 单字段填充 ---------------- */

  async function fillOne(item, profile, options) {
    if (item.type === 'file') return 'unsupported';

    const value = RF.getFieldValue(profile, item);
    if (!value) return 'empty';

    const type = item.type;
    if (type === 'date-group') {
      if (isDateGroupFilled(item) && !options.overwriteExisting) return 'existing';
      const filled = await fillDateGroup(item, value, options);
      if (filled && options.highlight) highlight(item.el);
      return filled ? 'filled' : 'failed';
    }
    if (isFilled(item.el, type) && !options.overwriteExisting) return 'existing';

    let ok = false;
    try {
      if (item.key === 'rank' && (type === 'select' || type === 'custom-select' || type === 'radio')) {
        const ranked = await fillRank(item);
        if (ranked) {
          if (options.highlight) highlight(item.el);
          return 'filled';
        }
      }
      if (type === 'radio') {
        ok = fillRadio(item, value);
      } else if (type === 'select') {
        ok = chooseSelect(item.el, value, item.key === 'major' ? majorScore : undefined);
      } else if (type === 'custom-select') {
        ok = item.key === 'major'
          ? await fillCustomSelect(item.el, value, (text) => majorScore(value, text), { forceSearch: true })
          : await fillCustomSelect(item.el, value);
      } else if (type === 'search-select') {
        ok = await fillSearchSelect(item.el, value, item.key === 'major' ? majorScore : undefined);
      } else if (type === 'date-picker') {
        ok = await fillDatePicker(item.el, value);
      } else {
        const isDate = /Date$/.test(item.key);
        ok = fillText(item.el, isDate ? formatDateFor(item.el, value) : value);
      }
    } catch (error) {
      ok = false;
    }

    if (ok && options.highlight) highlight(item.el);
    return ok ? 'filled' : 'failed';
  }

  /* ---------------- 页面提示 ---------------- */

  function toast(message, tone) {
    try {
      if (global.top !== global) return;
    } catch (e) { /* cross-origin */ }

    const id = 'rf-toast-host-9f3c';
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement('div');
      host.id = id;
      host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;pointer-events:none';
      const shadow = host.attachShadow({ mode: 'open' });
      const box = document.createElement('div');
      Object.assign(box.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '360px',
        padding: '12px 16px',
        background: '#0f172a',
        color: '#f8fafc',
        borderRadius: '12px',
        font: '13px/1.5 "PingFang SC","Microsoft YaHei",system-ui,sans-serif',
        boxShadow: '0 12px 32px rgba(15,23,42,.28)',
        opacity: '0',
        transform: 'translateY(8px)',
        transition: 'opacity .25s ease, transform .25s ease'
      });
      const dot = document.createElement('span');
      Object.assign(dot.style, {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#34d399',
        flex: 'none'
      });
      const messageNode = document.createElement('span');
      Object.assign(messageNode.style, { whiteSpace: 'normal' });
      box.append(dot, messageNode);
      shadow.append(box);
      document.documentElement.appendChild(host);
    }
    const box = host.shadowRoot.firstElementChild;
    const dot = box.firstElementChild;
    dot.style.background = tone === 'error' ? '#f87171' : '#34d399';
    box.lastElementChild.textContent = message;
    requestAnimationFrame(() => {
      box.style.opacity = '1';
      box.style.transform = 'translateY(0)';
    });
    clearTimeout(host._timer);
    host._timer = setTimeout(() => {
      box.style.opacity = '0';
      box.style.transform = 'translateY(8px)';
      setTimeout(() => host.remove(), 300);
    }, 3600);
  }
  RF.toast = toast;

  /* ---------------- 主流程 ---------------- */

  /* ---------------- 动态“添加一条” ---------------- */

  const REPEAT_GROUPS = {
    education: 'educations',
    internship: 'internships',
    project: 'projects',
    paper: 'papers',
    honor: 'honors',
    campus: 'campus'
  };

  function countSectionRecords(items, section) {
    const recordKey = RF.RECORD_KEYS[section];
    if (!recordKey) return 0;
    let max = 0;
    for (const item of items) {
      if (item.section !== section || item.key !== recordKey) continue;
      max = Math.max(max, (item.recordIndex || 0) + 1);
    }
    return max;
  }

  function buttonText(el) {
    return RF.cleanText(
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      ''
    );
  }

  function findAddButton(section) {
    const keywords = RF.SECTION_KEYWORDS[section] || [];
    const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]'));
    for (const button of buttons) {
      if (!RF.isVisible(button)) continue;
      if (button.disabled) continue;
      if (button.tagName === 'BUTTON' && button.type === 'submit') continue;
      const text = buttonText(button);
      if (!text || !/添加|新增|追加|继续添加/.test(text)) continue;
      if (/删除|移除|取消|上传|附件/.test(text)) continue;

      const info = RF.detectSection(button);
      if (info && info.section === section) return button;
      if (keywords.some((keyword) => text.includes(keyword))) return button;
    }
    return null;
  }

  async function ensureRepeatSections(profile) {
    for (const [section, group] of Object.entries(REPEAT_GROUPS)) {
      const target = (profile[group] || []).filter((record) => !RF.isEmptyRecord(record)).length;
      if (target <= 1) continue;

      let current = countSectionRecords(RF.collectFields(document), section);
      let guard = 0;
      while (current < target && guard < 6) {
        const button = findAddButton(section);
        if (!button) break;
        button.click();
        let next = current;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await sleep(200);
          next = countSectionRecords(RF.collectFields(document), section);
          if (next > current) break;
        }
        if (next <= current) break;
        current = next;
        guard += 1;
      }
    }
  }
  RF.ensureRepeatSections = ensureRepeatSections;

  function summarize(stats) {    const parts = [`已填写 ${stats.filled} 项`];
    if (stats.existing) parts.push(`跳过 ${stats.existing} 项已有内容`);
    if (stats.failed) parts.push(`${stats.failed} 项未匹配`);
    if (stats.unsupported) parts.push(`${stats.unsupported} 项需手动上传`);
    return parts.join(' · ');
  }

  RF.runFill = async function runFill(options) {
    const state = await RF.getState();
    const opts = Object.assign({}, options || {});
    if (opts.overwriteExisting == null) opts.overwriteExisting = state.settings.overwriteExisting;
    if (opts.highlight == null) opts.highlight = state.settings.highlight;
    if (opts.silent == null) opts.silent = false;
    const profile = state.profile;

    if (!RF.isMeaningfulProfile(profile)) {
      if (!opts.silent) toast('还没有简历资料，请先在插件设置里填写', 'error');
      return { ok: false, error: 'EMPTY_PROFILE', filled: 0, existing: 0, empty: 0, failed: 0, unsupported: 0, total: 0 };
    }

    const stats = { filled: 0, existing: 0, empty: 0, failed: 0, unsupported: 0, total: 0, fields: [] };
    // 有些站点默认只渲染一条经历，需要先点“添加”才能填后续记录
    await ensureRepeatSections(profile);
    const items = RF.collectFields(document);
    stats.total = items.length;

    for (const item of items) {
      const result = await fillOne(item, profile, opts);
      stats[result] = (stats[result] || 0) + 1;
      if (result === 'filled') {
        stats.fields.push({ label: item.label, key: item.key, section: item.section, recordIndex: item.recordIndex });
      }
      if (result === 'failed' && opts.highlight && item.el) highlight(item.el);
    }

    // 处理联动下拉：第一次选择省/市后，后续选项可能才加载
    const visibleSelects = items.filter((item) => item.type === 'custom-select' || item.type === 'select');
    if (visibleSelects.length) {
      await sleep(220);
      const second = RF.collectFields(document);
      for (const item of second) {
        if (!['select', 'custom-select'].includes(item.type)) continue;
        if (!item.key || !RF.getFieldValue(profile, item)) continue;
        if (isFilled(item.el, item.type)) continue;
        const result = await fillOne(item, profile, opts);
        if (result === 'filled') {
          stats.filled += 1;
          stats.fields.push({ label: item.label, key: item.key, section: item.section, recordIndex: item.recordIndex });
        }
      }
    }

    stats.ok = true;
    if (!opts.silent) {
      if (stats.filled > 0) toast(summarize(stats));
      else if (stats.total === 0) toast('当前页面没有检测到可填写的表单', 'error');
      else toast(`没有可填写的字段（识别到 ${stats.total} 个，${stats.existing} 个已有内容）`, 'error');
    }
    return stats;
  };

  RF.scanPage = function scanPage() {
    const items = RF.collectFields(document);
    return {
      total: items.length,
      fields: items.map((item) => ({
        label: item.label,
        section: item.section,
        sectionTitle: item.sectionTitle,
        key: item.key,
        score: Number(item.score.toFixed(2)),
        type: item.type,
        tag: item.el.tagName.toLowerCase(),
        name: item.el.getAttribute('name') || '',
        recordIndex: item.recordIndex,
        filled: isFilled(item.el, item.type)
      }))
    };
  };

  /* ---------------- 开放题 ---------------- */

  function findQuestionItems() {
    const known = new Set(
      RF.collectFields(document).filter((item) => item.key).map((item) => item.el)
    );
    const nodes = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[contenteditable=""],input[type="text"]'));
    const questions = [];
    for (const el of nodes) {
      if (known.has(el)) continue;
      if (!RF.isVisible(el) || el.disabled || el.readOnly) continue;
      if (el.value && el.value.trim()) continue;
      const labels = RF.getLabelCandidates(el);
      let text = labels.length ? labels[0].text : '';
      if (!text) {
        const parent = el.closest('.ant-form-item,.el-form-item,.form-item,.form-group,.question-item,li,fieldset') || el.parentElement;
        text = parent ? RF.cleanText(parent.textContent).slice(0, 160) : '';
      }
      if (!text || text.length < 5) continue;
      const isQuestion = /[？?]/.test(text) || /请(描述|说明|谈谈|介绍|举例|简要|结合)|为什么|如何|怎么|你的(看法|理解|规划|优势|缺点)|职业规划|自我评价|最有|挑战|收获/.test(text);
      if (!isQuestion) continue;
      const limit = parseInt(el.getAttribute('maxlength') || '0', 10);
      questions.push({ el, question: text.slice(0, 200), limit });
      if (questions.length >= 6) break;
    }
    return questions;
  }

  function matchQA(question, qaList) {
    let best = null;
    for (const qa of qaList || []) {
      if (!qa.answer || !qa.answer.trim()) continue;
      const keywords = String(qa.keywords || '').split(/[,，、;；\s]+/).map((k) => k.trim()).filter(Boolean);
      let score = 0;
      keywords.forEach((keyword) => {
        if (question.includes(keyword)) score += 2;
      });
      if (qa.question && question.length > 3 && (question.includes(qa.question) || qa.question.includes(question))) {
        score += 3;
      }
      if (score > 0 && (!best || score > best.score)) best = { score, qa };
    }
    return best ? best.qa.answer : '';
  }

  RF.fillOpenQuestions = async function fillOpenQuestions(options) {
    const opts = options || {};
    const state = await RF.getState();
    const questions = findQuestionItems();
    if (!questions.length) {
      if (!opts.silent) toast('没有找到待回答的开放题');
      return { ok: true, filled: 0, fromBank: 0, fromAI: 0, total: 0 };
    }

    const result = { ok: true, filled: 0, fromBank: 0, fromAI: 0, total: questions.length, error: '' };
    const pending = [];

    for (const item of questions) {
      const banked = matchQA(item.question, state.profile.qa);
      if (banked) {
        if (fillText(item.el, banked)) {
          result.filled += 1;
          result.fromBank += 1;
          if (state.settings.highlight) highlight(item.el);
        }
      } else {
        pending.push(item);
      }
    }

    if (pending.length && state.settings.ai.enabled && state.settings.ai.apiKey) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RF_AI_ANSWER',
          questions: pending.map((item) => item.question),
          profile: state.profile
        });
        if (response && response.ok && Array.isArray(response.answers)) {
          pending.forEach((item, index) => {
            const answer = response.answers[index];
            if (answer && String(answer).trim() && fillText(item.el, answer)) {
              result.filled += 1;
              result.fromAI += 1;
              if (state.settings.highlight) highlight(item.el);
            }
          });
        } else {
          result.error = (response && response.error) || 'AI 调用失败';
        }
      } catch (error) {
        result.error = error && error.message ? error.message : String(error);
      }
    } else if (pending.length) {
      result.error = 'AI 未启用，且没有命中本地语料库';
    }

    if (!opts.silent) {
      if (result.filled) {
        const detail = [result.fromBank ? `语料库 ${result.fromBank}` : '', result.fromAI ? `AI ${result.fromAI}` : '']
          .filter(Boolean).join(' · ');
        toast(`已回答 ${result.filled} 道开放题${detail ? `（${detail}）` : ''}`);
      } else {
        toast(result.error || '开放题没有匹配到语料', 'error');
      }
    }
    return result;
  };
})(typeof window !== 'undefined' ? window : self);
