/* 简填 · 字段识别与匹配
 * 思路：先从控件周围恢复“人看到的标签”，再判断它属于哪个经历章节，
 * 最后用同义词表 + 权重打分映射到简历里的标准字段。
 */
(function (global) {
  'use strict';

  const RF = (global.RF = global.RF || {});

  const BASIC = 'basic';
  const EDU = 'education';
  const INT = 'internship';
  const PRO = 'project';
  const PAPER = 'paper';
  const HONOR = 'honor';
  const CAM = 'campus';
  const SKI = 'skills';

  /* ---------- 同义词表 ----------
   * strong: 即使页面上没有章节标题，也足够有辨识度，可以直接匹配。
   */
  const FIELD_DEFS = [
    // 基本信息
    { section: BASIC, key: 'name', strong: true, aliases: ['姓名', '真实姓名', '中文姓名', '申请人姓名', '名字', 'fullname', 'candidatename', 'yourname'] },
    { section: BASIC, key: 'gender', strong: true, aliases: ['性别', 'gender', 'sex'] },
    { section: BASIC, key: 'birthDate', strong: true, aliases: ['出生日期', '出生年月', '出生年月日', '生日', '出生时间', 'dateofbirth', 'birthday'] },
    { section: BASIC, key: 'age', strong: true, aliases: ['年龄', 'age'] },
    { section: BASIC, key: 'phone', strong: true, aliases: ['手机号码', '手机号', '手机', '联系电话', '联系方式', '移动电话', '手机电话', 'phonenumber', 'mobile', 'phone', 'tel'] },
    { section: BASIC, key: 'email', strong: true, aliases: ['电子邮箱', '邮箱地址', '常用邮箱', 'qq邮箱', '163邮箱', '邮箱', '邮件地址', 'emailaddress', 'email', 'mail'] },
    { section: BASIC, key: 'idCard', strong: true, aliases: ['身份证号码', '身份证号', '身份证', '证件号码', '证件号', 'idcard', 'idnumber'] },
    { section: BASIC, key: 'ethnicity', strong: true, aliases: ['民族'] },
    { section: BASIC, key: 'politicalStatus', strong: true, aliases: ['政治面貌', '政治身份'] },
    { section: BASIC, key: 'hometown', strong: true, aliases: ['籍贯', '祖籍', '生源地'] },
    { section: BASIC, key: 'household', strong: true, aliases: ['户口所在地', '户籍所在地', '户口', '户籍'] },
    { section: BASIC, key: 'maritalStatus', strong: true, aliases: ['婚姻状况', '婚姻状态', '婚否'] },
    { section: BASIC, key: 'height', strong: true, aliases: ['身高'] },
    { section: BASIC, key: 'weight', strong: true, aliases: ['体重'] },
    { section: BASIC, key: 'address', strong: true, aliases: ['现居住地', '通讯地址', '联系地址', '家庭住址', '现住址', '居住地址', '地址', '所在地'] },
    { section: BASIC, key: 'postalCode', strong: true, aliases: ['邮政编码', '邮编', 'postalcode', 'zipcode'] },
    { section: BASIC, key: 'wechat', strong: true, aliases: ['微信号', '微信', 'wechat'] },
    { section: BASIC, key: 'qq', strong: true, aliases: ['qq号码', 'qq号', 'qq', 'qqnumber'] },
    { section: BASIC, key: 'expectedCity', strong: true, aliases: ['期望工作城市', '期望城市', '意向城市', '期望工作地点', '期望地点', 'expectedcity'] },
    { section: BASIC, key: 'expectedPosition', strong: true, aliases: ['期望职位', '应聘职位', '求职意向', '意向岗位', '应聘岗位', '期望岗位', '目标岗位', '申请职位', 'jobtitle', 'positionapplied'] },
    { section: BASIC, key: 'expectedSalary', strong: true, aliases: ['期望薪资', '期望月薪', '期望年薪', '薪资要求', '期望待遇', 'expectedsalary'] },
    { section: BASIC, key: 'availableDate', strong: true, aliases: ['到岗时间', '可到岗时间', '可入职时间', '最快到岗时间', '入职时间', 'availabletime'] },
    { section: BASIC, key: 'website', strong: true, aliases: ['个人主页', '个人网站', '个人链接', '作品集', '博客', 'website', 'homepage', 'portfolio'] },
    { section: BASIC, key: 'github', strong: true, aliases: ['github', 'gitee', '代码仓库', '开源主页'] },
    { section: BASIC, key: 'selfEvaluation', strong: true, aliases: ['自我评价', '自我介绍', '个人评价', '个人简介', '个人优势', '自我描述'] },

    // 教育经历
    { section: EDU, key: 'school', strong: true, aliases: ['学校名称', '毕业院校', '毕业学校', '就读学校', '院校名称', '学校', '院校', 'school', 'university', 'college'] },
    { section: EDU, key: 'college', strong: true, aliases: ['学院名称', '所在学院', '二级学院', '院系名称', '所在院系', '学院', '院系', 'faculty', 'schoolcollege'] },
    { section: EDU, key: 'major', strong: true, aliases: ['专业名称', '所学专业', '主修专业', '专业', 'major', 'fieldofstudy'] },
    { section: EDU, key: 'degree', strong: true, aliases: ['学历', '学位', '最高学历', '培养层次', '学历层次', '学历类型', 'degree', 'educationlevel'] },
    { section: EDU, key: 'startDate', strong: false, aliases: ['入学时间', '开始时间', '开始日期', '开始月份', '起始时间', '入学日期', '就读起始时间'] },
    { section: EDU, key: 'endDate', strong: false, aliases: ['毕业时间', '结束时间', '结束日期', '结束月份', '毕业日期', '预计毕业时间', '就读结束时间', '毕业年月'] },
    { section: EDU, key: 'gpa', strong: true, aliases: ['gpa', '绩点', '平均绩点', '平均分', '学分绩'] },
    { section: EDU, key: 'rank', strong: true, aliases: ['专业排名', '成绩排名', '班级排名', '年级排名', '排名'] },
    { section: EDU, key: 'city', strong: true, aliases: ['学校所在地', '院校所在地', '就读城市', '学校城市'] },
    { section: EDU, key: 'courses', strong: true, aliases: ['主修课程', '主要课程', '专业课程'] },

    // 实习 / 工作经历
    { section: INT, key: 'company', strong: true, aliases: ['公司名称', '单位名称', '实习公司', '工作单位', '企业名称', '公司', '单位', 'company', 'employer'] },
    { section: INT, key: 'department', strong: true, aliases: ['部门名称', '所在部门', '部门', 'department'] },
    { section: INT, key: 'position', strong: false, aliases: ['岗位名称', '职位名称', '实习岗位', '担任职位', '职位', '岗位', 'position'] },
    { section: INT, key: 'startDate', strong: false, aliases: ['开始时间', '开始日期', '开始月份', '实习开始时间', '入职时间', '起始时间'] },
    { section: INT, key: 'endDate', strong: false, aliases: ['结束时间', '结束日期', '结束月份', '实习结束时间', '离职时间', '截止时间'] },
    { section: INT, key: 'city', strong: true, aliases: ['工作地点', '实习地点', '工作城市', '实习城市'] },
    { section: INT, key: 'description', strong: true, aliases: ['工作描述', '工作内容', '实习内容', '职责描述', '主要职责', '工作职责', '实习描述', '岗位职责'] },
    { section: INT, key: 'achievements', strong: false, aliases: ['工作成果', '工作业绩', '主要成就', '业绩成果', '成果'] },

    // 项目经历
    { section: PRO, key: 'name', strong: true, aliases: ['项目名称', '项目名', '项目', 'projectname'] },
    { section: PRO, key: 'role', strong: false, aliases: ['担任角色', '项目角色', '项目职务', '承担角色', '角色'] },
    { section: PRO, key: 'startDate', strong: false, aliases: ['项目开始时间', '开始时间', '开始日期', '开始月份', '起始时间'] },
    { section: PRO, key: 'endDate', strong: false, aliases: ['项目结束时间', '结束时间', '结束日期', '结束月份', '截止时间'] },
    { section: PRO, key: 'description', strong: false, aliases: ['项目描述', '项目内容', '项目简介', '项目背景', '项目职责'] },
    { section: PRO, key: 'achievements', strong: false, aliases: ['项目成果', '项目业绩', '项目亮点', '成果'] },
    { section: PRO, key: 'tech', strong: true, aliases: ['技术栈', '使用技术', '开发环境', '技术方案', '关键技术'] },

    // 论文发表
    { section: PAPER, key: 'title', strong: true, aliases: ['论文名称', '论文题目', '论文标题', '文章名称', '文章标题', '论文', '题目', 'papertitle'] },
    { section: PAPER, key: 'journal', strong: true, aliases: ['期刊名称', '发表期刊', '发表刊物', '期刊', '会议名称', '发表会议', '会议', '刊物', '发表载体', '载体', 'journal', 'conference', 'venue'] },
    { section: PAPER, key: 'publishDate', strong: true, aliases: ['发表时间', '出版时间', '发表年月', '发表日期', '见刊时间', '录用时间', 'publishdate'] },
    { section: PAPER, key: 'rank', strong: false, aliases: ['作者排名', '作者顺序', '作者位次', '作者署名', '第几作者', '署名次序', '作者排序', '排名', 'authorrank'] },
    { section: PAPER, key: 'link', strong: true, aliases: ['论文链接', '原文链接', '文章链接', '论文网址', 'doi', 'paperlink', '论文doi'] },
    { section: PAPER, key: 'link', strong: false, aliases: ['链接', 'url', '网址', '论文地址'] },

    // 荣誉奖励
    { section: HONOR, key: 'name', strong: true, aliases: ['荣誉名称', '奖励名称', '奖项名称', '获奖名称', '荣誉', '奖项', '奖励', 'honorname', 'awardname'] },
    { section: HONOR, key: 'awardDate', strong: true, aliases: ['获得时间', '获奖时间', '授予时间', '获得日期', '获奖日期', '颁发时间', 'awarddate'] },

    // 校园经历
    { section: CAM, key: 'organization', strong: true, aliases: ['组织名称', '社团名称', '学生组织', '社团', '组织'] },
    { section: CAM, key: 'role', strong: false, aliases: ['担任职务', '学生职务', '职务', '角色'] },
    { section: CAM, key: 'startDate', strong: false, aliases: ['开始时间', '开始日期', '开始月份', '起始时间'] },
    { section: CAM, key: 'endDate', strong: false, aliases: ['结束时间', '结束日期', '结束月份', '截止时间'] },
    { section: CAM, key: 'description', strong: false, aliases: ['经历描述', '主要职责', '工作描述', '活动描述'] },

    // 技能证书
    { section: SKI, key: 'languages', strong: true, aliases: ['语言能力', '外语水平', '英语水平', '外语能力', '语言水平'] },
    { section: SKI, key: 'certificates', strong: true, aliases: ['资格证书', '已获证书', '证书名称', '职业资格', '证书'] },
    { section: SKI, key: 'software', strong: true, aliases: ['软件技能', '计算机技能', '专业技能', '技能特长', '掌握技能', '技能'] },
    { section: SKI, key: 'awards', strong: true, aliases: ['获奖情况', '获奖经历', '荣誉奖项', '所获荣誉', '奖项', '荣誉'] }
  ];

  const SECTION_KEYWORDS = {
    [BASIC]: ['基本信息', '个人信息', '基础信息', '个人资料'],
    [EDU]: ['教育经历', '教育背景', '学习经历', '教育信息', '学历信息', '教育与培训'],
    [INT]: ['实习经历', '工作经历', '实习与工作', '职业经历', '工作经验', '实习信息'],
    [PRO]: ['项目经历', '项目经验', '项目信息', '科研经历', '科研项目'],
    [PAPER]: ['论文发表', '发表论文', '学术论文', '期刊论文', '论文', '学术成果', '科研成果', '发表成果'],
    [HONOR]: ['荣誉奖励', '荣誉奖项', '获奖情况', '获奖经历', '所获荣誉', '奖励荣誉', '荣誉'],
    [CAM]: ['校园经历', '社团经历', '学生工作', '社会实践', '校园活动', '社团活动'],
    [SKI]: ['技能证书', '技能特长', '技能', '证书', '语言能力']
  };

  const SECTION_HINT_RE = [
    { re: /(^|[-_\s])(edu|education|jiaoyu|xueli)([-_\s]|$)/i, section: EDU },
    { re: /(^|[-_\s])(intern|internship|workexp|work-experience|shixi)([-_\s]|$)/i, section: INT },
    { re: /(^|[-_\s])(project|projects|xiangmu)([-_\s]|$)/i, section: PRO },
    { re: /(^|[-_\s])(paper|papers|publication|journal|lunwen)([-_\s]|$)/i, section: PAPER },
    { re: /(^|[-_\s])(honor|honors|award|awards|reward|jiangxiang)([-_\s]|$)/i, section: HONOR },
    { re: /(^|[-_\s])(campus|schoollife|shetuan|studentwork)([-_\s]|$)/i, section: CAM },
    { re: /(^|[-_\s])(skill|skills|certificate|jineng)([-_\s]|$)/i, section: SKI }
  ];

  const RECORD_KEYS = {
    [EDU]: 'school',
    [INT]: 'company',
    [PRO]: 'name',
    [PAPER]: 'title',
    [HONOR]: 'name',
    [CAM]: 'organization'
  };

  RF.FIELD_DEFS = FIELD_DEFS;
  RF.RECORD_KEYS = RECORD_KEYS;
  RF.SECTION_KEYWORDS = SECTION_KEYWORDS;

  const HEADING_SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'legend',
    '.section-title', '.section-header', '.card-title', '.panel-title',
    '.ant-card-head-title', '.el-card__header', '.form-section-title',
    '.block-title', '.module-title', '.part-title', '.group-title'
  ].join(',');

  const FIELD_CONTAINER_SELECTOR = [
    '.ant-form-item', '.el-form-item', '.ivu-form-item', '.form-item',
    '.form-group', '.field', '.form-row', '.input-group', '.question-item',
    '.ant-row', '.el-row', 'fieldset', 'td', 'tr', 'li'
  ].join(',');

  const LABELISH_SELECTOR = [
    '.ant-form-item-label', '.el-form-item__label', '.ivu-form-item-label',
    '.form-label', '.control-label', '.item-label', '.field-label',
    '.question-title', '.question-label', '.label', 'th', 'dt', 'label'
  ].join(',');

  const CONTROL_SELECTOR = [
    'input:not([type="hidden"])', 'textarea', 'select',
    '[contenteditable="true"]', '[contenteditable=""]',
    '.ant-select', '.el-select', '.ivu-select', '[role="combobox"]'
  ].join(',');

  const IGNORE_INPUT_TYPES = new Set([
    'hidden', 'submit', 'button', 'reset', 'image', 'file', 'color', 'range', 'password'
  ]);

  /* ---------------- 文本工具 ---------------- */

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .replace(/[*＊]/g, '')
      .replace(/[：:]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeLabel(value) {
    let s = cleanText(value).toLowerCase();
    s = s.replace(/[（(]\s*(必填|选填|必选|可选|如有|若有)\s*[)）]/g, '');
    s = s.replace(/^(请输入|请填写|请选择|请上传|输入|填写|选择|上传|您的|你的)+/, '');
    s = s.replace(/(必填|选填|必选|可选)$/, '');
    s = s.replace(/[\s\-_/\\.,，。;；、:：()（）\[\]【】<>《》"'`~!！?？]/g, '');
    return s;
  }

  function textWithoutControls(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input,select,textarea,button,script,style,svg,img').forEach((n) => n.remove());
    return cleanText(clone.textContent);
  }

  RF.cleanText = cleanText;
  RF.normalizeLabel = normalizeLabel;

  /* ---------------- 标签恢复 ---------------- */

  function labelFromTable(el) {
    const cell = el.closest('td');
    if (!cell) return '';
    const prev = cell.previousElementSibling;
    if (prev && prev.tagName === 'TH') return cleanText(prev.textContent);
    if (prev && prev.tagName === 'TD') {
      const t = textWithoutControls(prev);
      if (t.length <= 30) return t;
    }
    const row = cell.closest('tr');
    if (row) {
      const th = row.querySelector('th');
      if (th) {
        const t = cleanText(th.textContent);
        if (t.length <= 30 && !/[？?]/.test(t)) return t;
      }
    }
    return '';
  }

  function labelFromAncestors(el) {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      if (!node.matches(FIELD_CONTAINER_SELECTOR)) continue;
      const candidates = node.querySelectorAll(LABELISH_SELECTOR);
      for (const candidate of candidates) {
        if (candidate === el || candidate.contains(el)) continue;
        if (candidate.querySelector('input,select,textarea') && candidate.tagName !== 'LABEL') continue;
        const t = textWithoutControls(candidate);
        if (t && t.length <= 50 && !/[？?]/.test(t)) return t;
      }
    }
    return '';
  }

  function labelFromSiblings(el) {
    let prev = el.previousElementSibling;
    if (prev) {
      const t = textWithoutControls(prev);
      if (t && t.length >= 2 && t.length <= 20 && !/[？?]/.test(t) && !prev.querySelector('input,select,textarea')) return t;
    }
    const parent = el.parentElement;
    if (parent && parent.previousElementSibling) {
      const sibling = parent.previousElementSibling;
      // 只接受“纯文字标签”，避免把上一整行表单当成当前字段的标签
      if (!sibling.querySelector('input,select,textarea,button')) {
        const t = textWithoutControls(sibling);
        if (t && t.length >= 2 && t.length <= 20 && !/[？?]/.test(t)) return t;
      }
    }
    return '';
  }

  function attrLabels(el) {
    const out = [];
    ['aria-label', 'title', 'placeholder', 'data-label', 'data-field', 'data-name', 'name', 'id']
      .forEach((attr) => {
        const raw = el.getAttribute && el.getAttribute(attr);
        if (!raw) return;
        let v = String(raw);
        if (attr === 'name' || attr === 'id' || attr === 'data-field' || attr === 'data-name') {
          v = v
            .replace(/^[a-z]+[-_]/i, '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[-_]+/g, ' ')
            .replace(/\d{2,}/g, ' ');
        }
        const t = cleanText(v);
        if (t && t.length <= 60) out.push({ text: t, kind: attr });
      });
    return out;
  }

  function isGenericLabel(text) {
    const n = normalizeLabel(text);
    return !n || /^(请输入|请选择|输入|选择|填写|搜索|search|input|select)$/i.test(n) || n.length < 2;
  }

  RF.getLabelCandidates = function getLabelCandidates(el) {
    const out = [];
    const push = (text, kind, weight) => {
      const t = cleanText(text);
      if (!t || isGenericLabel(t)) return;
      const key = normalizeLabel(t);
      if (!key) return;
      if (out.some((item) => normalizeLabel(item.text) === key)) return;
      out.push({ text: t, kind, weight });
    };

    const labelledBy = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node = el.ownerDocument.getElementById(id);
        if (node) push(textWithoutControls(node), 'aria-labelledby', 1);
      });
    }
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) push(aria, 'aria-label', 1);

    if (el.labels && el.labels.length) {
      Array.from(el.labels).forEach((label) => push(textWithoutControls(label), 'label', 1));
    }
    const wrapping = el.closest && el.closest('label');
    if (wrapping) push(textWithoutControls(wrapping), 'label', 1);

    const tableLabel = labelFromTable(el);
    if (tableLabel) push(tableLabel, 'table', 1);

    const ancestorLabel = labelFromAncestors(el);
    if (ancestorLabel) push(ancestorLabel, 'form-item', 1);

    const siblingLabel = labelFromSiblings(el);
    if (siblingLabel) push(siblingLabel, 'sibling', 0.95);

    const placeholder = el.getAttribute && el.getAttribute('placeholder');
    if (placeholder) push(placeholder, 'placeholder', 0.9);

    attrLabels(el).forEach((item) => push(item.text, item.kind, 0.65));

    return out;
  };

  /* ---------------- 章节识别 ---------------- */

  const sectionCache = new WeakMap();

  function matchSectionTitle(title) {
    const t = cleanText(title);
    if (!t || t.length > 40) return null;
    for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (t.includes(keyword)) return { section, keyword };
      }
    }
    return null;
  }

  function sectionFromHints(el) {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const token = `${node.id || ''} ${typeof node.className === 'string' ? node.className : ''}`;
      if (!token.trim()) continue;
      for (const hint of SECTION_HINT_RE) {
        if (hint.re.test(token)) return hint.section;
      }
    }
    return null;
  }

  function collectHeadings(root) {
    if (sectionCache.has(root)) return sectionCache.get(root);
    const headings = [];
    root.querySelectorAll(HEADING_SELECTOR).forEach((node) => {
      const t = cleanText(node.textContent);
      if (!t || t.length > 60) return;
      headings.push({ node, text: t });
    });
    sectionCache.set(root, headings);
    return headings;
  }

  RF.detectSection = function detectSection(el) {
    const root = el.ownerDocument || document;
    const headings = collectHeadings(root);
    let best = null;
    for (const item of headings) {
      if (item.node.contains(el)) continue;
      // 只保留在字段之前出现的标题
      const pos = item.node.compareDocumentPosition(el);
      if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const info = matchSectionTitle(item.text);
      if (!info) continue;
      if (!best || (best.node.compareDocumentPosition(item.node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        best = { node: item.node, text: item.text, section: info.section };
      }
    }
    if (best) return { section: best.section, title: best.text };
    const hinted = sectionFromHints(el);
    if (hinted) return { section: hinted, title: '' };
    return null;
  };

  /* ---------------- 匹配打分 ---------------- */

  const ALIAS_INDEX = [];
  FIELD_DEFS.forEach((def) => {
    def.aliases.forEach((alias) => {
      ALIAS_INDEX.push({
        section: def.section,
        key: def.key,
        strong: !!def.strong,
        alias: normalizeLabel(alias)
      });
    });
  });

  function baseScore(label, alias) {
    if (!alias || !label) return 0;
    if (label === alias) return 1;
    if (label.startsWith(alias) || label.endsWith(alias)) return 0.93;
    if (label.includes(alias)) return 0.86;
    if (alias.includes(label) && label.length >= 2) return 0.74;
    return 0;
  }

  RF.findMatch = function findMatch(label, section) {
    const normalized = normalizeLabel(label);
    if (!normalized || normalized.length < 2) return null;

    const scan = (activeSection) => {
      let best = null;
      for (const entry of ALIAS_INDEX) {
        let score = baseScore(normalized, entry.alias);
        if (!score) continue;

        if (!activeSection || activeSection === BASIC) {
          if (entry.section !== BASIC && !entry.strong) continue;
          if (entry.section !== BASIC && activeSection === BASIC) score -= 0.1;
        } else {
          if (entry.section === activeSection) score += 0.12;
          else if (entry.section === BASIC) score -= 0.03;
          else continue;
        }

        // 更长的同义词更具体，轻微加权
        score += Math.min(entry.alias.length, 14) * 0.002;
        if (!best || score > best.score) {
          best = { section: entry.section, key: entry.key, score, matchedAlias: entry.alias };
        }
      }
      return best;
    };

    let best = scan(section);
    // 章节里没有对应字段时，允许“足够有辨识度”的字段跨章节兜底，
    // 例如「获奖情况」章节下的「荣誉名称」「获得时间」。
    if ((!best || best.score < 0.6) && section && section !== BASIC) {
      best = scan(null);
    }
    if (!best || best.score < 0.6) return null;
    return best;
  };

  /* ---------------- 控件遍历 ---------------- */

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }
  RF.isVisible = isVisible;

  function controlType(el) {
    if (el.matches && el.matches('select')) return 'select';
    if (el.matches && el.matches('textarea')) return 'textarea';
    if (el.matches && el.matches('.ant-picker input,.el-date-editor input,.ivu-date-picker input')) return 'date-picker';
    if (el.matches && el.matches('input[aria-autocomplete="list"],input[role="combobox"]')) return 'search-select';
    if (el.matches && el.matches('input')) {
      const type = (el.type || 'text').toLowerCase();
      if (type === 'radio') return 'radio';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'file') return 'file';
      return 'text';
    }
    if (el.matches && el.matches('[contenteditable="true"],[contenteditable=""]')) return 'contenteditable';
    if (el.matches && el.matches('.ant-select,.el-select,.ivu-select,[role="combobox"]')) return 'custom-select';
    return 'text';
  }
  RF.controlType = controlType;

  function isCandidate(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('[data-rf-ignore]')) return false;
    if (el.matches('input')) {
      const type = (el.type || 'text').toLowerCase();
      if (IGNORE_INPUT_TYPES.has(type)) return type === 'file';
    }
    if (el.disabled) return false;
    if (el.readOnly) {
      // 自定义下拉内部的只读 input 由外层容器负责
      if (el.closest('.ant-select,.el-select,.ivu-select')) return false;
      // 日期选择器的输入框经常是只读的，需要允许通过弹层选择
      if (el.closest('.ant-picker,.el-date-editor,.ivu-date-picker')) return isVisible(el);
      if (el.matches('input,textarea')) return false;
    }
    if (el.matches('input[type="radio"],input[type="checkbox"]')) {
      // 很多组件库把原生单选藏起来（opacity:0 / display:none），只要选项文字可见就视为可填
      const group = el.closest('label,.ant-radio-wrapper,.el-radio,.ivu-radio-wrapper,[role="radiogroup"],.ant-radio-group,.el-radio-group') ||
        el.parentElement;
      if (group && isVisible(group)) return true;
    }
    return isVisible(el);
  }

  function radioGroupKey(el) {
    const name = el.getAttribute('name');
    if (name) {
      const form = el.closest('form');
      return (form ? 'form:' + (form.id || '') : 'doc') + ':radio:' + name;
    }
    const group = el.closest('.ant-radio-group,.el-radio-group,.ivu-radio-group,[role="radiogroup"]');
    if (group) {
      if (!group.dataset.rfRadioKey) {
        group.dataset.rfRadioKey = 'g' + Math.random().toString(36).slice(2, 9);
      }
      return group.dataset.rfRadioKey;
    }
    const parent = el.parentElement;
    if (!parent) return 'radio:unknown';
    if (!parent.dataset.rfRadioKey) parent.dataset.rfRadioKey = 'g' + Math.random().toString(36).slice(2, 9);
    return parent.dataset.rfRadioKey;
  }

  function radioGroupLabel(el) {
    const container = el.closest('.ant-form-item,.el-form-item,.ivu-form-item,.form-item,.form-group,.field,.question-item,fieldset,tr') ||
      el.closest('.ant-radio-group,.el-radio-group,[role="radiogroup"]')?.parentElement ||
      el.parentElement;
    if (container) {
      const labels = container.querySelectorAll(LABELISH_SELECTOR);
      for (const label of labels) {
        if (label.querySelector('input[type="radio"]')) continue;
        const t = textWithoutControls(label);
        if (t && t.length <= 40 && !/[？?]/.test(t)) return t;
      }
      const th = container.querySelector('th');
      if (th) {
        const t = cleanText(th.textContent);
        if (t && t.length <= 30) return t;
      }
    }
    const name = el.getAttribute('name') || el.id;
    if (name && !/^g[a-z0-9]{5,}$/i.test(name)) {
      return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
    }
    return '';
  }

  function bestLabel(el, type) {
    if (type === 'radio') {
      const groupLabel = radioGroupLabel(el);
      return groupLabel ? [{ text: groupLabel, kind: 'radio-group', weight: 1 }] : [];
    }
    return RF.getLabelCandidates(el);
  }

  /* ---------------- 年 / 月 / 日 组合 ---------------- */

  const DATE_CONTAINER_SELECTOR = [
    '.field', '.ant-form-item', '.el-form-item', '.ivu-form-item',
    '.form-item', '.form-group', '.form-row', 'td', 'tr'
  ].join(',');

  function datePartName(text) {
    const normalized = normalizeLabel(text);
    if (/^(年|年份|yyyy|yy|year)$/.test(normalized)) return 'year';
    if (/^(月|月份|mm|month)$/.test(normalized)) return 'month';
    if (/^(日|日期|dd|day|天)$/.test(normalized)) return 'day';
    return '';
  }

  function detectDatePart(el) {
    const texts = [];
    if (el.labels) Array.from(el.labels).forEach((label) => texts.push(label.textContent));
    RF.getLabelCandidates(el).forEach((candidate) => texts.push(candidate.text));
    ['placeholder', 'aria-label', 'title'].forEach((attr) => {
      const value = el.getAttribute && el.getAttribute(attr);
      if (value) texts.push(value);
    });
    for (const text of texts) {
      const part = datePartName(text);
      if (part) return part;
    }

    // 没有明确“年/月/日”标签时，从选项范围反推
    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options)
        .map((option) => cleanText(option.textContent))
        .filter((text) => text && !/请选择|select/i.test(text));
      if (!options.length) return '';
      if (options.every((text) => /^(19|20)\d{2}$/.test(text))) return 'year';
      if (options.every((text) => /^\d{1,2}\s*(月|日)?$/.test(text))) {
        const max = Math.max(...options.map((text) => parseInt(text, 10)).filter(Number.isFinite));
        return max > 12 ? 'day' : 'month';
      }
    }
    return '';
  }

  function collectDateGroups(root) {
    const candidates = [];
    root.querySelectorAll('select,input[type="text"],input:not([type]),input[type="number"],.ant-select,.el-select,.ivu-select')
      .forEach((el) => {
        if (el.closest('.ant-picker,.el-date-editor,.ivu-date-picker')) return;
        if (el.matches('input') && el.closest('.ant-select,.el-select,.ivu-select')) return;
        if (!isVisible(el) || el.disabled) return;
        const part = detectDatePart(el);
        if (!part) return;
        candidates.push({ el, part, type: controlType(el) });
      });

    const groups = [];
    const seenContainers = new Set();
    const byContainer = new Map();

    for (const candidate of candidates) {
      let container = candidate.el.closest(DATE_CONTAINER_SELECTOR);
      while (container) {
        const inside = candidates.filter((item) => container.contains(item.el));
        if (inside.length >= 2) break;
        container = container.parentElement ? container.parentElement.closest(DATE_CONTAINER_SELECTOR) : null;
      }
      if (!container) continue;
      if (!byContainer.has(container)) byContainer.set(container, []);
      byContainer.get(container).push(candidate);
    }

    byContainer.forEach((parts, container) => {
      if (seenContainers.has(container)) return;
      seenContainers.add(container);

      const unique = [];
      const used = new Set();
      parts.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      for (const part of parts) {
        if (used.has(part.el)) continue;
        used.add(part.el);
        unique.push(part);
      }
      const needed = ['year', 'month', 'day'].map((name) => unique.find((part) => part.part === name)).filter(Boolean);
      const hints = new Set(needed.map((part) => part.part));
      if (!hints.has('year') || !hints.has('month')) return;

      const first = needed[0];
      const sectionInfo = RF.detectSection(first.el);
      const section = sectionInfo ? sectionInfo.section : null;

      const labelTexts = [];
      container.querySelectorAll(LABELISH_SELECTOR).forEach((node) => {
        const text = textWithoutControls(node);
        if (text) labelTexts.push(text);
      });
      let previous = container.previousElementSibling;
      if (previous) {
        const text = textWithoutControls(previous);
        if (text) labelTexts.push(text);
      }
      needed.forEach((part) => {
        RF.getLabelCandidates(part.el).forEach((candidate) => labelTexts.push(candidate.text));
      });

      let best = null;
      for (const text of labelTexts) {
        const cleaned = cleanText(text);
        if (!cleaned || cleaned.length < 2 || cleaned.length > 40) continue;
        if (datePartName(cleaned)) continue;
        const match = RF.findMatch(cleaned, section);
        if (!match || !/Date$/.test(match.key)) continue;
        if (!best || match.score > best.score) {
          best = { ...match, label: cleaned };
        }
      }
      if (!best) return;

      groups.push({
        container,
        parts: needed,
        firstEl: needed[0].el,
        label: best.label,
        section: best.section,
        key: best.key,
        score: best.score,
        sectionTitle: sectionInfo ? sectionInfo.title : ''
      });
    });

    const byElement = new Map();
    groups.forEach((group) => group.parts.forEach((part) => byElement.set(part.el, group)));
    return { groups, byElement };
  }

  RF.collectFields = function collectFields(root) {
    root = root || document;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (doc) sectionCache.delete(doc);
    const nodes = Array.from(root.querySelectorAll(CONTROL_SELECTOR));
    const dateGroups = collectDateGroups(root);
    const items = [];
    const seen = new Set();
    const seenRadioGroups = new Set();
    const recordState = {};
    const recordKeySeen = {};
    const recordStats = {};

    const assignRecord = (item) => {
      const { section, key } = item;
      if (!section || section === BASIC || section === SKI || !key) return;
      if (!recordStats[section]) recordStats[section] = { count: 0, lastKeyAt: 0 };
      const stats = recordStats[section];
      stats.count += 1;
      const recordKey = RECORD_KEYS[section];
      if (recordKey && key === recordKey) {
        if (recordKeySeen[section]) {
          // 同一记录里出现两个“学校名称”时不切换记录；只有隔了几个字段再次出现才视为下一条。
          // 论文/荣誉的记录字段较少，出现同名标题基本就是下一条。
          const minGap = (section === HONOR || section === PAPER) ? 1 : 2;
          if (stats.count - stats.lastKeyAt >= minGap) {
            recordState[section] = (recordState[section] || 0) + 1;
          }
        }
        stats.lastKeyAt = stats.count;
        recordKeySeen[section] = true;
      }
      item.recordIndex = recordState[section] || 0;
    };

    for (const el of nodes) {
      const dateGroup = dateGroups.byElement.get(el);
      if (dateGroup) {
        if (dateGroup.firstEl !== el) continue;
        const item = {
          el: dateGroup.container,
          type: 'date-group',
          parts: dateGroup.parts,
          label: dateGroup.label,
          labelKind: 'date-group',
          section: dateGroup.section,
          key: dateGroup.key,
          score: dateGroup.score,
          sectionTitle: dateGroup.sectionTitle,
          recordIndex: 0,
          value: ''
        };
        assignRecord(item);
        items.push(item);
        continue;
      }

      if (!isCandidate(el)) continue;
      // 跳过自定义下拉内部的只读输入
      const customHost = el.closest('.ant-select,.el-select,.ivu-select');
      if (customHost && customHost !== el && el.matches('input,textarea')) continue;

      const type = controlType(el);
      if (type === 'checkbox') continue;

      if (type === 'radio') {
        const groupKey = radioGroupKey(el);
        if (seenRadioGroups.has(groupKey)) continue;
        seenRadioGroups.add(groupKey);
      }

      const labelCandidates = bestLabel(el, type);
      if (!labelCandidates.length) continue;

      const sectionInfo = RF.detectSection(el);
      const section = sectionInfo ? sectionInfo.section : null;

      let best = null;
      for (const candidate of labelCandidates) {
        const match = RF.findMatch(candidate.text, section);
        if (!match) continue;
        const weighted = match.score * candidate.weight;
        if (!best || weighted > best.score) {
          best = { ...match, score: weighted, label: candidate.text, labelKind: candidate.kind };
        }
      }

      const item = {
        el,
        type,
        label: best ? best.label : labelCandidates[0].text,
        labelKind: best ? best.labelKind : labelCandidates[0].kind,
        section: best ? best.section : (section || ''),
        key: best ? best.key : '',
        score: best ? best.score : 0,
        sectionTitle: sectionInfo ? sectionInfo.title : '',
        recordIndex: 0,
        value: ''
      };

      assignRecord(item);

      const dedupeKey = type + '|' + (el.name || '') + '|' + (el.id || '') + '|' + item.label;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push(item);
    }
    return items;
  };

  RF.getFieldValue = function getFieldValue(profile, item) {
    if (!item || !item.key) return '';
    const { section, key, recordIndex } = item;
    if (section === BASIC) {
      if (key === 'age') {
        const birth = profile.basic.birthDate;
        const year = parseInt(String(birth).slice(0, 4), 10);
        if (!year) return '';
        return String(new Date().getFullYear() - year);
      }
      return profile.basic[key] == null ? '' : String(profile.basic[key]);
    }
    if (section === SKI) {
      if (key === 'awards') {
        return String(profile.skills.awards || '').trim() || RF.honorsSummary(profile);
      }
      return profile.skills[key] == null ? '' : String(profile.skills[key]);
    }
    const groups = {
      [EDU]: 'educations',
      [INT]: 'internships',
      [PRO]: 'projects',
      [PAPER]: 'papers',
      [HONOR]: 'honors',
      [CAM]: 'campus'
    };
    const list = profile[groups[section]] || [];
    const record = list[recordIndex] || list[0];
    if (!record) return '';
    return record[key] == null ? '' : String(record[key]);
  };
})(typeof window !== 'undefined' ? window : self);
