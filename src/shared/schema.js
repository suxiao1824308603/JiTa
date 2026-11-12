/* 简填 · 数据结构与本地存储
 * 所有简历数据只保存在 chrome.storage.local，不会上传（AI 功能除外，且由用户主动触发）。
 */
(function (global) {
  'use strict';

  const RF = (global.RF = global.RF || {});

  RF.APP_NAME = '简填 · 网申助手';
  RF.PROFILE_KEY = 'rf_profile_v1';
  RF.SETTINGS_KEY = 'rf_settings_v1';

  const emptyEducation = () => ({
    school: '', college: '', major: '', degree: '', startDate: '', endDate: '',
    gpa: '', rank: '', city: '', courses: ''
  });
  const emptyInternship = () => ({
    company: '', department: '', position: '', startDate: '', endDate: '',
    city: '', description: '', achievements: ''
  });
  const emptyProject = () => ({
    name: '', role: '', startDate: '', endDate: '',
    description: '', achievements: '', tech: ''
  });
  const emptyCampus = () => ({
    organization: '', role: '', startDate: '', endDate: '', description: ''
  });
  const emptyPaper = () => ({ title: '', journal: '', publishDate: '', rank: '', link: '' });
  const emptyHonor = () => ({ name: '', awardDate: '' });
  const emptyQA = () => ({ id: '', keywords: '', question: '', answer: '' });

  RF.emptyEducation = emptyEducation;
  RF.emptyInternship = emptyInternship;
  RF.emptyProject = emptyProject;
  RF.emptyCampus = emptyCampus;
  RF.emptyPaper = emptyPaper;
  RF.emptyHonor = emptyHonor;
  RF.emptyQA = emptyQA;

  RF.defaultProfile = function defaultProfile() {
    return {
      version: 3,
      basic: {
        name: '', gender: '', birthDate: '', phone: '', email: '', idCard: '',
        ethnicity: '', politicalStatus: '', hometown: '', household: '',
        maritalStatus: '', height: '', weight: '', address: '', postalCode: '',
        wechat: '', qq: '', expectedCity: '', expectedPosition: '',
        expectedSalary: '', availableDate: '', website: '', github: '',
        selfEvaluation: ''
      },
      educations: [emptyEducation()],
      internships: [emptyInternship()],
      projects: [emptyProject()],
      papers: [emptyPaper()],
      honors: [emptyHonor()],
      campus: [emptyCampus()],
      skills: { languages: '', certificates: '', software: '', awards: '' },
      qa: []
    };
  };

  RF.defaultSettings = function defaultSettings() {
    return {
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
  };

  /* 仅用于“体验示例”，让用户第一次打开就能看到填表效果 */
  RF.demoProfile = function demoProfile() {
    const p = RF.defaultProfile();
    p.basic = {
      name: '张三',
      gender: '男',
      birthDate: '2001-03',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      idCard: '320100200103150011',
      ethnicity: '汉族',
      politicalStatus: '中共党员',
      hometown: '江苏南京',
      household: '江苏南京',
      maritalStatus: '未婚',
      height: '178',
      weight: '68',
      address: '上海市浦东新区世纪大道 100 号',
      postalCode: '200120',
      wechat: 'zhangsan_dev',
      qq: '100000001',
      expectedCity: '上海',
      expectedPosition: '后端开发工程师',
      expectedSalary: '20-25K',
      availableDate: '2026-07',
      website: 'https://zhangsan.dev',
      github: 'https://github.com/zhangsan',
      selfEvaluation:
        '计算机专业硕士应届生，具备扎实的 Java/Go 后端基础，熟悉 MySQL、Redis 与容器化部署。' +
        '有两段互联网后端实习经历，主导过日均百万请求服务的性能优化，习惯用数据驱动方案取舍，' +
        '沟通与文档习惯良好，能快速融入协作紧密的研发团队。'
    };
    p.educations = [
      {
        school: '上海交通大学', college: '电子信息与电气工程学院', major: '计算机技术', degree: '硕士',
        startDate: '2024-09', endDate: '2026-06', gpa: '3.8/4.0', rank: '5/120',
        city: '上海', courses: '分布式系统、算法设计与分析、数据库系统'
      },
      {
        school: '南京大学', college: '计算机学院', major: '软件工程', degree: '本科',
        startDate: '2020-09', endDate: '2024-06', gpa: '3.7/4.0', rank: '8/150',
        city: '南京', courses: '数据结构、操作系统、计算机网络'
      }
    ];
    p.internships = [
      {
        company: '星云科技（上海）有限公司', department: '基础架构部', position: '后端开发实习生',
        startDate: '2025-06', endDate: '2025-09', city: '上海',
        description:
          '负责订单中心查询接口的开发与维护，基于 Go 重构高频查询链路；' +
          '参与慢查询治理，通过索引优化与缓存分层将 P99 从 480ms 降至 120ms。',
        achievements: '接口性能提升 75%，支撑大促期间峰值 3 万 QPS，获得部门季度优秀实习生。'
      }
    ];
    p.projects = [
      {
        name: '分布式任务调度系统', role: '后端负责人',
        startDate: '2024-10', endDate: '2025-03',
        description:
          '面向学院实验室的轻量任务调度平台，支持 Cron 表达式、失败重试与任务分片，' +
          '基于 etcd 实现选主与故障转移。',
        achievements: '稳定调度 1.2 万个任务，故障恢复时间从分钟级降至 5 秒内。',
        tech: 'Go、etcd、MySQL、Prometheus、Docker'
      }
    ];
    p.papers = [
      {
        title: '基于 etcd 的分布式任务调度系统设计与实现',
        journal: '《计算机工程与应用》',
        publishDate: '2025-03',
        rank: '第一作者',
        link: 'https://doi.org/10.3778/j.issn.1002-8331.2403-0123'
      },
      {
        title: '面向高并发场景的缓存分层优化方法',
        journal: '《计算机应用研究》',
        publishDate: '2024-11',
        rank: '第二作者',
        link: 'https://doi.org/10.3969/j.issn.1001-3695.2024.11.008'
      }
    ];
    p.honors = [
      { name: '国家奖学金', awardDate: '2023-10' },
      { name: '全国大学生软件创新大赛二等奖', awardDate: '2023-08' },
      { name: '校优秀学生干部', awardDate: '2022-12' }
    ];
    p.campus = [
      {
        organization: '校学生会技术部', role: '副部长',
        startDate: '2021-09', endDate: '2023-06',
        description: '带领 8 人小组维护校园活动报名系统，累计服务 2 万余名同学。'
      }
    ];
    p.skills = {
      languages: '英语 CET-6（580）；日语 N3',
      certificates: '计算机技术与软件专业技术资格（中级）；CET-6',
      software: 'Java、Go、MySQL、Redis、Kafka、Docker、Kubernetes、Git',
      awards: ''
    };
    p.qa = [
      {
        id: 'qa_demo_1',
        keywords: '职业规划,五年,未来',
        question: '你的职业规划是什么？',
        answer:
          '短期（1—2 年）我希望在后端工程岗位上把基础打扎实，独立负责核心模块的交付，' +
          '补齐性能优化与稳定性建设方面的工程经验；中期（3—5 年）希望成长为能主导系统设计的技术骨干，' +
          '在业务理解和技术方案之间做好平衡，并带动新人一起成长。'
      }
    ];
    return p;
  };

  RF.normalizeProfile = function normalizeProfile(raw) {
    const base = RF.defaultProfile();
    if (!raw || typeof raw !== 'object') return base;

    const out = base;
    out.version = 3;
    if (raw.basic && typeof raw.basic === 'object') {
      Object.keys(base.basic).forEach((k) => {
        if (raw.basic[k] != null) out.basic[k] = String(raw.basic[k]);
      });
    }
    ['educations', 'internships', 'projects', 'papers', 'honors', 'campus'].forEach((group) => {
      const defaults = {
        educations: emptyEducation, internships: emptyInternship,
        projects: emptyProject, papers: emptyPaper, honors: emptyHonor,
        campus: emptyCampus
      }[group];
      const list = Array.isArray(raw[group]) ? raw[group] : [];
      out[group] = list.map((item) => {
        const rec = defaults();
        if (item && typeof item === 'object') {
          Object.keys(rec).forEach((k) => {
            if (item[k] != null) rec[k] = String(item[k]);
          });
        }
        return rec;
      });
      if (!out[group].length) out[group] = [defaults()];
    });
    if (raw.skills && typeof raw.skills === 'object') {
      Object.keys(out.skills).forEach((k) => {
        if (raw.skills[k] != null) out.skills[k] = String(raw.skills[k]);
      });
    }
    // 旧版本把获奖情况存在 skills.awards：没有结构化荣誉时自动迁移
    const hasHonors = Array.isArray(raw.honors) &&
      raw.honors.some((item) => item && String(item.name || '').trim());
    if (!hasHonors && String(out.skills.awards || '').trim()) {
      const names = String(out.skills.awards)
        .split(/[\n;；]+/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (names.length) {
        out.honors = names.map((name) => ({ name, awardDate: '' }));
        out.skills.awards = '';
      }
    }
    if (Array.isArray(raw.qa)) {
      out.qa = raw.qa.map((item) => {
        const rec = emptyQA();
        if (item && typeof item === 'object') {
          Object.keys(rec).forEach((k) => {
            if (item[k] != null) rec[k] = String(item[k]);
          });
        }
        if (!rec.id) rec.id = 'qa_' + Math.random().toString(36).slice(2, 9);
        return rec;
      });
    }
    return out;
  };

  RF.normalizeSettings = function normalizeSettings(raw) {
    const base = RF.defaultSettings();
    if (!raw || typeof raw !== 'object') return base;
    if (Array.isArray(raw.autoFillDomains)) {
      base.autoFillDomains = raw.autoFillDomains
        .map((d) => String(d || '').trim().toLowerCase())
        .filter(Boolean);
    }
    base.overwriteExisting = !!raw.overwriteExisting;
    base.highlight = raw.highlight !== false;
    if (raw.ai && typeof raw.ai === 'object') {
      base.ai.enabled = !!raw.ai.enabled;
      if (raw.ai.baseURL) base.ai.baseURL = String(raw.ai.baseURL);
      if (raw.ai.apiKey) base.ai.apiKey = String(raw.ai.apiKey);
      if (raw.ai.model) base.ai.model = String(raw.ai.model);
      if (raw.ai.temperature != null) base.ai.temperature = Number(raw.ai.temperature) || 0.4;
    }
    return base;
  };

  RF.getState = async function getState() {
    const got = await chrome.storage.local.get([RF.PROFILE_KEY, RF.SETTINGS_KEY]);
    return {
      profile: RF.normalizeProfile(got[RF.PROFILE_KEY]),
      settings: RF.normalizeSettings(got[RF.SETTINGS_KEY])
    };
  };

  RF.saveProfile = async function saveProfile(profile) {
    const normalized = RF.normalizeProfile(profile);
    await chrome.storage.local.set({ [RF.PROFILE_KEY]: normalized });
    return normalized;
  };

  RF.saveSettings = async function saveSettings(settings) {
    const normalized = RF.normalizeSettings(settings);
    await chrome.storage.local.set({ [RF.SETTINGS_KEY]: normalized });
    return normalized;
  };

  RF.getAtPath = function getAtPath(obj, path) {
    return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  };

  RF.setAtPath = function setAtPath(obj, path, value) {
    const keys = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
      cur = cur[key];
    }
    cur[keys[keys.length - 1]] = value;
  };

  RF.isEmptyRecord = function isEmptyRecord(record) {
    return !Object.values(record || {}).some((value) => String(value == null ? '' : value).trim());
  };

  RF.honorsSummary = function honorsSummary(profile) {
    return (profile.honors || [])
      .filter((honor) => String(honor.name || '').trim())
      .map((honor) => [honor.awardDate, honor.name].filter(Boolean).join(' '))
      .join('；');
  };

  /* 资料完整度：只统计网申最关键的字段 */
  RF.profileCompleteness = function profileCompleteness(profile) {
    const p = RF.normalizeProfile(profile);
    const edu = p.educations[0] || {};
    const checks = [
      ['姓名', p.basic.name],
      ['手机号', p.basic.phone],
      ['邮箱', p.basic.email],
      ['性别', p.basic.gender],
      ['学校', edu.school],
      ['专业', edu.major],
      ['学历', edu.degree],
      ['毕业时间', edu.endDate]
    ];
    const missing = checks.filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
    const done = checks.length - missing.length;
    return {
      percent: Math.round((done / checks.length) * 100),
      done,
      total: checks.length,
      missing
    };
  };

  RF.isMeaningfulProfile = function isMeaningfulProfile(profile) {
    const p = RF.normalizeProfile(profile);
    return !!(p.basic.name || p.basic.phone || p.basic.email ||
      (p.educations[0] && p.educations[0].school));
  };
})(typeof window !== 'undefined' ? window : self);
