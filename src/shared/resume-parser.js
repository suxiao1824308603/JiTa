/* 简填 · 简历文本解析
 * 输入：从 PDF 提取出的纯文本（也可以直接粘贴文字）
 * 输出：可以直接合并进简历的部分结构。
 *
 * 规则解析优先保证「不瞎编」：只识别有明确标签或明显特征的内容，
 * 更复杂的实习/项目描述可以交给可选的 AI 精细解析。
 */
(function (global) {
  'use strict';

  const RF = (global.RF = global.RF || {});
  if (!RF.defaultProfile) return;

  const CN_NAME_RE = /^[\u4e00-\u9fa5·]{2,4}$/;
  const SCHOOL_RE = /([\u4e00-\u9fa5A-Za-z·（）()]{2,32}(?:大学|学院|学校|University|College))/;
  const UNIVERSITY_RE = /([\u4e00-\u9fa5A-Za-z·（）()]{2,32}(?:大学|学校|University|College))/;
  const COLLEGE_RE = /([\u4e00-\u9fa5]{2,20}(?:学院|系))/;
  const COMPANY_STRONG_RE = /([\u4e00-\u9fa5A-Za-z·（）()]{2,40}(?:有限公司|有限责任公司|集团|银行|研究院|事务所|工作室))/;
  const COMPANY_WEAK_RE = /([\u4e00-\u9fa5A-Za-z·（）()]{2,40}(?:科技|公司|中心))/;
  const DEGREE_RE = /(博士研究生|硕士研究生|本科|学士|大专|专科|硕士|博士)/;
  const DATE_RANGE_RE = /((?:19|20)\d{2})\s*[年./-]?\s*(\d{1,2})?\s*[月]?\s*[-–—~至到]\s*((?:19|20)\d{2})\s*[年./-]?\s*(\d{1,2})?\s*[月]?/;
  const YEAR_MONTH_RE = /((?:19|20)\d{2})(?:\s*[年./-]\s*(\d{1,2}))?\s*[月]?/;

  const SECTION_PATTERNS = [
    ['education', /^(教育经历|教育背景|学习经历|教育信息|学历信息|教育与培训)/],
    ['internship', /^(实习经历|工作经历|实习与工作|职业经历|工作经验|实习信息)/],
    ['project', /^(项目经历|项目经验|科研经历|科研项目)/],
    ['paper', /^(论文发表|发表论文|学术论文|期刊论文|论文|学术成果|科研成果|发表成果)/],
    ['honor', /^(荣誉奖励|荣誉奖项|获奖情况|获奖经历|所获荣誉|奖励荣誉|荣誉)/],
    ['skills', /^(技能证书|技能特长|专业技能|技能|语言能力|证书)/],
    ['self', /^(自我评价|自我介绍|个人评价|个人简介)/]
  ];

  const KNOWN_MAJOR_RE = /([\u4e00-\u9fa5]{2,12}(?:专业|工程|科学与技术|科学与工程|技术|管理|经济|金融|文学|法学|医学|设计|传播|教育))/;
  const AWARD_WORD_RE = /(奖学金|一等奖|二等奖|三等奖|特等奖|金奖|银奖|铜奖|冠军|亚军|季军|优秀|标兵|先进|荣誉|称号|获奖|获得者)/;

  function clean(value) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toLines(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line && !/^第?\s*\d+\s*页(?:\s*[/／]\s*\d+)?$/.test(line));
  }

  function padMonth(value) {
    const month = parseInt(value, 10);
    return month >= 1 && month <= 12 ? String(month).padStart(2, '0') : '';
  }

  function formatYearMonth(year, month) {
    if (!year) return '';
    return month ? `${year}-${padMonth(month)}` : String(year);
  }

  function extractYearMonth(text) {
    const match = String(text || '').match(YEAR_MONTH_RE);
    if (!match) return '';
    return formatYearMonth(match[1], match[2]);
  }

  function stripDates(text) {
    return String(text || '')
      .replace(/[（(]?\s*(?:19|20)\d{2}\s*(?:[年./-]\s*\d{1,2}\s*[月]?)?\s*[)）]?/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractRank(text, name) {
    const value = String(text || '');
    const named = value.match(/(共同第一作者|共同一作|第一作者|第二作者|第三作者|第四作者|第五作者|通讯作者)/);
    if (named) return named[1];

    const ratio = value.match(/(?:作者排名|作者顺序|排名|位次)[:：]?\s*(\d+)\s*[/／]\s*(\d+)/);
    if (ratio) {
      const position = parseInt(ratio[1], 10);
      return ['第一作者', '第二作者', '第三作者', '第四作者'][position - 1] || `第 ${position} 作者`;
    }

    if (name) {
      const beforeTitle = value.split(/[.．。]/)[0] || '';
      const authors = beforeTitle.split(/[,，、;；]/).map((item) => item.trim()).filter(Boolean);
      const index = authors.findIndex((author) => author.includes(name));
      if (index >= 0) return ['第一作者', '第二作者', '第三作者', '第四作者'][index] || `第 ${index + 1} 作者`;
    }
    return '';
  }

  function detectHeading(line) {
    if (!line || line.length > 22) return null;
    const compact = line.replace(/[\s:：]/g, '');
    if (!compact || compact.length > 16) return null;
    // 「证书：计算机…」这类是内容行，不是章节标题
    if (/[:：]/.test(line.replace(/[:：]\s*$/, ''))) return null;
    for (const [key, pattern] of SECTION_PATTERNS) {
      if (pattern.test(compact)) return key;
    }
    return null;
  }

  function splitSections(lines) {
    const sections = { header: [] };
    let current = 'header';
    for (const line of lines) {
      const heading = detectHeading(line);
      if (heading) {
        current = heading;
        if (!sections[current]) sections[current] = [];
        continue;
      }
      sections[current].push(line);
    }
    return sections;
  }

  function firstMatch(regex, text) {
    const match = String(text || '').match(regex);
    return match ? clean(match[1]) : '';
  }

  function parseBasic(lines, sections, sectionsAnywhere) {
    const basic = {};
    const all = lines.join('\n');
    const compact = all.replace(/[ \t]/g, '');

    const phone = compact.match(/(?:^|[^\d])(1[3-9]\d{9})(?!\d)/);
    if (phone) basic.phone = phone[1];

    const email = all.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    if (email) basic.email = email[0];

    const idCard = compact.match(/(?:^|[^\dXx])(\d{17}[\dXx])(?![0-9Xx])/);
    if (idCard) basic.idCard = idCard[1].toUpperCase();

    let name = firstMatch(/姓\s*名[:：]?\s*([\u4e00-\u9fa5·]{2,4})/, all);
    if (!name) {
      for (const line of lines.slice(0, 8)) {
        const token = line.split(/[|/·,，\s]+/).filter(Boolean)[0] || '';
        if (CN_NAME_RE.test(token) && !/(简历|求职|个人|应聘|教育|工作|项目|论文|荣誉|技能|证书)/.test(token)) {
          name = token;
          break;
        }
      }
    }
    if (name) basic.name = name;

    const gender = all.match(/性\s*别[:：]?\s*(男|女)/) ||
      all.match(/(?:^|\n)\s*(男|女)\s*(?:\n|$)/);
    if (gender) basic.gender = gender[1];

    const birth = all.match(/出生(?:日期|年月|时间)?[:：]?\s*((?:19|20)\d{2})\s*[年./-]\s*(\d{1,2})?/);
    if (birth) basic.birthDate = formatYearMonth(birth[1], birth[2]);

    const political = all.match(/(中共党员|中共预备党员|共青团员|群众|民主党派|无党派人士)/);
    if (political) basic.politicalStatus = political[1];

    const ethnicity = all.match(/民\s*族[:：]?\s*([\u4e00-\u9fa5]{1,8})/);
    if (ethnicity) basic.ethnicity = ethnicity[1];

    const hometown = all.match(/籍\s*贯[:：]?\s*([^\s,，;；|/]{2,15})/);
    if (hometown) basic.hometown = hometown[1];

    const household = all.match(/(?:户口所在地|户籍所在地)[:：]?\s*([^\n|/]{2,20})/);
    if (household) basic.household = clean(household[1]);

    const marital = all.match(/婚姻状况[:：]?\s*(未婚|已婚)/);
    if (marital) basic.maritalStatus = marital[1];

    const height = all.match(/身\s*高[:：]?\s*(\d{2,3})/);
    if (height) basic.height = height[1];
    const weight = all.match(/体\s*重[:：]?\s*(\d{2,3})/);
    if (weight) basic.weight = weight[1];

    const address = all.match(/(?:现居住地|通讯地址|联系地址|家庭住址|现住址|居住地址)[:：]?\s*([^\n]{3,60})/);
    if (address) basic.address = clean(address[1]);

    const postal = all.match(/(?:邮政编码|邮编)[:：]?\s*(\d{6})/);
    if (postal) basic.postalCode = postal[1];

    const expectedPosition = all.match(/(?:求职意向|应聘岗位|目标岗位|期望职位|求职岗位|意向岗位)[:：]?\s*([^\n]{2,30})/);
    if (expectedPosition) basic.expectedPosition = clean(expectedPosition[1]);

    const expectedCity = all.match(/(?:期望城市|意向城市|期望工作城市|期望工作地点)[:：]?\s*([^\n]{2,20})/);
    if (expectedCity) basic.expectedCity = clean(expectedCity[1]);

    const available = all.match(/(?:到岗时间|可到岗时间|可入职时间|最快到岗)[:：]?\s*([^\n]{2,20})/);
    if (available) basic.availableDate = clean(available[1]);

    const header = sections.header && sections.header.length
      ? sections.header.join('\n')
      : lines.slice(0, 12).join('\n');
    const website = header.match(/https?:\/\/[^\s，,；;）)]+/g) || [];
    const github = website.find((url) => /github\.com|gitee\.com/i.test(url));
    if (github) basic.github = github;
    const personal = website.find((url) => !/github\.com|gitee\.com/i.test(url));
    if (personal) basic.website = personal;

    const selfLines = sectionsAnywhere.self && sectionsAnywhere.self.length
      ? sectionsAnywhere.self
      : [];
    if (selfLines.length) {
      basic.selfEvaluation = selfLines.join('\n').slice(0, 1200);
    } else {
      const self = all.match(/自我评价[:：]?\s*([\s\S]{10,600})/);
      if (self) basic.selfEvaluation = clean(self[1]).slice(0, 1200);
    }

    return basic;
  }

  function applyEducationDetails(record, line) {
    if (!record.college) {
      const labeled = line.match(/(?:所在学院|学院名称|院系名称|二级学院)[:：]\s*([^\s,，;；|/]{2,25})/);
      const stripped = record.school ? line.replace(record.school, ' ') : line;
      const named = stripped.match(/([\u4e00-\u9fa5]{2,20}(?:学院|系))/);
      if (labeled) record.college = labeled[1];
      else if (named && !record.school.includes(named[1])) record.college = named[1];
    }

    const detailLine = record.college ? line.replace(record.college, ' ') : line;
    const degree = detailLine.match(DEGREE_RE);
    if (degree && !record.degree) record.degree = degree[1].replace('研究生', '');

    if (!record.major) {
      const labeled = detailLine.match(/专\s*业\s*(?:[:：]\s*|\s+)([^\s,，;；|/]{2,20})/);
      if (labeled) {
        record.major = labeled[1];
      } else {
        const candidate = detailLine.match(KNOWN_MAJOR_RE);
        if (candidate && !record.school.includes(candidate[1])) record.major = candidate[1];
      }
    }

    if (!record.startDate || !record.endDate) {
      const range = detailLine.match(DATE_RANGE_RE);
      if (range) {
        record.startDate = formatYearMonth(range[1], range[2]);
        record.endDate = formatYearMonth(range[3], range[4]);
      }
    }

    const gpa = detailLine.match(/(?:GPA|绩点|平均分)[:：]?\s*([\d.]+(?:\s*[/／]\s*[\d.]+)?)/i);
    if (gpa && !record.gpa) record.gpa = gpa[1].replace(/\s+/g, '');

    const rank = detailLine.match(/(?:专业排名|成绩排名|排名)[:：]?\s*(\d+\s*[/／]\s*\d+)/);
    if (rank && !record.rank) record.rank = rank[1].replace(/\s+/g, '');
  }

  function parseEducation(lines, sections) {
    const source = sections.education && sections.education.length
      ? sections.education
      : lines.filter((line) => UNIVERSITY_RE.test(line));
    const list = [];
    let current = null;

    for (const line of source) {
      const university = line.match(UNIVERSITY_RE);
      const college = line.match(COLLEGE_RE);
      const looksLikeDetail = /(硕士|博士|本科|学士|大专|专科|GPA|绩点|排名|专业)/.test(line);
      const startsNew = university || !current || (college && !looksLikeDetail);

      if (startsNew) {
        if (current) list.push(current);
        const school = (university || college)[1];
        current = {
          school, college: '', major: '', degree: '', startDate: '', endDate: '',
          gpa: '', rank: '', city: '', courses: ''
        };
      }
      if (current) applyEducationDetails(current, line);
    }
    if (current) list.push(current);

    return list
      .filter((record) => record.school && record.school.length >= 4)
      .filter((record, index, array) => array.findIndex((item) => item.school === record.school) === index)
      .slice(0, 8);
  }

  function cleanPaperTitle(value) {
    return clean(value)
      .replace(/^\s*(?:\[\d+\]|\d+[.、)]|[-•·])\s*/, '')
      .replace(/^[《《"“]|[》》"”]$/g, '')
      .replace(/[.。;；,，]\s*$/, '')
      .trim();
  }

  function extractLink(text) {
    const value = String(text || '');
    const url = value.match(/https?:\/\/[^\s，,；;）)]+/);
    if (url) return url[0];
    const doi = value.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i);
    if (doi) return `https://doi.org/${doi[0].replace(/[.,;]+$/, '')}`;
    return '';
  }

  function parseCitation(line, name) {
    const text = String(line || '').trim();
    if (text.length < 8) return null;
    if (!/\[(J|C|M|D|R|EB\/OL)\]/i.test(text) && !/DOI|期刊|会议/i.test(text)) return null;

    const marker = text.match(/\[(J|C|M|D|R|EB\/OL)\]/i);
    let title = '';
    let journal = '';

    if (marker) {
      const before = text.slice(0, marker.index);
      const after = text.slice(marker.index + marker[0].length);
      const segments = before.split(/[.．。]\s*/).filter(Boolean);
      title = segments.length ? segments[segments.length - 1] : before;
      journal = (after.match(/^[.．。:：\s]*([^,，.。;；]+)/) || [])[1] || '';
    } else {
      const labeledTitle = text.match(/(?:论文名称|论文题目|论文标题|文章标题)[:：]\s*(.+)/);
      if (!labeledTitle) return null;
      title = labeledTitle[1];
      const labeledJournal = text.match(/(?:期刊名称|发表期刊|期刊|会议名称)[:：]\s*([^,，.。;；]+)/);
      journal = labeledJournal ? labeledJournal[1] : '';
    }

    title = cleanPaperTitle(title);
    if (!title || title.length < 4) return null;

    return {
      title,
      journal: clean(journal).replace(/^[.．。:：\s]+/, ''),
      publishDate: extractYearMonth(text),
      rank: extractRank(text, name),
      link: extractLink(text)
    };
  }

  function parsePapers(lines, sections, name) {
    const source = sections.paper && sections.paper.length
      ? sections.paper
      : lines.filter((line) => /\[(J|C|M|D|R|EB\/OL)\]/i.test(line) || /DOI|期刊|会议/i.test(line));
    const list = [];
    let current = null;

    const flush = () => {
      if (current && current.title && !current.__pushed) list.push(current);
      current = null;
    };

    for (const rawLine of source) {
      const line = clean(rawLine);
      if (!line) continue;
      if (line.length <= 12 && /^(论文发表|发表论文|学术论文|论文|学术成果|科研成果)$/.test(line)) continue;

      const titleLabel = line.match(/(?:论文名称|论文题目|论文标题|文章标题)[:：]\s*(.+)/);
      if (titleLabel) {
        flush();
        current = {
          title: cleanPaperTitle(titleLabel[1]), journal: '', publishDate: extractYearMonth(line),
          rank: extractRank(line, name), link: extractLink(line)
        };
        continue;
      }

      const journalLabel = line.match(/(?:期刊名称|发表期刊|发表刊物|期刊|会议名称)[:：]\s*(.+)/);
      if (journalLabel && current && !current.journal) {
        current.journal = clean(journalLabel[1]).split(/[，,;；]/)[0].trim();
        continue;
      }

      const dateLabel = line.match(/(?:发表时间|出版时间|发表年月)[:：]\s*(.+)/);
      if (dateLabel && current && !current.publishDate) {
        current.publishDate = extractYearMonth(dateLabel[1]);
        continue;
      }

      const rankLabel = line.match(/(?:作者排名|作者顺序|第几作者|作者位次)[:：]\s*(.+)/);
      if (rankLabel && current && !current.rank) {
        current.rank = clean(rankLabel[1]);
        continue;
      }

      const citation = parseCitation(line, name);
      if (!citation) {
        const linkLabel = line.match(/(?:论文链接|原文链接|文章链接|论文网址|doi)\s*[:：]\s*(\S+)/i);
        if (linkLabel && current && !current.link) {
          current.link = extractLink(linkLabel[0]) || clean(linkLabel[1]);
          continue;
        }

        // PDF 排版常把 DOI / URL 换到下一行
        if (current && !current.link) {
          const continuation = extractLink(line);
          if (continuation) {
            current.link = continuation;
            continue;
          }
        }
      } else {
        flush();
        list.push(citation);
        current = citation;
        current.__pushed = true;
      }
    }
    flush();
    list.forEach((paper) => { delete paper.__pushed; });

    return list
      .filter((paper) => paper.title && paper.title.length >= 4)
      .filter((paper, index, array) => array.findIndex((item) => item.title === paper.title) === index)
      .slice(0, 12);
  }

  function cleanHonorName(value) {
    return stripDates(value)
      .replace(/^\s*(?:[\d]+[.、)]|[-•·])\s*/, '')
      .replace(/^(获得|荣获|获|被评为|授予)\s*/, '')
      .replace(/[（(]\s*[)）]/g, '')
      .replace(/[，,;；]\s*$/, '')
      .trim();
  }

  function parseHonors(lines, sections) {
    const source = sections.honor && sections.honor.length
      ? sections.honor
      : lines.filter((line) => AWARD_WORD_RE.test(line));
    const list = [];

    for (const rawLine of source) {
      const line = clean(rawLine);
      if (!line || line.length > 100) continue;
      if (/^(荣誉奖励|荣誉奖项|获奖情况|获奖经历|所获荣誉|奖励荣誉|荣誉)$/.test(line)) continue;

      for (const part of line.split(/[;；]/).map((item) => item.trim()).filter(Boolean)) {
        const name = cleanHonorName(part);
        if (!name || name.length < 2 || name.length > 60) continue;
        if (!AWARD_WORD_RE.test(name)) continue;
        list.push({ name, awardDate: extractYearMonth(part) });
      }
    }

    return list
      .filter((honor) => honor.name)
      .filter((honor, index, array) => array.findIndex((item) => item.name === honor.name) === index)
      .slice(0, 15);
  }

  function parseSkills(sections, lines) {
    const source = sections.skills && sections.skills.length
      ? sections.skills
      : lines.filter((line) => /^(语言能力|技能|证书|软件技能|专业技能)[:：]/.test(line));
    if (!source.length) return { languages: '', certificates: '', software: '' };

    const out = { languages: '', certificates: '', software: '' };
    const append = (key, value) => {
      if (!value) return;
      out[key] = out[key] ? `${out[key]}；${value}` : value;
    };

    for (const rawLine of source) {
      const line = clean(rawLine).replace(/^(语言能力|技能证书|技能特长|专业技能|技能|证书|软件技能)[:：]\s*/, '');
      if (!line) continue;
      if (/(英语|日语|韩语|法语|德语|西班牙语|CET|雅思|托福|IELTS|TOEFL|语言)/i.test(line)) {
        append('languages', line);
      } else if (/(证书|资格|认证|等级考试|从业|执业)/.test(line)) {
        append('certificates', line);
      } else {
        append('software', line);
      }
    }
    return out;
  }

  function extractPosition(text) {
    const value = String(text || '');
    const labeled = value.match(/(?:实习岗位|岗位名称|职位名称|岗位|职位)[:：]\s*([^\s,，;；|/]{2,25})/);
    if (labeled) return labeled[1];
    const role = value.match(/([\u4e00-\u9fa5A-Za-z·]{2,20}(?:开发实习生|实习生|工程师|经理|助理|专员|设计师|研究员|产品经理|运营))/);
    return role ? role[1] : '';
  }

  function parseInternships(sections) {
    if (!sections.internship || !sections.internship.length) return [];
    const list = [];
    let current = null;

    for (const rawLine of sections.internship) {
      const line = clean(rawLine);
      if (!line) continue;
      const weak = !current && line.length <= 40 ? line.match(COMPANY_WEAK_RE) : null;
      const company = line.match(COMPANY_STRONG_RE) || weak;
      if (company && (!current || current.company)) {
        if (current) list.push(current);
        current = {
          company: company[1], department: '', position: extractPosition(line),
          startDate: '', endDate: '', city: '', description: '', achievements: ''
        };
        const range = line.match(DATE_RANGE_RE);
        if (range) {
          current.startDate = formatYearMonth(range[1], range[2]);
          current.endDate = formatYearMonth(range[3], range[4]);
        }
        continue;
      }
      if (!current) continue;
      if (!current.position) {
        const position = extractPosition(line);
        if (position) {
          current.position = position;
          continue;
        }
      }
      const range = line.match(DATE_RANGE_RE);
      if (range && !current.startDate) {
        current.startDate = formatYearMonth(range[1], range[2]);
        current.endDate = formatYearMonth(range[3], range[4]);
        continue;
      }
      current.description = clean(`${current.description} ${line}`).slice(0, 600);
    }
    if (current) list.push(current);

    return list
      .filter((record) => record.company)
      .filter((record, index, array) => array.findIndex((item) => item.company === record.company) === index)
      .slice(0, 6);
  }

  RF.parseResumeText = function parseResumeText(text) {
    const lines = toLines(text);
    if (!lines.length) {
      return { basic: {}, educations: [], internships: [], projects: [], papers: [], honors: [], skills: {}, meta: { lines: 0 } };
    }
    const sections = splitSections(lines);
    const basic = parseBasic(lines, sections, sections);
    const educations = parseEducation(lines, sections);
    const papers = parsePapers(lines, sections, basic.name);
    const honors = parseHonors(lines, sections);
    const skills = parseSkills(sections, lines);
    const internships = parseInternships(sections);

    return {
      basic,
      educations,
      internships,
      projects: [],
      papers,
      honors,
      skills,
      meta: {
        lines: lines.length,
        sections: Object.keys(sections).filter((key) => key !== 'header' && sections[key].length),
        counts: {
          educations: educations.length,
          papers: papers.length,
          honors: honors.length,
          internships: internships.length
        }
      }
    };
  };

  const LIST_IDENTITIES = {
    educations: (record) => [record.school, record.major].map((v) => clean(v).toLowerCase()).join('|'),
    internships: (record) => [record.company, record.position].map((v) => clean(v).toLowerCase()).join('|'),
    projects: (record) => clean(record.name).toLowerCase(),
    papers: (record) => clean(record.title).toLowerCase(),
    honors: (record) => clean(record.name).toLowerCase(),
    campus: (record) => [record.organization, record.role].map((v) => clean(v).toLowerCase()).join('|')
  };

  RF.mergeParsedProfile = function mergeParsedProfile(current, parsed, mode) {
    const base = RF.normalizeProfile(current);
    const incoming = RF.normalizeProfile(parsed || {});
    const overwrite = mode === 'overwrite';

    Object.keys(base.basic).forEach((key) => {
      const value = clean(incoming.basic[key]);
      if (!value) return;
      if (overwrite || !clean(base.basic[key])) base.basic[key] = value;
    });

    Object.entries(LIST_IDENTITIES).forEach(([group, identity]) => {
      const records = (incoming[group] || []).filter((record) => !RF.isEmptyRecord(record));
      if (!records.length) return;

      if (overwrite) {
        base[group] = records;
        return;
      }

      const existing = (base[group] || []).filter((record) => !RF.isEmptyRecord(record));
      records.forEach((record) => {
        const id = identity(record);
        const found = id ? existing.find((item) => identity(item) === id) : null;
        if (!found) {
          existing.push(record);
          return;
        }
        Object.keys(record).forEach((key) => {
          const value = clean(record[key]);
          if (value && !clean(found[key])) found[key] = value;
        });
      });
      base[group] = existing.length ? existing : base[group];
    });

    ['languages', 'certificates', 'software'].forEach((key) => {
      const value = clean(incoming.skills[key]);
      if (value && (overwrite || !clean(base.skills[key]))) base.skills[key] = value;
    });

    return RF.normalizeProfile(base);
  };
})(typeof window !== 'undefined' ? window : self);
