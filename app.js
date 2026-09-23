/* Class desk: plan a lesson, confirm it, copy the company text and the team sheet. */
const STORAGE_KEY = "class-desk-v1";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DAY_OFFSET = { mon: -5, tue: -4, wed: -3, thu: -2, fri: -1, sat: 0, sun: 1 };

const SLOTS = [
  { day: "sat", subject: "chem", start: "11:00", end: "12:00", room: "突破中心 6/F 6B" },
  { day: "sat", subject: "bio", start: "13:00", end: "14:00", room: "突破中心 6/F 6B" },
  { day: "sun", subject: "chem", start: "10:30", end: "11:30", room: "突破中心 6/F 6A" },
  { day: "sun", subject: "bio", start: "12:30", end: "13:30", room: "突破中心 6/F 6A" },
];

const MODES = ["concepts", "intro ex", "ex", "concepts + intro ex", "concepts + ex"];

const SEED_STUDENTS = [
  ["tulip", "王 梓晴", "Tulip", "TTC", "sat"],
  ["cheryl", "陳 愷妍", "Cheryl", "BPS", "sat"],
  ["nathan", "何 浚軒", "Nathan", "QES", "sat"],
  ["anson", "余 渭聰", "Anson", "SWC", "sat"],
  ["harley", "吳 皓軒", "Harley", "CWC", "sat"],
  ["donavon", "李 柏森", "Donavon", "SYS", "sat"],
  ["jason", "楊 晉", "Jason", "SPC", "sat"],
  ["vulcan", "王 楚烯", "Vulcan", "SPC", "sat"],
  ["angus", "顏 伽龍", "Angus", "SPC", "sat"],
  ["ednah", "葉 曦蔚", "Ednah", "YLM", "sun"],
  ["ethan", "劉 衍廷", "Ethan", "SSC", "sun"],
  ["kinson", "葉 城佑", "Kinson", "YWC", "sun"],
  ["lukas", "鄧 浩臣", "Lukas", "HKF", "sun"],
  ["cherry", "陳 敏嬋", "Cherry", "OLR", "sun"],
  ["kyle", "韓 永晉", "Kyle", "LFC", "sun"],
  ["cyrus", "馬 敬俊", "Cyrus", "WHC", "sun"],
].map(([id, chinese, english, school, day]) => ({
  id, chinese, english, school, form: "S3", day,
  active: true, remark: "", schoolTopic: "", syllabus: { chem: "", bio: "" }, tests: [],
}));

let state = blankState();
const ui = {
  picked: null,
  expandTopics: false,
  warnLesson: null,
  askQuit: null,
  editId: null,
  sylSubject: "chem",
  sylTab: "syll",
  sylDay: "all",
  sylGroup: "all",
  sylStudent: null,
  checked: {},
  bulkMode: "both",
  showGlance: false,
  moreStream: null,
  addDay: false,
  addExtra: false,
  findStudent: "",
  dash: "class",
  progressSem: "1",
  progressDay: "sat",
  progressExpand: false,
  hiddenGroups: {},
  calView: "week",
  calDate: "",
  roughSubject: "chem",
  roughSem: "1",
  reviewRemove: "",
};

function blankState() {
  return {
    version: 1,
    saturday: thisSaturday(new Date()),
    slots: [],
    students: SEED_STUDENTS.map((s) => ({ ...s, tests: [] })),
    lessons: {},
    contributions: [],
    manual: {},
    later: {},
    hand: {},
    handNote: "",
    terms: {},
    termPlan: {},
    termQueue: { chem: [], bio: [] },
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function thisSaturday(d) {
  const day = d.getDay();
  const delta = day === 0 ? -1 : 6 - day;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return iso(x);
}

function addDays(value, n) {
  const d = parseIso(value);
  d.setDate(d.getDate() + n);
  return iso(d);
}

function daysBetween(earlier, later) {
  const a = parseIso(earlier);
  const b = parseIso(later);
  return Math.round((b - a) / 86400000);
}

function weekday(value) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseIso(value).getDay()];
}

function prettyDate(value) {
  const d = parseIso(value);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${weekday(value)} ${d.getDate()} ${mon}`;
}

function clock(value) {
  return String(value || "").replace(":", "");
}

function stamp(date, start, end) {
  const d = parseIso(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day} (${weekday(date)}) ${clock(start)}-${clock(end)}`;
}

function modeWords(mode) {
  if (mode === "ex") return "exp ex";
  return mode || "concepts";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function displayName(s) {
  return `${s.chinese} ${s.english} (${s.school}) ${s.form}`;
}

function studentById(id) {
  return state.students.find((s) => s.id === id) || null;
}

function subjectLabel(subject) {
  return subject === "chem" ? "Chem" : "Bio";
}

function dayLabel(day) {
  return DAY_LABEL[day] || day;
}

function dateForDay(saturday, day) {
  return addDays(saturday, DAY_OFFSET[day] ?? 0);
}

function allSlots() {
  const map = new Map();
  for (const slot of SLOTS) map.set(`${slot.day}-${slot.subject}`, { ...slot });
  for (const slot of state.slots || []) {
    const key = `${slot.day}-${slot.subject}`;
    map.set(key, { ...(map.get(key) || {}), ...slot });
  }
  return DAY_ORDER.flatMap((day) => ["chem", "bio"].map((subject) => map.get(`${day}-${subject}`)).filter(Boolean));
}

function activeDays() {
  const days = new Set(allSlots().map((slot) => slot.day));
  return DAY_ORDER.filter((day) => days.has(day));
}

function listedDays() {
  const days = new Set(activeDays());
  state.students.forEach((student) => { if (student.day) days.add(student.day); });
  return DAY_ORDER.filter((day) => days.has(day));
}

function upsertSlot(day, subject, patch) {
  if (!state.slots) state.slots = [];
  let slot = state.slots.find((item) => item.day === day && item.subject === subject);
  if (!slot) {
    const base = SLOTS.find((item) => item.day === day && item.subject === subject) || {
      day, subject, start: "11:00", end: "12:00", room: "",
    };
    slot = { ...base, ...patch };
    state.slots.push(slot);
  } else {
    Object.assign(slot, patch);
  }
  return slot;
}

function blankStream() {
  return {
    id: uid(),
    teacher: "Jeffery",
    topicCodes: [],
    mode: "concepts + ex",
    extra: false,
    hw: false,
    hwCode: "",
    hwType: "",
    note: "",
    studentIds: [],
  };
}

function topicByCode(code) {
  return TOPICS.find((t) => t.code === code) || null;
}

function topicPhrase(codes) {
  return codes.map((code) => {
    const t = topicByCode(code);
    return t ? `${t.code}_${t.name}` : code;
  }).join(" + ");
}

function hwSuffix(stream) {
  if (!stream || !stream.hwCode || !stream.hwType) return "";
  const type = stream.hwType === "watch video" ? "watch video" : "intro ex";
  return `HW: ${topicPhrase([stream.hwCode])} (${type})`;
}

function sentence(stream) {
  if (!stream) return "";
  const teacher = String(stream.teacher || "Jeffery").replace(/[\[\]]/g, "").trim() || "Jeffery";
  const topics = stream.topicCodes.length ? topicPhrase(stream.topicCodes) : "";
  const mode = modeWords(stream.mode);
  const hw = hwSuffix(stream);
  if (!topics && !hw) return "";
  let body = "";
  if (topics && stream.extra) body = `Extra lesson: ${topics} (${mode})`;
  else if (topics) body = `${topics} (${mode})`;
  if (hw) body = body ? `${body} ${hw}` : hw;
  let line = `[${teacher}] ${body}`;
  const note = String(stream.note || "").trim();
  if (note) {
    const gap = /[.!?]$/.test(line) || /^[.!?]/.test(note) ? " " : ". ";
    line += gap + note;
  }
  return line;
}

function chipToMark(mode) {
  if (mode === "concepts") return "concepts";
  if (mode === "intro ex" || mode === "ex") return "ex";
  if (mode === "concepts + intro ex" || mode === "concepts + ex") return "both";
  return "concepts";
}

function modeParts(mode) {
  return {
    concepts: mode === "concepts" || mode === "concepts + intro ex" || mode === "concepts + ex",
    intro: mode === "intro ex" || mode === "concepts + intro ex",
    exp: mode === "ex" || mode === "concepts + ex",
  };
}

function mergeParts(prev, next) {
  const base = prev || { concepts: false, intro: false, exp: false };
  return {
    concepts: base.concepts || !!next.concepts,
    intro: base.intro || !!next.intro,
    exp: base.exp || !!next.exp,
  };
}

function teachingDone(subject, parts) {
  if (!parts) return false;
  if (subject === "bio") return !!(parts.concepts && parts.intro && parts.exp);
  return !!(parts.concepts && parts.exp);
}

function laterKind(subject) {
  return subject === "bio" ? "sum" : "publisher";
}

function laterLabel(subject) {
  return subject === "bio" ? "Sum ex" : "Publisher ex";
}

function laterOf(studentId, code) {
  const bag = state.later && state.later[studentId];
  return bag ? bag[code] || "" : "";
}

const HAND_BOXES = ["concepts", "intro", "exp"];

function handFlags(studentId, code) {
  const row = state.hand && state.hand[studentId] && state.hand[studentId][code];
  return row || {};
}

function refreshHandNote() {
  const ids = [];
  const hand = state.hand || {};
  Object.keys(hand).sort().forEach((studentId) => {
    const codes = hand[studentId] || {};
    Object.keys(codes).sort().forEach((code) => {
      HAND_BOXES.forEach((box) => {
        if (codes[code][box]) ids.push(`${studentId}:${code}:${box}`);
      });
    });
  });
  const later = state.later || {};
  Object.keys(later).sort().forEach((studentId) => {
    const codes = later[studentId] || {};
    Object.keys(codes).sort().forEach((code) => {
      if (codes[code]) ids.push(`${studentId}:${code}:${codes[code]}`);
    });
  });
  state.handNote = ids.length ? `Manual progress boxes: ${ids.join(", ")}` : "";
}

function setHandBox(studentId, code, box, on) {
  if (!state.hand) state.hand = {};
  if (!state.hand[studentId]) state.hand[studentId] = {};
  if (!state.hand[studentId][code]) state.hand[studentId][code] = {};
  if (on) state.hand[studentId][code][box] = true;
  else delete state.hand[studentId][code][box];
  if (!Object.keys(state.hand[studentId][code]).length) delete state.hand[studentId][code];
  if (!Object.keys(state.hand[studentId]).length) delete state.hand[studentId];
  refreshHandNote();
}

function lessonModes(subject) {
  if (subject === "chem") return ["concepts", "ex", "concepts + ex"];
  return MODES;
}

function fold(list) {
  let concepts = false;
  let ex = false;
  let both = false;
  for (const mark of list) {
    if (mark === "both") both = true;
    if (mark === "concepts") concepts = true;
    if (mark === "ex") ex = true;
  }
  if (both || (concepts && ex)) return "both";
  if (concepts) return "concepts";
  if (ex) return "ex";
  return "";
}

function isAbs(lesson, studentId) {
  return lesson.attendance?.[studentId] === "abs";
}

function enrolled(student, date) {
  if (!student || student.active === false) return false;
  if (!student.joined) return true;
  return student.joined <= date;
}

function isTrial(lesson, studentId) {
  return Array.isArray(lesson.trials) && lesson.trials.includes(studentId);
}

function withTrial(line, lesson, studentId) {
  if (!line || line === "ABS" || !isTrial(lesson, studentId) || line.includes("試堂")) return line;
  return /[.!?]$/.test(line) ? `${line} 試堂` : `${line}. 試堂`;
}

function dayStudents(lesson) {
  return state.students.filter((s) => s.active && s.day === lesson.day && enrolled(s, lesson.date));
}

function roster(lesson) {
  if (lesson.confirmed && Array.isArray(lesson.rosterIds)) {
    return lesson.rosterIds.map(studentById).filter(Boolean);
  }
  if (lesson.extra) {
    const ids = lesson.streams.flatMap((stream) => stream.studentIds);
    return [...new Set(ids)].map(studentById).filter(Boolean);
  }
  return dayStudents(lesson);
}

function liveMark(lesson, studentId, code) {
  if (isAbs(lesson, studentId)) return "";
  const stream = lesson.streams.find((s) => s.studentIds.includes(studentId) && s.topicCodes.includes(code));
  if (!stream) return "";
  const chip = chipToMark(stream.mode);
  return chip;
}

function manualOf(studentId, code) {
  const bag = state.manual[studentId];
  if (!bag || !Object.prototype.hasOwnProperty.call(bag, code)) return undefined;
  return bag[code];
}

function setManual(studentId, code, mark) {
  if (!state.manual[studentId]) state.manual[studentId] = {};
  state.manual[studentId][code] = mark;
}

function displayMark(studentId, code, exceptLessonId) {
  const manual = manualOf(studentId, code);
  if (manual !== undefined) return manual;
  const modes = state.contributions
    .filter((c) => c.studentId === studentId && c.code === code && c.lessonId !== exceptLessonId)
    .map((c) => c.mode);
  return fold(modes);
}

function excelMark(studentId, code, lesson) {
  const live = liveMark(lesson, studentId, code);
  if (live) {
    const others = state.contributions
      .filter((c) => c.studentId === studentId && c.code === code && c.lessonId !== lesson.id)
      .map((c) => c.mode);
    return fold([...others, live]);
  }
  return displayMark(studentId, code);
}

function ensureSyllabus(student) {
  if (!student.syllabus || typeof student.syllabus !== "object") {
    student.syllabus = { chem: [], bio: [] };
    if (student.schoolTopic) student.syllabus.chem = student.schoolTopic;
  }
  if (student.syllabus.chem == null) student.syllabus.chem = [];
  if (student.syllabus.bio == null) student.syllabus.bio = [];
  if (!student.gates || typeof student.gates !== "object") student.gates = { chem: {}, bio: {} };
  if (!student.gates.chem || typeof student.gates.chem !== "object") student.gates.chem = {};
  if (!student.gates.bio || typeof student.gates.bio !== "object") student.gates.bio = {};
  if (!student.semesters || typeof student.semesters !== "object") student.semesters = { chem: {}, bio: {} };
  if (!student.semesters.chem || typeof student.semesters.chem !== "object") student.semesters.chem = {};
  if (!student.semesters.bio || typeof student.semesters.bio !== "object") student.semesters.bio = {};
  return student.syllabus;
}

function syllabusCodesOf(student, subject) {
  const bag = ensureSyllabus(student);
  const key = subject === "bio" ? "bio" : "chem";
  const value = bag[key];
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  const parts = text ? text.split(/\s+/) : [];
  const codes = parts.filter((part) => {
    const topic = topicByCode(part);
    return topic && topic.subject === key;
  });
  if (text && codes.length !== parts.length) student.schoolTopic = student.schoolTopic || text;
  bag[key] = codes;
  return bag[key];
}

function schoolSyllabus(student, subject) {
  const codes = syllabusCodesOf(student, subject);
  if (codes.length) return codes.join(" ");
  return subject === "chem" ? (student.schoolTopic || "") : "";
}

function gateOf(student, subject, code) {
  ensureSyllabus(student);
  const key = subject === "bio" ? "bio" : "chem";
  return (student.gates[key] && student.gates[key][code]) || "";
}

function gateLabel(id) {
  const gate = SYLLABUS_GATES.find((item) => item.id === id);
  return gate ? gate.label : "";
}

function didWhat(lesson, student) {
  if (isAbs(lesson, student.id)) return "ABS";
  const stream = (lesson.streams || []).find((s) => s.studentIds.includes(student.id));
  return stream ? withTrial(sentence(stream), lesson, student.id) : "";
}

function lessonsTouching(student, subject) {
  return Object.values(state.lessons)
    .filter((l) => l.confirmed && (l.rosterIds || []).includes(student.id) && (!subject || l.subject === subject))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
}

function previousLesson(student, lesson) {
  return lessonsTouching(student, lesson.subject).find((l) => l.id !== lesson.id && l.date < lesson.date) || null;
}

function lastTaught(student, lesson) {
  return lessonsTouching(student, lesson.subject).find((l) => (
    l.id !== lesson.id && l.date < lesson.date && !isAbs(l, student.id) && didWhat(l, student) && didWhat(l, student) !== "ABS"
  )) || null;
}

function historyBits(student, lesson) {
  const prev = previousLesson(student, lesson);
  const taught = lastTaught(student, lesson);
  let progress = "—";
  if (prev) {
    progress = didWhat(prev, student) || "—";
    if (isAbs(prev, student.id) && taught) {
      const earlier = didWhat(taught, student);
      if (earlier) progress = `ABS\nLast taught: ${earlier}`;
    }
  }
  return {
    lastWhen: prev ? stamp(prev.date, prev.start, prev.end) : "—",
    lastWhenExcel: prev ? stamp(prev.date, prev.start, prev.end) : "",
    progress,
    attendance: prev ? (isAbs(prev, student.id) ? "ABS" : "Present") : "—",
    days: prev ? String(daysBetween(prev.date, lesson.date)) : "",
  };
}

function scheduledTests(student, subject) {
  const key = subject === "bio" ? "bio" : "chem";
  return SYLLABUS_GATES.map((gate) => {
    const saved = (student.tests || []).find((test) => test.kind === gate.id && (test.subject || key) === key && test.date);
    const codes = syllabusCodesOf(student, key).filter((code) => gateOf(student, key, code) === gate.id);
    return { kind: gate.id, label: gate.short, date: saved ? saved.date : "", codes, subject: key };
  });
}

function nextTest(student, onDate) {
  const scheduled = ["chem", "bio"].flatMap((subject) => scheduledTests(student, subject))
    .filter((item) => item.date && item.date >= onDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (scheduled.length) return scheduled[0];
  return (student.tests || [])
    .filter((test) => test.date && test.date >= onDate && test.code && !test.kind)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function formatTest(test) {
  if (!test) return "";
  if (test.kind) {
    const when = test.date ? `${test.date.slice(5, 7)}/${test.date.slice(8, 10)}` : "";
    const codes = test.codes || [];
    const range = !codes.length ? "" : codes.length === 1 ? codes[0] : `${codes[0]}–${codes[codes.length - 1]}`;
    const name = test.label || gateLabel(test.kind);
    return [name, when, range].filter(Boolean).join(" ");
  }
  const [, m, d] = test.date.split("-");
  const topic = topicByCode(test.code);
  const label = topic ? `${topic.code}_${topic.name}` : test.code;
  return `${m}/${d} ${label}`;
}

function pinnedTopics(subject) {
  if (subject === "chem") {
    return TOPICS.filter((t) => t.subject === "chem" && (t.level === "S3" || t.group.startsWith("Metal") || t.group.startsWith("AB")));
  }
  return TOPICS.filter((t) => t.subject === "bio" && String(t.group).startsWith("BB"));
}

function syllabusTopicGroups(subject) {
  const seen = new Set(pinnedTopics(subject).map((topic) => topic.code));
  const extra = [];
  state.students.forEach((student) => {
    syllabusCodesOf(student, subject).forEach((code) => {
      if (seen.has(code)) return;
      const topic = topicByCode(code);
      if (!topic || topic.subject !== subject) return;
      seen.add(code);
      extra.push(topic);
    });
  });
  const groups = [];
  pinnedTopics(subject).concat(extra).forEach((topic) => {
    let group = groups.find((item) => item.group === topic.group);
    if (!group) {
      group = { group: topic.group, name: topic.groupName, topics: [] };
      groups.push(group);
    }
    group.topics.push(topic);
  });
  return groups;
}

function topicGroups(subject) {
  const groups = [];
  pinnedTopics(subject).forEach((topic) => {
    let group = groups.find((item) => item.group === topic.group);
    if (!group) {
      group = { group: topic.group, name: topic.groupName, topics: [] };
      groups.push(group);
    }
    group.topics.push(topic);
  });
  return groups;
}

function semesterOfGroup(subject, group) {
  if (subject === "bio") return ["BB01", "BB02", "BB03"].includes(group) ? "1" : "2";
  return String(group).startsWith("Earth") ? "1" : "2";
}

function topicSemester(student, subject, code) {
  ensureSyllabus(student);
  const key = subject === "bio" ? "bio" : "chem";
  const saved = student.semesters[key][code];
  if (saved === "1" || saved === "2") return saved;
  const gate = gateOf(student, subject, code);
  if (String(gate).startsWith("s1")) return "1";
  if (String(gate).startsWith("s2")) return "2";
  const topic = topicByCode(code);
  return topic ? semesterOfGroup(subject, topic.group) : "1";
}

function setTopicSemester(student, subject, code, sem) {
  ensureSyllabus(student);
  const key = subject === "bio" ? "bio" : "chem";
  if (sem === "1" || sem === "2") student.semesters[key][code] = sem;
  else delete student.semesters[key][code];
}

const SYLLABUS_GATES = [
  { id: "s1ut", label: "Before Sem 1 UT", short: "S1 UT" },
  { id: "s1exam", label: "Before Sem 1 exam", short: "S1 exam" },
  { id: "s2ut", label: "Before Sem 2 UT", short: "S2 UT" },
  { id: "s2exam", label: "Before Sem 2 exam", short: "S2 exam" },
];

function topicSpan(subject, from, to) {
  const list = pinnedTopics(subject).map((topic) => topic.code);
  const a = list.indexOf(from);
  const b = list.indexOf(to);
  if (a < 0 || b < 0) return [];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return list.slice(start, end + 1);
}

function sharedTestDate(people, subject, kind) {
  const dates = people.map((student) => {
    const hit = (student.tests || []).find((test) => test.kind === kind && (test.subject || subject) === subject && test.date);
    return hit ? hit.date : "";
  });
  const unique = [...new Set(dates)];
  if (unique.length !== 1) return { date: "", mixed: true };
  return { date: unique[0], mixed: false };
}

function sharedTestRange(people, subject, kind) {
  const spans = people.map((student) => {
    const codes = syllabusCodesOf(student, subject).filter((code) => gateOf(student, subject, code) === kind);
    return codes.length ? `${codes[0]}|${codes[codes.length - 1]}` : "";
  });
  const unique = [...new Set(spans)];
  if (unique.length !== 1) return { from: "", to: "", mixed: true, label: "Different ranges" };
  const [from, to] = unique[0].split("|");
  if (!from) return { from: "", to: "", mixed: false, label: "No range" };
  return { from, to, mixed: false, label: from === to ? from : `${from}–${to}` };
}

function setTestDate(people, subject, kind, date) {
  people.forEach((student) => {
    if (!Array.isArray(student.tests)) student.tests = [];
    student.tests = student.tests.filter((test) => !(test.kind === kind && (test.subject || subject) === subject));
    if (date) student.tests.push({ id: uid(), subject, kind, date });
  });
}

function applyTestRange(people, subject, kind, from, to) {
  const span = topicSpan(subject, from, to);
  const key = subject === "bio" ? "bio" : "chem";
  const order = pinnedTopics(subject).map((topic) => topic.code);
  people.forEach((student) => {
    ensureSyllabus(student);
    const codes = syllabusCodesOf(student, subject);
    const map = student.gates[key];
    codes.slice().forEach((code) => {
      if (map[code] === kind && !span.includes(code)) {
        delete map[code];
        const index = codes.indexOf(code);
        if (index >= 0) codes.splice(index, 1);
      }
    });
    span.forEach((code) => {
      if (!codes.includes(code)) codes.push(code);
      map[code] = kind;
    });
    codes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  });
}

function clearTestRange(people, subject, kind) {
  const key = subject === "bio" ? "bio" : "chem";
  people.forEach((student) => {
    ensureSyllabus(student);
    const codes = syllabusCodesOf(student, subject);
    const map = student.gates[key];
    codes.slice().forEach((code) => {
      if (map[code] !== kind) return;
      delete map[code];
      const index = codes.indexOf(code);
      if (index >= 0) codes.splice(index, 1);
    });
  });
}

function searchTopics(subject, query) {
  const q = query.trim().toLowerCase();
  const base = ui.expandTopics
    ? TOPICS.filter((t) => t.subject === subject)
    : pinnedTopics(subject);
  if (!q) return base.slice(0, 8);
  const hit = (list) => list.filter((t) => (
    t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.groupName.toLowerCase().includes(q)
  ));
  const pinnedHits = hit(base);
  if (pinnedHits.length) return pinnedHits.slice(0, 8);
  return hit(TOPICS.filter((t) => t.subject === subject)).slice(0, 8);
}

function resolveCode(raw) {
  const text = raw.trim();
  if (!text) return null;
  const token = text.split(/\s+/)[0];
  const exact = TOPICS.find((t) => t.code.toLowerCase() === token.toLowerCase() || t.code.toLowerCase() === text.toLowerCase());
  if (exact) return exact.code;
  const hits = TOPICS.filter((t) => t.code.toLowerCase().startsWith(token.toLowerCase()));
  return hits.length === 1 ? hits[0].code : null;
}

function addMinutes(value, mins) {
  const [h, m] = String(value || "15:00").split(":").map(Number);
  const total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function createExtraLesson(day, subject) {
  const date = dateForDay(state.saturday, day);
  const sameDay = allSlots().filter((slot) => slot.day === day);
  const match = sameDay.find((slot) => slot.subject === subject) || sameDay[0];
  const start = match ? match.end : "15:00";
  const stream = blankStream();
  stream.extra = true;
  const id = `${date}-${subject}-extra-${uid()}`;
  state.lessons[id] = {
    id,
    date,
    day,
    subject,
    start,
    end: addMinutes(start, 60),
    room: match ? match.room : "",
    extra: true,
    confirmed: false,
    stale: false,
    streams: [stream],
    attendance: {},
    rosterIds: null,
    confirmedAt: null,
  };
  return state.lessons[id];
}

function weekExtraLessons(saturday, day) {
  const date = dateForDay(saturday, day);
  return Object.values(state.lessons)
    .filter((lesson) => lesson.extra && lesson.date === date)
    .sort((a, b) => a.start.localeCompare(b.start) || a.subject.localeCompare(b.subject));
}

function ensureLesson(slot, date) {
  const id = `${date}-${slot.subject}`;
  if (!state.lessons[id]) {
    state.lessons[id] = {
      id,
      date,
      day: slot.day,
      subject: slot.subject,
      start: slot.start,
      end: slot.end,
      room: slot.room,
      confirmed: false,
      stale: false,
      streams: [blankStream()],
      attendance: {},
      rosterIds: null,
      confirmedAt: null,
    };
    persist();
  }
  return state.lessons[id];
}

function weekLessons(saturday) {
  return allSlots().map((slot) => ensureLesson(slot, dateForDay(saturday, slot.day)));
}

function lessonStatus(lesson) {
  if (lesson.confirmed && lesson.stale) return { key: "stale", label: "Edited since save" };
  if (lesson.confirmed) return { key: "saved", label: "Saved" };
  const started = lesson.streams.some((s) => s.topicCodes.length || s.studentIds.length || String(s.note || "").trim());
  if (started || Object.keys(lesson.attendance || {}).length) return { key: "draft", label: "Draft" };
  return { key: "", label: "Not started" };
}

function problems(lesson) {
  const people = roster(lesson);
  const blocking = [];
  for (const stream of lesson.streams) {
    const n = stream.studentIds.filter((id) => people.some((p) => p.id === id) && !isAbs(lesson, id)).length;
    if (n && !stream.topicCodes.length) blocking.push("A stream has students but no topic.");
  }
  const placed = new Set(lesson.streams.flatMap((s) => s.studentIds));
  const unassigned = people.filter((s) => !isAbs(lesson, s.id) && !placed.has(s.id));
  return { blocking, unassigned };
}

const ADMIN_HEADER = ["Name list", "Date", "Did what"];

function excelCell(value) {
  const text = String(value ?? "").replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

function adminCells(row) {
  return [excelCell(row.name), excelCell(row.dateLabel), excelCell(row.did)];
}

function savedChip(subject, mode) {
  if (mode === "both") return subject === "bio" ? "concepts + intro ex" : "concepts + ex";
  if (mode === "ex") return "ex";
  return "concepts";
}

function savedSentence(lesson, studentId) {
  const items = (state.contributions || []).filter((item) => item.lessonId === lesson.id && item.studentId === studentId);
  if (!items.length) return "";
  const modes = [...new Set(items.map((item) => item.mode))];
  return sentence({
    teacher: (lesson.streams[0] && lesson.streams[0].teacher) || "Jeffery",
    topicCodes: items.map((item) => item.code),
    mode: modes.length === 1 ? savedChip(lesson.subject, modes[0]) : "concepts + ex",
    extra: !!lesson.extra,
    hwCode: "",
    hwType: "",
    note: "",
  });
}

function streamHasTeaching(lesson) {
  return (lesson.streams || []).some((stream) => (stream.topicCodes || []).length || (stream.hwCode && stream.hwType));
}

function recordSentence(lesson, student) {
  if (lesson.stale && !streamHasTeaching(lesson)) return isAbs(lesson, student.id) ? "ABS" : "";
  if (!lesson.stale) {
    const live = didWhat(lesson, student);
    if (live) return live;
  }
  const saved = savedSentence(lesson, student.id);
  if (saved) return withTrial(saved, lesson, student.id);
  return isAbs(lesson, student.id) ? "ABS" : "";
}

function wipeTeaching(lesson, commit) {
  lesson.streams.forEach((stream) => {
    stream.topicCodes = [];
    stream.hw = false;
    stream.hwCode = "";
    stream.hwType = "";
    stream.note = "";
  });
  state.contributions = (state.contributions || []).filter((item) => item.lessonId !== lesson.id);
  if (commit) {
    lesson.stale = false;
    persist();
    return;
  }
  touch(lesson);
}

function studentRecordRows(student, subject) {
  return lessonsTouching(student, subject).slice().reverse().flatMap((lesson) => {
    const did = recordSentence(lesson, student);
    if (!did) return [];
    return [{ name: displayName(student), dateLabel: stamp(lesson.date, lesson.start, lesson.end), did }];
  });
}

function recordsTsv(students, subject) {
  const lines = [ADMIN_HEADER.join("\t")];
  students.forEach((student) => {
    studentRecordRows(student, subject).forEach((row) => lines.push(adminCells(row).join("\t")));
  });
  return lines.join("\n");
}

function buildOutputs(lesson) {
  const people = roster(lesson);
  const dateLabel = stamp(lesson.date, lesson.start, lesson.end);
  const rows = people.map((student) => {
    const abs = isAbs(lesson, student.id);
    const stream = lesson.streams.find((s) => s.studentIds.includes(student.id)) || null;
    const did = abs ? "ABS" : stream ? sentence(stream) : "";
    const hist = historyBits(student, lesson);
    return {
      student,
      abs,
      stream,
      did,
      name: displayName(student),
      lastLesson: hist.lastWhenExcel,
      days: hist.days,
      test: formatTest(nextTest(student, lesson.date)),
      syll: schoolSyllabus(student, lesson.subject),
      remark: abs ? "ABS" : (student.remark || ""),
      schoolTopic: schoolSyllabus(student, lesson.subject),
      dateLabel,
    };
  });

  const presentSentences = [];
  const mainSentences = [];
  for (const stream of lesson.streams) {
    const line = sentence(stream);
    if (!line) continue;
    const hasPresent = stream.studentIds.some((id) => people.some((p) => p.id === id) && !isAbs(lesson, id));
    if (!hasPresent) continue;
    if (!presentSentences.includes(line)) presentSentences.push(line);
    if (!stream.extra && !mainSentences.includes(line)) mainSentences.push(line);
  }
  const classLines = mainSentences.length ? mainSentences : presentSentences;
  const classText = classLines.join("\n");
  const first = classLines[0] || "";
  const individuals = [];
  for (const row of rows) {
    if (row.abs) {
      individuals.push({ name: row.name, text: "ABS", studentId: row.student.id });
      continue;
    }
    if (!row.did) continue;
    const special = !!(row.stream && row.stream.extra);
    if (special || row.did !== first) individuals.push({ name: row.name, text: row.did, studentId: row.student.id });
  }
  const header = ADMIN_HEADER;
  const tsv = [header, ...rows.map((r) => adminCells(r))].map((cols) => cols.join("\t")).join("\n");
  return { rows, classText, individuals, tsv, header, dateLabel };
}

function touch(lesson) {
  if (lesson.confirmed) lesson.stale = true;
  persist();
}

function placeStudent(lesson, studentId, streamId) {
  for (const stream of lesson.streams) {
    stream.studentIds = stream.studentIds.filter((id) => id !== studentId);
  }
  if (streamId) {
    const stream = lesson.streams.find((s) => s.id === streamId);
    if (stream && !stream.studentIds.includes(studentId)) stream.studentIds.push(studentId);
    delete lesson.attendance[studentId];
  }
  touch(lesson);
}

function commitLesson(lesson) {
  const people = roster(lesson);
  state.contributions = state.contributions.filter((c) => c.lessonId !== lesson.id);
  for (const student of people) {
    if (isAbs(lesson, student.id)) continue;
    const stream = lesson.streams.find((s) => s.studentIds.includes(student.id));
    if (!stream) continue;
    for (const code of stream.topicCodes) {
      const mode = liveMark(lesson, student.id, code);
      if (!mode) continue;
      state.contributions.push({ lessonId: lesson.id, studentId: student.id, code, mode });
      if (state.manual[student.id]) delete state.manual[student.id][code];
    }
  }
  lesson.rosterIds = people.map((s) => s.id);
  lesson.confirmed = true;
  lesson.stale = false;
  lesson.confirmedAt = new Date().toISOString();
  ui.warnLesson = null;
  persist();
}

function dataBlob() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    saturday: state.saturday,
    slots: state.slots || [],
    students: state.students,
    lessons: state.lessons,
    contributions: state.contributions,
    manual: state.manual,
    later: state.later || {},
    hand: state.hand || {},
    handNote: state.handNote || "",
    terms: state.terms || {},
    termPlan: state.termPlan || {},
    termQueue: state.termQueue || { chem: [], bio: [] },
  };
}

function stateFromData(data) {
  return {
    version: 1,
    saturday: data.saturday || thisSaturday(new Date()),
    slots: Array.isArray(data.slots) ? data.slots : [],
    students: data.students.map((student) => { ensureSyllabus(student); return student; }),
    lessons: data.lessons || {},
    contributions: data.contributions || [],
    manual: data.manual || {},
    later: data.later || {},
    hand: data.hand || {},
    handNote: data.handNote || "",
    terms: data.terms || {},
    termPlan: data.termPlan || {},
    termQueue: data.termQueue || { chem: [], bio: [] },
  };
}

function persist() {
  const blob = dataBlob();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch (err) {
    toast("Could not save in this browser.");
  }
  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blob),
  }).catch(() => {});
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.students) || !data.students.length) return false;
    state = stateFromData(data);
    return true;
  } catch (err) {
    state = blankState();
    return false;
  }
}

async function restoreFromDisk(hadLocal) {
  let data = null;
  try {
    const res = await fetch("backup.json", { cache: "no-store" });
    if (res.ok) data = await res.json();
  } catch (err) {
    data = null;
  }
  const fileOk = data && Array.isArray(data.students) && data.students.length;
  if (!fileOk) {
    if (hadLocal) persist();
    return false;
  }
  let localAt = "";
  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    localAt = local && local.savedAt || "";
  } catch (err) {
    localAt = "";
  }
  if (!hadLocal || (data.savedAt && (!localAt || data.savedAt > localAt))) {
    state = stateFromData(data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      /* the file copy is still there */
    }
    return !hadLocal;
  }
  persist();
  return false;
}

function parseHash() {
  const raw = (location.hash || "#week").replace(/^#/, "");
  const [page, arg] = raw.split("/");
  return { page: page || "week", arg: arg ? decodeURIComponent(arg) : "" };
}

function lessonFromHash() {
  const { page, arg } = parseHash();
  if (page !== "lesson") return null;
  return state.lessons[arg] || null;
}

function draw({ keepScroll = true } = {}) {
  const y = keepScroll ? window.scrollY : 0;
  document.getElementById("app").innerHTML = render();
  window.scrollTo(0, y);
  const preview = document.getElementById("name-preview");
  if (preview) updateNamePreview();
}

function render() {
  const { page } = parseHash();
  const body = page === "lesson" ? renderLesson()
    : page === "overview" ? renderOverview()
    : page === "review" ? renderReview()
    : page === "progress" ? renderProgress()
    : page === "syllabus" ? renderSyllabus()
    : page === "students" ? renderStudents()
    : page === "backup" ? renderBackup()
    : renderWeek();
  const printable = ui.printTarget === "week" || (page === "week" && (ui.calView === "week" || !ui.calView))
    ? renderWeekPrint()
    : page === "overview" ? renderOverviewPrint()
    : page === "review" ? renderReviewPrint()
    : page === "lesson" ? renderPrint()
    : page === "progress" ? renderProgressPrint()
    : page === "syllabus" ? renderSyllabusPrint()
    : (page === "week" && ui.calView === "sem" ? renderSemPrint() : "");
  return `<div class="no-print">${renderNav(page)}${body}</div>${printable}`;
}

function renderNav(page) {
  const links = [
    ["week", "Timetable"],
    ["review/sat-chem-1", "Review"],
    ["syllabus", "School syllabus"],
    ["progress", "Progress"],
    ["students", "Names"],
  ];
  const on = page === "backup" ? "students" : page === "review" ? "review/sat-chem-1" : page;
  return `<header class="topbar">
    <div class="brand">Class desk</div>
    <nav class="nav">${links.map(([id, label]) => `<a href="#${id}" class="${on === id ? "on" : ""}">${label}</a>`).join("")}</nav>
  </header>`;
}

function shortPlan(lesson) {
  const lines = lesson.streams.map((stream) => {
    if (!stream.topicCodes.length) return "";
    return `${topicPhrase(stream.topicCodes)} (${stream.mode || "concepts"})`;
  }).filter(Boolean);
  return lines.join(" · ") || "Not planned";
}

function renderTimetable(activeId, saturday) {
  const weekStart = saturday || state.saturday;
  const days = activeDays();
  const byKey = {};
  weekLessons(weekStart).forEach((lesson) => {
    byKey[`${lesson.day}-${lesson.subject}`] = lesson;
  });
  const cell = (lesson, extra) => {
    if (!lesson) return `<div class="tt-cell empty"></div>`;
    const people = roster(lesson);
    const names = people.map((student) => `<span class="${isAbs(lesson, student.id) ? "abs" : ""}">${esc(student.english)}${isTrial(lesson, student.id) ? " 試堂" : ""}</span>`).join("");
    return `<a class="tt-cell ${extra ? "extra" : ""} ${lesson.id === activeId ? "on" : ""}" href="#lesson/${encodeURIComponent(lesson.id)}">
      <div class="time">${extra ? `Extra · ${esc(subjectLabel(lesson.subject))} ` : ""}${esc(lesson.start)}–${esc(lesson.end)}</div>
      <div class="meta">${esc(lesson.room)}</div>
      <div class="plan">${esc(shortPlan(lesson))}</div>
      <div class="tt-names">${names || (extra ? `<span class="meta">No students yet</span>` : "")}</div>
    </a>`;
  };
  const head = days.map((day) => `<div class="tt-day">${esc(dayLabel(day))}<div class="meta">${esc(prettyDate(dateForDay(weekStart, day)))}</div></div>`).join("");
  const row = (subject, label) => `<div class="tt-label">${label}</div>${days.map((day) => cell(byKey[`${day}-${subject}`], false)).join("")}`;
  const anyExtra = days.some((day) => weekExtraLessons(weekStart, day).length);
  const extraRow = anyExtra ? `<div class="tt-label">Extra</div>${days.map((day) => {
    const extras = weekExtraLessons(weekStart, day);
    if (!extras.length) return `<div class="tt-cell empty"></div>`;
    return `<div class="tt-stack">${extras.map((lesson) => cell(lesson, true)).join("")}</div>`;
  }).join("")}` : "";
  return `<div class="tt-scroll"><div class="timetable" style="--days:${days.length}">
    <div class="tt-corner"></div>
    ${head}
    ${row("chem", "Chem")}
    ${row("bio", "Bio")}
    ${extraRow}
  </div></div>`;
}

function renderAddDay() {
  const taken = new Set(activeDays());
  const open = DAY_ORDER.filter((day) => !taken.has(day));
  const extra = activeDays().filter((day) => !SLOTS.some((slot) => slot.day === day));
  const remove = extra.map((day) => `<button type="button" class="btn small" data-action="remove-day" data-day="${day}">Remove ${esc(dayLabel(day))}</button>`).join("");
  if (!open.length) return `${remove}${renderAddExtra()}`;
  if (!ui.addDay) return `${remove}<button class="btn" type="button" data-action="show-add-day">Add a day</button>${renderAddExtra()}`;
  return `${remove}<form id="add-day-form" class="row">
    <select class="bare" name="day">${open.map((day) => `<option value="${day}">${esc(dayLabel(day))}</option>`).join("")}</select>
    <button class="btn primary" type="submit">Add</button>
    <button class="btn" type="button" data-action="hide-add-day">Cancel</button>
  </form>${renderAddExtra()}`;
}

function renderAddExtra() {
  const days = activeDays();
  if (!days.length) return "";
  if (!ui.addExtra) return `<button class="btn" type="button" data-action="show-add-extra">Add extra lesson</button>`;
  return `<form id="add-extra-form" class="row">
    <select class="bare" name="day">${days.map((day) => `<option value="${day}">${esc(dayLabel(day))}</option>`).join("")}</select>
    <select class="bare" name="subject">
      <option value="chem">Chem</option>
      <option value="bio">Bio</option>
    </select>
    <button class="btn primary" type="submit">Add</button>
    <button class="btn" type="button" data-action="hide-add-extra">Cancel</button>
  </form>`;
}

function weekdayKey(date) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][parseIso(date).getDay()];
}

function calendarAnchor() {
  return ui.calDate || state.saturday;
}

function monthTitle(date) {
  const d = parseIso(date);
  const mon = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()];
  return `${mon} ${d.getFullYear()}`;
}

function weekRangeLabel(saturday) {
  return `${prettyDate(dateForDay(saturday, "mon"))} – ${prettyDate(dateForDay(saturday, "sun"))}`;
}

function slotsOnDate(date) {
  const day = weekdayKey(date);
  return allSlots().filter((slot) => slot.day === day);
}

function extrasOnDate(date) {
  return Object.values(state.lessons)
    .filter((lesson) => lesson.extra && lesson.date === date)
    .sort((a, b) => a.start.localeCompare(b.start) || a.subject.localeCompare(b.subject));
}

function lessonOnDate(date, subject) {
  return state.lessons[`${date}-${subject}`] || null;
}

function monthCells(anchor) {
  const d = parseIso(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(iso(cur));
  }
  while (cells.length > 28 && parseIso(cells[cells.length - 7]).getMonth() !== d.getMonth()) cells.splice(-7, 7);
  return cells;
}

function classChip(date, subject, slot, extraLesson) {
  const lesson = extraLesson || lessonOnDate(date, subject);
  const start = (lesson && lesson.start) || (slot && slot.start) || "";
  const end = (lesson && lesson.end) || (slot && slot.end) || "";
  const plan = lesson ? shortPlan(lesson) : "";
  const planned = plan && plan !== "Not planned";
  const label = extraLesson ? `Extra ${subjectLabel(extraLesson.subject)}` : subjectLabel(subject);
  const kind = extraLesson ? "extra" : subject;
  const body = `<b>${esc(label)} ${esc(start)}–${esc(end)}</b>${planned ? `<small>${esc(plan)}</small>` : ""}`;
  if (lesson) return `<a class="cal-chip ${kind}" href="#lesson/${encodeURIComponent(lesson.id)}">${body}</a>`;
  return `<button type="button" class="cal-chip ${kind}" data-action="open-slot" data-date="${esc(date)}" data-subject="${esc(subject)}">${body}</button>`;
}

function dayChips(date) {
  const regular = slotsOnDate(date).map((slot) => classChip(date, slot.subject, slot, null)).join("");
  const extra = extrasOnDate(date).map((lesson) => classChip(date, lesson.subject, null, lesson)).join("");
  return regular + extra;
}

function renderMonth(anchor) {
  const month = parseIso(anchor).getMonth();
  const today = iso(new Date());
  const heads = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => `<div class="month-head">${label}</div>`).join("");
  const days = monthCells(anchor).map((date) => {
    const outside = parseIso(date).getMonth() !== month;
    return `<div class="month-day${outside ? " out" : ""}${date === today ? " today" : ""}">
      <div class="month-num">${parseIso(date).getDate()}</div>
      ${dayChips(date)}
    </div>`;
  }).join("");
  return `<div class="month-grid">${heads}${days}</div>`;
}

function renderYear(anchor) {
  const year = parseIso(anchor).getFullYear();
  const today = iso(new Date());
  const cards = Array.from({ length: 12 }, (_, month) => {
    const first = iso(new Date(year, month, 1));
    const cells = monthCells(first).map((date) => {
      const outside = parseIso(date).getMonth() !== month;
      if (outside) return `<span class="out"></span>`;
      const planned = slotsOnDate(date).some((slot) => {
        const lesson = lessonOnDate(date, slot.subject);
        return lesson && shortPlan(lesson) !== "Not planned";
      }) || extrasOnDate(date).some((lesson) => shortPlan(lesson) !== "Not planned");
      const on = slotsOnDate(date).length || extrasOnDate(date).length;
      return `<button type="button" class="mini-day${on ? " on" : ""}${planned ? " planned" : ""}${date === today ? " today" : ""}" data-action="open-month" data-date="${esc(date)}" aria-label="${esc(prettyDate(date))}">${parseIso(date).getDate()}</button>`;
    }).join("");
    return `<section class="mini-month">
      <button type="button" class="month-title" data-action="open-month" data-date="${esc(first)}">${esc(monthTitle(first).replace(` ${year}`, ""))}</button>
      <div class="mini-grid">${cells}</div>
    </section>`;
  }).join("");
  return `<div class="year-grid">${cards}</div>`;
}

function academicRanges(anchor) {
  const d = parseIso(anchor || state.saturday);
  const year = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    "1": { start: `${year}-09-01`, end: `${year + 1}-01-15` },
    "2": { start: `${year + 1}-01-16`, end: `${year + 1}-06-30` },
  };
}

function termRange(sem) {
  const key = sem === "2" ? "2" : "1";
  const saved = state.terms && state.terms[key];
  if (saved && saved.start && saved.end) return { start: saved.start, end: saved.end };
  return academicRanges(calendarAnchor())[key];
}

function datesForWeekday(day, start, end) {
  const want = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[day];
  const cursor = parseIso(start);
  const last = parseIso(end);
  const out = [];
  if (want == null || cursor > last) return out;
  while (cursor.getDay() !== want) cursor.setDate(cursor.getDate() + 1);
  while (cursor <= last) {
    out.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

function roughQueue(subject) {
  if (!state.termQueue || typeof state.termQueue !== "object") state.termQueue = { chem: [], bio: [] };
  const key = subject === "bio" ? "bio" : "chem";
  if (!Array.isArray(state.termQueue[key])) state.termQueue[key] = [];
  return state.termQueue[key];
}

function termKey(date, subject) {
  return `${date}|${subject}`;
}

function readTermPlan(date, subject) {
  const raw = state.termPlan && state.termPlan[termKey(date, subject)];
  if (!raw) return null;
  if (typeof raw === "string") {
    return raw ? { split: false, groups: [{ topics: [raw], tutorial: false }] } : null;
  }
  const groups = (Array.isArray(raw.groups) ? raw.groups : []).map((group) => ({
    topics: (Array.isArray(group.topics) ? group.topics : []).filter((code) => topicByCode(code)),
    tutorial: !!group.tutorial,
  }));
  if (!groups.length) return null;
  const split = !!raw.split && groups.length > 1;
  return { split, groups: split ? groups : [groups[0]] };
}

function planIsEmpty(plan) {
  if (!plan || !plan.groups || !plan.groups.length) return true;
  if (plan.split && plan.groups.length > 1) return false;
  return plan.groups.every((group) => !group.topics.length && !group.tutorial);
}

function writeTermPlan(date, subject, plan) {
  if (!state.termPlan) state.termPlan = {};
  const key = termKey(date, subject);
  if (!plan || planIsEmpty(plan)) {
    delete state.termPlan[key];
    return;
  }
  state.termPlan[key] = {
    split: !!plan.split && plan.groups.length > 1,
    groups: plan.groups.map((group) => ({ topics: group.topics.slice(), tutorial: !!group.tutorial })),
  };
}

function editTermPlan(date, subject, change) {
  const current = readTermPlan(date, subject) || { split: false, groups: [{ topics: [], tutorial: false }] };
  const plan = {
    split: !!current.split,
    groups: current.groups.map((group) => ({ topics: group.topics.slice(), tutorial: !!group.tutorial })),
  };
  change(plan);
  if (!plan.groups.length) plan.groups = [{ topics: [], tutorial: false }];
  if (plan.groups.length < 2) plan.split = false;
  writeTermPlan(date, subject, plan);
}

function placeRoughTopic(date, subject, code) {
  if (!code) writeTermPlan(date, subject, null);
  else if (code === "tutorial") writeTermPlan(date, subject, { split: false, groups: [{ topics: [], tutorial: true }] });
  else writeTermPlan(date, subject, { split: false, groups: [{ topics: [code], tutorial: false }] });
}

function queueName(code) {
  return code === "tutorial" ? "Tutorial" : code;
}

function daySyllabusGroups(day) {
  const people = state.students.filter((student) => student.active && student.day === day && enrolled(student, iso(new Date())));
  const seen = new Set();
  const groups = [];
  people.forEach((student) => {
    const key = `${String(student.school || "").trim().toUpperCase()}|${String(student.form || "").trim().toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    groups.push(people.filter((item) => `${String(item.school || "").trim().toUpperCase()}|${String(item.form || "").trim().toUpperCase()}` === key));
  });
  return groups;
}

function classSyllabusRef(subject, sem) {
  const queue = roughQueue(subject);
  const days = activeDays().filter((day) => allSlots().some((slot) => slot.day === day && slot.subject === subject));
  const body = days.map((day) => {
    const groups = daySyllabusGroups(day).map((people) => {
      const codes = [];
      people.forEach((student) => {
        syllabusCodesOf(student, subject).forEach((code) => {
          if (!codes.includes(code)) codes.push(code);
        });
      });
      const rows = codes.map((code) => {
        if (topicSemester(people[0], subject, code) !== sem) return "";
        const marks = [...new Set(people.map((student) => gateOf(student, subject, code)).filter(Boolean))];
        const topic = topicByCode(code);
        const label = topic ? `${topic.code} ${topic.name}` : code;
        const gate = marks.length === 1 ? SYLLABUS_GATES.find((item) => item.id === marks[0]) : null;
        const mark = gate ? gate.short : marks.length > 1 ? "Mixed" : "";
        return `<button type="button" class="syll-ref-item${queue.includes(code) ? " on" : ""}" data-action="queue-topic" data-code="${esc(code)}"><span>${esc(label)}</span>${mark ? `<small>${esc(mark)}</small>` : ""}</button>`;
      }).filter(Boolean).join("");
      return `<div class="syll-ref-group"><b>${esc(people[0].school)} ${esc(people[0].form)}</b><span class="meta">${esc(people.map((student) => student.english).join(", "))}</span>${rows || `<p class="meta">Nothing for this semester.</p>`}</div>`;
    }).join("");
    return `<section class="syll-ref-day"><h3>${esc(dayLabel(day))}</h3>${groups || `<p class="meta">No students.</p>`}</section>`;
  }).join("");
  return `<aside class="syll-ref">
    <h2>Class syllabus</h2>
    <p class="meta">School topics for these students. Click one to add it to the teaching order.</p>
    ${body}
  </aside>`;
}

function roughButton(queue, code, name) {
  const count = queue.filter((item) => item === code).length;
  const mark = count > 1 ? `×${count} ` : count === 1 ? `${queue.indexOf(code) + 1} ` : "";
  return `<button type="button" class="${count ? "on" : ""}" data-action="queue-topic" data-code="${esc(code)}" title="${esc(name)}. Click again for another lesson.">${mark}${esc(queueName(code))}</button>`;
}

function planText(plan) {
  if (!plan) return "";
  const one = (group) => {
    const names = group.topics.map((code) => {
      const topic = topicByCode(code);
      return topic ? `${topic.code} ${topic.name}` : code;
    });
    const topics = names.join(" + ");
    if (group.tutorial) return topics ? `Tutorial: ${topics}` : "Tutorial";
    return topics;
  };
  if (plan.split && plan.groups.length > 1) {
    return `Split. ${plan.groups.map((group, index) => `Group ${index + 1}: ${one(group) || "Empty"}`).join(". ")}`;
  }
  return one(plan.groups[0] || { topics: [], tutorial: false });
}

function renderSem() {
  const subject = ui.roughSubject === "bio" ? "bio" : "chem";
  const sem = ui.roughSem === "2" ? "2" : "1";
  const range = termRange(sem);
  const queue = roughQueue(subject);
  const topics = `<div class="rough-group"><b>Tutorial</b>${roughButton(queue, "tutorial", "Exam or quiz drilling")}</div>` + topicGroups(subject).map((group) => `<div class="rough-group"><b>${esc(group.group)}</b>${group.topics.map((topic) => roughButton(queue, topic.code, topic.name)).join("")}</div>`).join("");
  const fills = activeDays().map((day) => {
    const slot = allSlots().find((item) => item.day === day && item.subject === subject);
    if (!slot) return "";
    return `<button type="button" class="btn small" data-action="fill-rough" data-day="${esc(day)}" data-subject="${subject}">Fill ${esc(dayLabel(day))}</button>`;
  }).join("");
  const lists = activeDays().map((day) => {
    const slot = allSlots().find((item) => item.day === day && item.subject === subject);
    if (!slot) return "";
    const rows = datesForWeekday(day, range.start, range.end).map((date) => planSlot(date, subject, day)).join("");
    return `<section class="term-day"><h3>${esc(dayLabel(day))} ${esc(subjectLabel(subject))} ${esc(slot.start)}–${esc(slot.end)}</h3>${rows}</section>`;
  }).join("");
  return `<section class="rough">
    <div class="actionbar">
      <div class="group pills tabs">
        <button type="button" class="${sem === "1" ? "on" : ""}" data-action="set-rough-sem" data-sem="1">Sem 1</button>
        <button type="button" class="${sem === "2" ? "on" : ""}" data-action="set-rough-sem" data-sem="2">Sem 2</button>
      </div>
      <div class="group pills tabs">
        <button type="button" class="${subject === "chem" ? "on" : ""}" data-action="set-rough-subject" data-subject="chem">Chem</button>
        <button type="button" class="${subject === "bio" ? "on" : ""}" data-action="set-rough-subject" data-subject="bio">Bio</button>
      </div>
      <div class="group push">
        <label class="field">Start <input class="bare" type="date" data-field="term-start" data-sem="${sem}" value="${esc(range.start)}"></label>
        <label class="field">End <input class="bare" type="date" data-field="term-end" data-sem="${sem}" value="${esc(range.end)}"></label>
      </div>
    </div>
    <p class="meta">Click chapters in teaching order, then Fill Saturday or Fill Sunday. Tutorial is in the list for exam or quiz drilling. Click a chapter again when it needs another lesson. This stays a suggestion.</p>
    <div class="actionbar">
      <div class="group">${fills}</div>
      <div class="group push">
        <button type="button" class="btn small ghost" data-action="clear-queue">Clear order</button>
        <button type="button" class="btn small ghost" data-action="clear-term-plan">Clear plan</button>
        <button type="button" class="btn small" data-action="print-sem">PDF</button>
      </div>
    </div>
    <p class="meta queue-line">${queue.length ? `Order: ${queue.map((code, index) => `<button type="button" data-action="unqueue-topic" data-index="${index}" title="Remove this lesson">${index + 1} ${esc(queueName(code))} ×</button>`).join("")}` : "No topic selected yet."}</p>
    <div class="sem-pick">
      <div class="rough-topics">${topics}</div>
      ${classSyllabusRef(subject, sem)}
    </div>
    <div class="term-days">${lists}</div>
  </section>`;
}

function renderWeek() {
  const view = ui.calView === "month" || ui.calView === "year" || ui.calView === "sem" ? ui.calView : "week";
  const anchor = calendarAnchor();
  const range = view === "year"
    ? String(parseIso(anchor).getFullYear())
    : view === "month" ? monthTitle(anchor)
    : view === "sem" ? `Sem ${ui.roughSem === "2" ? "2" : "1"}`
    : weekRangeLabel(state.saturday);
  const hint = view === "year"
    ? "Click a month, or a day, to open that month."
    : view === "sem"
      ? "Add topics, a split, or a tutorial, then save a PDF."
      : "Click a box to edit that lesson.";
  const board = view === "year" ? renderYear(anchor) : view === "month" ? renderMonth(anchor) : view === "sem" ? renderSem() : renderTimetable("");
  return `<main class="wrap wide">
    <div class="page-head">
      <div>
        <h1>Timetable</h1>
        <p class="lede">${esc(range)}. ${hint}</p>
      </div>
    </div>
    <div class="actionbar">
      <div class="group pills tabs">
        <button type="button" class="${view === "week" ? "on" : ""}" data-action="set-cal-view" data-view="week">Week</button>
        <button type="button" class="${view === "month" ? "on" : ""}" data-action="set-cal-view" data-view="month">Month</button>
        <button type="button" class="${view === "year" ? "on" : ""}" data-action="set-cal-view" data-view="year">Year</button>
        <button type="button" class="${view === "sem" ? "on" : ""}" data-action="set-cal-view" data-view="sem">Sem</button>
      </div>
      <div class="group">
        <button class="btn" type="button" data-action="cal-shift" data-delta="-1">Previous</button>
        <button class="btn" type="button" data-action="cal-shift" data-delta="1">Next</button>
      </div>
      ${view === "week" ? `<div class="group push"><button class="btn" type="button" data-action="print-week">Print week</button>${renderAddDay()}</div>` : ""}
    </div>
    ${board}
  </main>`;
}

function rangeContaining(date) {
  const academic = academicRanges(date);
  const ranges = ["1", "2"].map((sem) => {
    const saved = state.terms && state.terms[sem];
    const base = academic[sem];
    return {
      sem,
      start: saved && saved.start ? saved.start : base.start,
      end: saved && saved.end ? saved.end : base.end,
    };
  });
  return ranges.find((range) => date >= range.start && date <= range.end) || null;
}

function classPeople(lesson) {
  return lesson.extra ? dayStudents(lesson) : roster(lesson);
}

function classRecords(lesson) {
  const people = new Set(classPeople(lesson).map((student) => student.id));
  const all = Object.values(state.lessons)
    .filter((item) => item.confirmed && item.subject === lesson.subject && (item.rosterIds || []).some((id) => people.has(id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const range = rangeContaining(lesson.date);
  if (!range) return { sem: "", lessons: all };
  return {
    sem: range.sem,
    lessons: all.filter((item) => item.date >= range.start && item.date <= range.end),
  };
}

function teachFocus(stream) {
  if (!stream) return "";
  const topics = (stream.topicCodes || []).map((code) => {
    const topic = topicByCode(code);
    return topic ? `${topic.code} ${topic.name}` : code;
  }).join(" + ");
  const mode = topics ? modeWords(stream.mode) : "";
  let line = topics ? `${topics} · ${mode}` : "";
  if (stream.hwCode && stream.hwType) {
    const topic = topicByCode(stream.hwCode);
    const name = topic ? `${topic.code} ${topic.name}` : stream.hwCode;
    const hw = `HW ${name} · ${stream.hwType === "watch video" ? "watch video" : "intro ex"}`;
    line = line ? `${line} · ${hw}` : hw;
  }
  return line;
}

function savedMode(subject, mode) {
  if (mode === "both") return subject === "bio" ? "concepts + intro ex + exp ex" : "concepts + exp ex";
  if (mode === "ex") return "exp ex";
  if (mode === "concepts") return "concepts";
  return modeWords(mode);
}

function savedGroups(lesson) {
  const byStudent = new Map();
  (state.contributions || []).filter((item) => item.lessonId === lesson.id).forEach((item) => {
    if (!byStudent.has(item.studentId)) byStudent.set(item.studentId, []);
    byStudent.get(item.studentId).push(item);
  });
  const buckets = new Map();
  byStudent.forEach((items, studentId) => {
    const key = items.map((item) => `${item.code}:${item.mode}`).sort().join("|");
    if (!buckets.has(key)) buckets.set(key, { items, studentIds: [] });
    buckets.get(key).studentIds.push(studentId);
  });
  return [...buckets.values()];
}

function savedFocus(lesson, items) {
  const modes = [...new Set(items.map((item) => item.mode))];
  const names = items.map((item) => {
    const topic = topicByCode(item.code);
    return topic ? `${topic.code} ${topic.name}` : item.code;
  });
  if (modes.length === 1) return `${names.join(" + ")} · ${savedMode(lesson.subject, modes[0])}`;
  return items.map((item) => {
    const topic = topicByCode(item.code);
    const name = topic ? `${topic.code} ${topic.name}` : item.code;
    return `${name} · ${savedMode(lesson.subject, item.mode)}`;
  }).join(" · ");
}

function recordView(lesson) {
  const draft = lesson.confirmed && lesson.stale;
  if (!draft) {
    const streams = lesson.streams || [];
    const split = streams.length > 1;
    return {
      split,
      groups: streams.map((stream, index) => ({
        label: split ? `Group ${index + 1}` : "Class",
        text: teachFocus(stream) || "No topic",
        studentIds: stream.studentIds.filter((id) => !isAbs(lesson, id)),
      })),
      absent: (lesson.rosterIds || []).filter((id) => isAbs(lesson, id)),
    };
  }
  const buckets = savedGroups(lesson);
  const split = buckets.length > 1;
  const placed = new Set(buckets.flatMap((bucket) => bucket.studentIds));
  return {
    split,
    groups: buckets.map((bucket, index) => ({
      label: split ? `Group ${index + 1}` : "Class",
      text: savedFocus(lesson, bucket.items),
      studentIds: bucket.studentIds,
    })),
    absent: (lesson.rosterIds || []).filter((id) => !placed.has(id)),
  };
}

function studentTeachMark(lesson, student) {
  if (!(lesson.rosterIds || []).includes(student.id)) return "";
  const view = recordView(lesson);
  if (view.absent.includes(student.id)) return "ABS";
  const group = view.groups.find((item) => item.studentIds.includes(student.id));
  if (!group) return "Not in a group";
  const text = view.split ? `${group.label} · ${group.text}` : group.text;
  return isTrial(lesson, student.id) ? `${text}. 試堂` : text;
}

function teachBand(lesson, editable) {
  const view = recordView(lesson);
  const groups = view.groups.map((group) => {
    const names = group.studentIds.map(studentById).filter(Boolean);
    return `<div class="teach-group"><b>${esc(group.label)}</b><span>${esc(group.text || "No topic")}</span><span class="teach-names">${esc(names.map((student) => isTrial(lesson, student.id) ? `${student.english} 試堂` : student.english).join(", ") || "No one")}</span></div>`;
  }).join("");
  const absent = view.absent.map(studentById).filter(Boolean);
  const absLine = absent.length ? `<div class="teach-group"><b>ABS</b><span class="teach-names">${esc(absent.map((student) => student.english).join(", "))}</span></div>` : "";
  const kind = `${lesson.extra ? "Extra · " : ""}${view.split ? "Split" : "One class"}`;
  const asking = editable && ui.reviewRemove === lesson.id;
  const actions = !editable ? "" : asking
    ? `<div class="teach-confirm"><span>Remove what was taught on this date?</span><button type="button" class="btn small danger" data-action="confirm-remove-taught" data-lesson="${esc(lesson.id)}">Confirm remove</button><button type="button" class="btn small" data-action="cancel-remove-taught">Cancel</button></div>`
    : `<div class="teach-confirm"><button type="button" class="btn small ghost" data-action="ask-remove-taught" data-lesson="${esc(lesson.id)}">Remove</button></div>`;
  return `<article class="teach-band"><h2>${esc(prettyDate(lesson.date))} · ${esc(lesson.start)}–${esc(lesson.end)} <span>${esc(kind)}</span></h2>${groups || `<div class="teach-group"><b>Class</b><span>No topic</span></div>`}${absLine}${actions}</article>`;
}

function studentSemester(student, lessons) {
  const marks = lessons.map((lesson) => {
    const mark = studentTeachMark(lesson, student);
    if (!mark) return "";
    const date = parseIso(lesson.date);
    const label = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${mark}`;
    return `<span>${esc(label)}</span>`;
  }).filter(Boolean).join("");
  return `<article class="person-panel"><header class="panel-head"><div><strong>${esc(student.english)}</strong><span>${esc(student.school)} ${esc(student.form)}</span></div></header><div class="teach-track">${marks || `<span class="meta">No saved lesson</span>`}</div></article>`;
}

function overviewInner(lesson) {
  const people = classPeople(lesson);
  const pack = classRecords(lesson);
  const semLabel = pack.sem ? `Sem ${pack.sem}` : "Saved lessons";
  const records = pack.lessons.length
    ? pack.lessons.map((item) => teachBand(item)).join("")
    : `<p class="meta">Nothing saved in this semester yet. Save a lesson and it appears here.</p>`;
  return {
    semLabel,
    body: `<h2 class="section-title">What was taught</h2>
      <div class="overview-list">${records}</div>
      <h2 class="section-title">Each student</h2>
      <div class="people-grid">${people.map((student) => studentSemester(student, pack.lessons)).join("")}</div>`,
  };
}

function renderOverview() {
  const lesson = state.lessons[parseHash().arg];
  if (!lesson) return `<main class="wrap"><h1>Lesson not found</h1><p class="lede"><a href="#week">Back to the timetable</a></p></main>`;
  const view = overviewInner(lesson);
  return `<main class="wrap wide overview">
    <div class="page-head">
      <div>
        <p class="kicker"><a href="#lesson/${encodeURIComponent(lesson.id)}">Back to this lesson</a></p>
        <h1>${esc(dayLabel(lesson.day))} ${esc(subjectLabel(lesson.subject))} · ${esc(view.semLabel)}</h1>
        <p class="lede">Every saved lesson for this class. A split lesson shows each group and what that group was taught.</p>
      </div>
      <button class="btn" type="button" data-action="print">Print</button>
    </div>
    ${view.body}
  </main>`;
}

function reviewChoice(arg) {
  const [day, subject, sem] = String(arg || "").split("-");
  return {
    day: DAY_ORDER.includes(day) ? day : "sat",
    subject: subject === "bio" ? "bio" : "chem",
    sem: sem === "2" ? "2" : "1",
  };
}

function reviewHref(lesson) {
  const range = rangeContaining(lesson.date);
  const sem = range ? range.sem : "1";
  return `#review/${lesson.day}-${lesson.subject}-${sem}`;
}

function lessonWasTaught(lesson) {
  if (!lesson || !lesson.confirmed) return false;
  if (lesson.stale && !streamHasTeaching(lesson)) return false;
  if ((state.contributions || []).some((item) => item.lessonId === lesson.id)) return true;
  if (lesson.stale) return false;
  return streamHasTeaching(lesson);
}

function classSlots() {
  return activeDays().flatMap((day) => ["chem", "bio"].map((subject) => {
    const slot = allSlots().find((item) => item.day === day && item.subject === subject);
    return slot ? { day, subject } : null;
  }).filter(Boolean));
}

function taughtForClass(day, subject, sem) {
  const range = termRange(sem);
  const lessons = Object.values(state.lessons)
    .filter((lesson) => lesson.day === day && lesson.subject === subject && lessonWasTaught(lesson))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return {
    range,
    inside: lessons.filter((lesson) => lesson.date >= range.start && lesson.date <= range.end),
    outside: lessons.filter((lesson) => lesson.date < range.start || lesson.date > range.end),
  };
}

function reviewBody(day, subject, sem, editable) {
  const pack = taughtForClass(day, subject, sem);
  const today = iso(new Date());
  const people = state.students.filter((student) => (
    student.active
    && student.day === day
    && (enrolled(student, today) || pack.inside.some((lesson) => (lesson.rosterIds || []).includes(student.id)))
  ));
  const records = pack.inside.length
    ? pack.inside.map((lesson) => teachBand(lesson, editable)).join("")
    : `<p class="meta">No taught lesson in this semester.</p>`;
  const outside = pack.outside.length
    ? `<p class="meta">Taught outside this semester: ${esc(pack.outside.map((lesson) => prettyDate(lesson.date)).join(", "))}.</p>`
    : "";
  const students = pack.inside.length
    ? `<h2 class="section-title">Each student</h2><div class="people-grid">${people.map((student) => studentSemester(student, pack.inside)).join("")}</div>`
    : "";
  return { pack, body: `${outside}<h2 class="section-title">What was taught</h2><div class="overview-list">${records}</div>${students}` };
}

function renderReview() {
  const pick = reviewChoice(parseHash().arg);
  const view = reviewBody(pick.day, pick.subject, pick.sem, true);
  const classes = classSlots().map((slot) => {
    const on = slot.day === pick.day && slot.subject === pick.subject;
    return `<a class="${on ? "on" : ""}" href="#review/${slot.day}-${slot.subject}-${pick.sem}">${esc(dayLabel(slot.day))} ${esc(subjectLabel(slot.subject))}</a>`;
  }).join("");
  return `<main class="wrap wide overview">
    <div class="page-head">
      <div>
        <h1>${esc(dayLabel(pick.day))} ${esc(subjectLabel(pick.subject))} · Sem ${esc(pick.sem)}</h1>
        <p class="lede">${esc(prettyDate(view.pack.range.start))} – ${esc(prettyDate(view.pack.range.end))}. Taught lessons only.</p>
      </div>
    </div>
    <div class="actionbar">
      <div class="group pills">${classes}</div>
      <div class="group pills tabs">
        <a class="${pick.sem === "1" ? "on" : ""}" href="#review/${pick.day}-${pick.subject}-1">Sem 1</a>
        <a class="${pick.sem === "2" ? "on" : ""}" href="#review/${pick.day}-${pick.subject}-2">Sem 2</a>
      </div>
      <div class="group push">
        <button class="btn" type="button" data-action="print">Print</button>
      </div>
    </div>
    ${view.body}
  </main>`;
}

function renderReviewPrint() {
  const pick = reviewChoice(parseHash().arg);
  const view = reviewBody(pick.day, pick.subject, pick.sem, false);
  return `<section class="print-sheet overview">
    <h1>${esc(dayLabel(pick.day))} ${esc(subjectLabel(pick.subject))} · Sem ${esc(pick.sem)}</h1>
    <p>${esc(prettyDate(view.pack.range.start))} – ${esc(prettyDate(view.pack.range.end))}. Taught lessons only.</p>
    ${view.body}
  </section>`;
}

function renderOverviewPrint() {
  const lesson = state.lessons[parseHash().arg];
  if (!lesson) return "";
  const view = overviewInner(lesson);
  return `<section class="print-sheet overview">
    <h1>${esc(dayLabel(lesson.day))} ${esc(subjectLabel(lesson.subject))} · ${esc(view.semLabel)}</h1>
    <p>Every saved lesson for this class. A split lesson shows each group and what that group was taught.</p>
    ${view.body}
  </section>`;
}

function renderLesson() {
  const lesson = lessonFromHash();
  if (!lesson) {
    return `<main class="wrap"><h1>Lesson not found</h1><p class="lede"><a href="#week">Back to this week</a></p></main>`;
  }
  const saturday = thisSaturday(parseIso(lesson.date));
  const pool = lesson.extra ? dayStudents(lesson) : roster(lesson);
  const people = roster(lesson);
  const placed = new Set(lesson.streams.flatMap((s) => s.studentIds));
  const loose = pool.filter((s) => !placed.has(s.id));
  const absCount = people.filter((s) => isAbs(lesson, s.id)).length;
  const unplaced = loose.filter((s) => !isAbs(lesson, s.id)).length;
  const issue = problems(lesson);
  const status = lessonStatus(lesson);
  const picked = ui.picked ? studentById(ui.picked) : null;
  return `<main class="wrap wide">
    <div class="page-head">
      <div>
        <p class="kicker">${lesson.extra ? "Extra lesson · " : ""}${esc(dayLabel(lesson.day))} · ${esc(subjectLabel(lesson.subject))}</p>
        <h1>${esc(prettyDate(lesson.date))} ${lesson.extra ? "extra " : ""}${esc(subjectLabel(lesson.subject))}</h1>
        <p class="lede" data-lesson-lede>${esc(lesson.start)}–${esc(lesson.end)} · ${esc(lesson.room)}</p>
        <div class="row" style="margin-top:8px">
          <label class="field">Start <input class="bare" type="time" data-field="slot-start" value="${esc(lesson.start)}"></label>
          <label class="field">End <input class="bare" type="time" data-field="slot-end" value="${esc(lesson.end)}"></label>
          <label class="field">Room <input class="bare" data-field="slot-room" value="${esc(lesson.room)}" placeholder="Room"></label>
        </div>
      </div>
    </div>
    <div class="actionbar">
      <div class="group">
        <span class="badge ${status.key}">${esc(status.label)}</span>
        <button class="btn" type="button" data-action="toggle-glance">${ui.showGlance ? "Hide last lesson" : "Last lesson"}</button>
        <a class="btn" href="${reviewHref(lesson)}">Review</a>
      </div>
      <div class="group push">
        <button class="btn" type="button" data-action="print">Print</button>
        <button class="btn" type="button" data-action="print-week">Print week</button>
        ${lesson.extra ? `<button class="btn ghost" type="button" data-action="remove-extra">Remove extra</button>` : ""}
        <button class="btn primary" type="button" data-action="confirm">Save</button>
      </div>
    </div>
    <section class="class-board">
      <div class="stream-top">
        <h2>This ${esc(subjectLabel(lesson.subject))} class</h2>
        <span class="count">${esc(dayLabel(lesson.day))} · ${pool.length}</span>
      </div>
      <div class="legend">${dashLegend(lesson.subject)}</div>
      ${heatTable(pool, lesson.subject)}
    </section>
    <div style="margin-bottom:14px">${renderTimetable(lesson.id, saturday)}</div>
    <p class="meta" data-stale-flag ${lesson.stale ? "" : "hidden"}>Edited since the last confirm. Confirm again to refresh the saved record.</p>
    ${issue.blocking.length ? `<div class="block">${issue.blocking.map(esc).join(" ")}</div>` : ""}
    ${ui.warnLesson === lesson.id && issue.unassigned.length ? `<div class="warn">
      <p>Not on a topic yet: ${issue.unassigned.map((s) => esc(s.english)).join(", ")}.</p>
      <div class="row" style="margin-top:8px">
        <button class="btn small" type="button" data-action="mark-unassigned-abs">Mark these ABS</button>
        <button class="btn small" type="button" data-action="save-anyway">Save anyway</button>
        <button class="btn small ghost" type="button" data-action="dismiss-warn">Keep editing</button>
      </div>
    </div>` : ""}
    ${ui.showGlance ? `<section class="card" style="margin-bottom:14px">
        <h2>Last lesson</h2>
      <div class="table-wrap" style="margin-top:8px">${glanceTable(lesson, false)}</div>
    </section>` : ""}
    <div id="paste-root">${pasteInner(lesson)}</div>
    <section class="desk">
      <aside class="card pool-col">
        <div class="stream-top">
          <h2>Names</h2>
          <div class="row">
            <span class="count">${unplaced} left${absCount ? ` · ${absCount} ABS` : ""}</span>
            ${lesson.streams.length === 1 ? `<button type="button" class="btn small" data-action="add-all" data-stream="${esc(lesson.streams[0].id)}">Add all</button>` : ""}
          </div>
        </div>
        <p class="hint">${picked ? `Tap the topic to put ${esc(picked.english)} there.` : (lesson.extra ? "Drag on only the students who are coming." : "Drag a name onto the topic.")}</p>
        <div class="pool" data-drop="pool">
          ${loose.map((s) => studentChip(s, lesson, false)).join("") || `<p class="meta">Everyone is on a topic.</p>`}
        </div>
      </aside>
      <div class="plan-col">
        <div class="row" style="justify-content:space-between; margin-bottom:8px">
          <h2>Topic</h2>
          <div class="row">
            <button class="btn small" type="button" data-action="add-stream">Class is split</button>
            <button class="btn small ghost" type="button" data-action="clear-topics">Clear topics</button>
            <button class="btn primary" type="button" data-action="confirm">Save</button>
          </div>
        </div>
        ${suggestionLine(lesson)}
        ${lesson.streams.map((stream, index) => renderStream(lesson, stream, index)).join("") || `<div class="card"><p class="meta">No topic yet.</p></div>`}
      </div>
    </section>
  </main>`;
}

function studentChip(student, lesson, inStream) {
  const abs = isAbs(lesson, student.id);
  const picked = ui.picked === student.id ? "picked" : "";
  return `<div class="chip ${picked} ${abs ? "abs" : ""}" draggable="true" data-student-chip data-student="${esc(student.id)}">
    <button type="button" class="linkish" data-action="pick-student" data-student="${esc(student.id)}" style="flex:1">
      <strong>${esc(student.english)}</strong>
      <span>${esc(student.school)}</span>
    </button>
    <button type="button" class="btn small ${abs ? "danger" : ""}" data-action="toggle-abs" data-student="${esc(student.id)}" aria-pressed="${abs ? "true" : "false"}">ABS</button>
    ${inStream ? `<button type="button" class="x" data-action="unassign" data-student="${esc(student.id)}" aria-label="Remove">×</button>` : ""}
  </div>`;
}

function suggestionLine(lesson) {
  const text = planText(readTermPlan(lesson.date, lesson.subject));
  if (!text) return "";
  return `<p class="suggestion">Semester suggestion: <strong>${esc(text)}</strong>. The class plan on this page is unchanged.</p>`;
}

function planSlot(date, subject, day) {
  const plan = readTermPlan(date, subject) || { split: false, groups: [{ topics: [], tutorial: false }] };
  const lesson = lessonOnDate(date, subject);
  const real = lesson ? lesson.streams.flatMap((stream) => stream.topicCodes).filter(Boolean) : [];
  const groups = plan.groups.map((group, index) => {
    const chips = (group.tutorial ? [`<span class="topic-pill">Tutorial <button type="button" class="x" data-action="remove-plan-topic" data-date="${esc(date)}" data-subject="${subject}" data-group="${index}" data-code="tutorial" aria-label="Remove Tutorial">×</button></span>`] : []).concat(group.topics.map((code) => {
      const topic = topicByCode(code);
      const label = topic ? `${topic.code} ${topic.name}` : code;
      return `<span class="topic-pill">${esc(label)} <button type="button" class="x" data-action="remove-plan-topic" data-date="${esc(date)}" data-subject="${subject}" data-group="${index}" data-code="${esc(code)}" aria-label="Remove ${esc(code)}">×</button></span>`;
    })).join("");
    const options = [`<option value="">Add topic</option>`, `<option value="tutorial">Tutorial</option>`].concat(pinnedTopics(subject).map((topic) => `<option value="${esc(topic.code)}">${esc(topic.code)} ${esc(topic.name)}</option>`)).join("");
    return `<div class="plan-group">
      ${plan.split ? `<b>Group ${index + 1}</b>` : ""}
      <div class="topics">${chips}</div>
      <select class="bare term-pick" data-field="plan-add" data-date="${esc(date)}" data-subject="${subject}" data-group="${index}" aria-label="Add a topic">${options}</select>
      ${plan.split && plan.groups.length > 1 ? `<button type="button" class="btn small ghost" data-action="remove-plan-group" data-date="${esc(date)}" data-subject="${subject}" data-group="${index}">Remove</button>` : ""}
    </div>`;
  }).join("");
  return `<div class="plan-slot">
    <div class="plan-slot-top">
      <span>${esc(prettyDate(date))}</span>
      <button type="button" class="btn small ${plan.split ? "teal" : ""}" data-action="toggle-plan-split" data-date="${esc(date)}" data-subject="${subject}" data-day="${esc(day)}" aria-pressed="${plan.split ? "true" : "false"}">Split</button>
      ${plan.split ? `<button type="button" class="btn small" data-action="add-plan-group" data-date="${esc(date)}" data-subject="${subject}">Add group</button>` : ""}
    </div>
    ${groups}
    ${real.length ? `<span class="meta">Class has ${esc(real.join(" + "))}</span>` : ""}
  </div>`;
}

function renderSemPrint() {
  const subject = ui.roughSubject === "bio" ? "bio" : "chem";
  const sem = ui.roughSem === "2" ? "2" : "1";
  const range = termRange(sem);
  const rows = activeDays().flatMap((day) => {
    const slot = allSlots().find((item) => item.day === day && item.subject === subject);
    if (!slot) return [];
    return datesForWeekday(day, range.start, range.end).map((date) => {
      const text = planText(readTermPlan(date, subject));
      return `<tr><td>${esc(prettyDate(date))}</td><td>${esc(dayLabel(day))}</td><td>${esc(slot.start)}–${esc(slot.end)}</td><td>${esc(text || "—")}</td></tr>`;
    });
  }).join("");
  return `<section class="print-sheet">
    <h1>${esc(subjectLabel(subject))} Sem ${esc(sem)} timetable plan</h1>
    <p>${esc(range.start)} – ${esc(range.end)}. Suggestion only. Tutorial is exam or quiz drilling. This is not the class plan.</p>
    <table><thead><tr><th>Date</th><th>Day</th><th>Time</th><th>Suggestion</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function renderStream(lesson, stream, index) {
  const many = lesson.streams.length > 1;
  const title = many ? `Group ${index + 1}` : "Today's topic";
  const open = ui.moreStream === stream.id;
  const names = stream.studentIds.map((id) => studentById(id)).filter(Boolean);
  return `<article class="card stream">
    <div class="stream-top">
      <strong>${title}</strong>
      <div class="row">
        ${many ? `<button class="btn small" type="button" data-action="add-all" data-stream="${esc(stream.id)}">Add all</button>` : ""}
        <button class="btn small ghost" type="button" data-action="toggle-more" data-stream="${esc(stream.id)}">${open ? "Less" : "More"}</button>
        ${many ? `<button class="btn small ghost" type="button" data-action="delete-stream" data-stream="${esc(stream.id)}">Remove</button>` : ""}
      </div>
    </div>
    ${open ? `<div class="row" style="margin-top:8px">
      <label class="field">Teacher
        <input class="teacher bare" data-field="teacher" data-stream="${esc(stream.id)}" value="${esc(stream.teacher)}">
      </label>
    </div>` : ""}
    <div class="topics">
      ${stream.topicCodes.map((code) => {
        const t = topicByCode(code);
        return `<span class="topic-pill">${esc(t ? `${t.code} ${t.name}` : code)} <button type="button" class="x" data-action="remove-topic" data-stream="${esc(stream.id)}" data-code="${esc(code)}" aria-label="Remove topic">×</button></span>`;
      }).join("")}
    </div>
    <div class="search-wrap">
      <input class="bare" data-field="topic-search" data-stream="${esc(stream.id)}" placeholder="Type a topic, e.g. Earth2A" autocomplete="off">
      <div class="results" data-results hidden></div>
    </div>
    <div class="modes">
      ${lessonModes(lesson.subject).map((mode) => `<button type="button" class="btn small" data-action="set-mode" data-stream="${esc(stream.id)}" data-mode="${esc(mode)}" aria-pressed="${stream.mode === mode ? "true" : "false"}">${esc(modeWords(mode))}</button>`).join("")}
    </div>
    <div class="hw-box">
      <div class="row">
        <span class="track-name">Homework · one topic</span>
        <button type="button" class="btn small" data-action="set-hw-type" data-stream="${esc(stream.id)}" data-type="watch video" aria-pressed="${stream.hwType === "watch video" ? "true" : "false"}">Watch video</button>
        <button type="button" class="btn small" data-action="set-hw-type" data-stream="${esc(stream.id)}" data-type="intro ex" aria-pressed="${stream.hwType === "intro ex" ? "true" : "false"}">Intro ex</button>
      </div>
      ${stream.hwCode ? `<span class="topic-pill">${esc((() => { const t = topicByCode(stream.hwCode); return t ? `${t.code} ${t.name}` : stream.hwCode; })())} <button type="button" class="x" data-action="clear-hw" data-stream="${esc(stream.id)}" aria-label="Remove homework">×</button></span>` : ""}
      <div class="search-wrap">
        <input class="bare" data-field="hw-search" data-stream="${esc(stream.id)}" placeholder="Homework topic, not necessarily today’s" autocomplete="off">
        <div class="results" data-hw-results hidden></div>
      </div>
    </div>
    <p class="copy-line small" data-preview="${esc(stream.id)}">${esc(sentence(stream) || "Pick a topic to build the line.")}</p>
    <input class="bare" data-field="note" data-stream="${esc(stream.id)}" value="${esc(stream.note)}" placeholder="Optional note, e.g. Hwc need to confirm next week">
    <div class="drop" data-drop="stream" data-stream="${esc(stream.id)}" style="margin-top:8px">
      ${names.map((s) => studentChip(s, lesson, true)).join("")}
      ${names.length ? "" : `<span class="meta">Drop names here</span>`}
      ${ui.picked ? `<button type="button" class="btn small" data-action="place-picked" data-stream="${esc(stream.id)}">Put here</button>` : ""}
    </div>
  </article>`;
}

function glanceTable(lesson, forPrint) {
  const rows = roster(lesson).map((student) => {
    const hist = historyBits(student, lesson);
    const syll = schoolSyllabus(student, lesson.subject);
    const test = formatTest(nextTest(student, lesson.date)) || "—";
    const abs = isAbs(lesson, student.id);
    return { student, hist, syll, test, abs };
  });
  const head = ["Name", "Last lesson", "Last progress", "Attendance", "School syllabus", "Remark", "Next test", "Today"];
  const body = rows.map(({ student, hist, syll, test, abs }) => `<tr>
    <td>${esc(displayName(student))}</td>
    <td>${esc(hist.lastWhen)}</td>
    <td>${esc(hist.progress).replaceAll("\n", "<br>")}</td>
    <td>${esc(hist.attendance)}</td>
    <td>${esc(syll || "—")}</td>
    <td>${forPrint ? esc(student.remark || "—") : `<input class="bare" data-field="remark" data-student="${esc(student.id)}" value="${esc(student.remark)}">`}</td>
    <td>${esc(test)}</td>
    <td>${forPrint ? (abs ? "ABS" : "") : `<button type="button" class="btn small ${abs ? "danger" : ""}" data-action="toggle-abs" data-student="${esc(student.id)}">${abs ? "ABS" : "Present"}</button>`}</td>
  </tr>`).join("");
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderPrint() {
  const lesson = lessonFromHash();
  if (!lesson) return "";
  return `<section class="print-sheet">${preClassBlock(lesson)}</section>`;
}

function lessonForPrint(slot, date) {
  const saved = state.lessons[`${date}-${slot.subject}`];
  if (saved && !saved.extra) return saved;
  return {
    date,
    day: slot.day,
    subject: slot.subject,
    start: slot.start,
    end: slot.end,
    room: slot.room || "",
    confirmed: false,
    extra: false,
    streams: [],
    attendance: {},
    rosterIds: null,
  };
}

function weekPrintLessons(saturday) {
  const lessons = [];
  activeDays().forEach((day) => {
    const date = dateForDay(saturday, day);
    ["chem", "bio"].forEach((subject) => {
      const slot = allSlots().find((item) => item.day === day && item.subject === subject);
      if (slot) lessons.push(lessonForPrint(slot, date));
    });
    extrasOnDate(date).forEach((lesson) => lessons.push(lesson));
  });
  return lessons;
}

function preClassBlock(lesson) {
  const kind = lesson.extra ? "extra " : "";
  return `<section class="week-class">
    <h1>${esc(prettyDate(lesson.date))} ${kind}${esc(subjectLabel(lesson.subject))} ${esc(lesson.start)}–${esc(lesson.end)}</h1>
    <p>${esc(lesson.room || "No room")} · Pre-class namelist</p>
    ${glanceTable(lesson, true)}
  </section>`;
}

function renderWeekPrint() {
  const blocks = weekPrintLessons(state.saturday).map((lesson) => preClassBlock(lesson)).join("");
  return `<section class="print-sheet">${blocks}</section>`;
}

function pasteInner(lesson) {
  const out = buildOutputs(lesson);
  const lid = esc(lesson.id);
  const line = out.classText || "Pick a topic, then drag the names onto it.";
  const individuals = out.individuals.map((item) => `<div class="ind">
      <div class="ind-name"><strong>${esc(item.name)}</strong><button type="button" class="btn small" data-action="copy-one" data-lesson="${lid}" data-student="${esc(item.studentId)}">Copy</button></div>
      <p class="copy-line small">${esc(item.text)}</p>
    </div>`).join("");
  return `<section class="card copy-simple">
    <div class="row" style="justify-content:space-between">
      <h2>Copy into the company</h2>
      <button type="button" class="btn teal" data-action="copy-class" data-lesson="${lid}">Copy</button>
    </div>
    <p class="copy-line">${esc(line)}</p>
    ${individuals ? `<p class="meta">These students need their own line.</p>${individuals}` : ""}
    <button type="button" class="btn" data-action="copy-excel" data-lesson="${lid}">Copy team sheet</button>
  </section>`;
}

function refreshPaste(lesson) {
  const root = document.getElementById("paste-root");
  if (root) root.innerHTML = pasteInner(lesson);
  const flag = document.querySelector("[data-stale-flag]");
  if (flag) flag.hidden = !lesson.stale;
}

function progressCell(lesson, student) {
  if (!lesson) return "—";
  const text = didWhat(lesson, student) || "—";
  return `<a href="#lesson/${encodeURIComponent(lesson.id)}">${esc(stamp(lesson.date, lesson.start, lesson.end))}</a><br>${esc(text).replaceAll("\n", "<br>")}`;
}

function lessonMarks(student, subject) {
  const map = new Map();
  for (const lesson of lessonsTouching(student, subject)) {
    if (isAbs(lesson, student.id)) continue;
    const stream = (lesson.streams || []).find((item) => item.studentIds.includes(student.id));
    if (!stream) continue;
    for (const code of stream.topicCodes) {
      const topic = topicByCode(code);
      if (topic && topic.subject !== subject) continue;
      map.set(code, mergeParts(map.get(code), modeParts(stream.mode)));
    }
    if (stream.hwCode && stream.hwType === "intro ex") {
      const topic = topicByCode(stream.hwCode);
      if (!topic || topic.subject === subject) {
        map.set(stream.hwCode, mergeParts(map.get(stream.hwCode), { intro: true }));
      }
    }
  }
  return map;
}

function taughtMarks(student, subject) {
  const map = lessonMarks(student, subject);
  const bag = (state.hand && state.hand[student.id]) || {};
  Object.entries(bag).forEach(([code, flags]) => {
    const topic = topicByCode(code);
    if (topic && topic.subject !== subject) return;
    const next = { concepts: !!flags.concepts, intro: !!flags.intro, exp: !!flags.exp };
    if (!next.concepts && !next.intro && !next.exp) return;
    map.set(code, mergeParts(map.get(code), next));
  });
  return map;
}

function compareTopics(student, subject) {
  const schoolList = syllabusCodesOf(student, subject);
  const taught = taughtMarks(student, subject);
  const codes = schoolList.slice();
  for (const code of taught.keys()) if (!codes.includes(code)) codes.push(code);
  const school = new Set(schoolList);
  const needs = codes.filter((code) => school.has(code) && !teachingDone(subject, taught.get(code)));
  return { codes, school, taught, needs };
}

function topicStatus(code, school, taught) {
  const mark = taught.get(code) || "";
  const onSchool = school.has(code);
  const topic = topicByCode(code);
  const name = topic ? `${topic.code} ${topic.name}` : code;
  let schoolState = "Not on the school list";
  if (onSchool && mark) schoolState = "On the school list, already taught";
  if (onSchool && !mark) schoolState = "On the school list, not taught yet";
  const taughtState = mark === "both" ? "Taught concepts and exp ex" : mark === "concepts" ? "Taught concepts" : mark === "ex" ? "Taught exp ex" : mark === "video" ? "Homework: watch video" : "Not taught";
  return { mark, onSchool, name, label: `${name}. ${schoolState}. ${taughtState}.` };
}

function progressDiagram(student, subject) {
  const { codes, school, taught, needs } = compareTopics(student, subject);
  const note = subject === "chem" ? String(student.schoolTopic || "").trim() : "";
  const noteHtml = note && note !== [...school].join(" ") ? `<p class="note-line">${esc(note)}</p>` : "";
  if (!codes.length) {
    return `${noteHtml}<p class="meta">${noteHtml ? "No topic codes to line up with that note." : "Nothing on the school list, and nothing taught yet."}</p>`;
  }
  const cols = codes.map((code) => {
    const status = topicStatus(code, school, taught);
    const lesson = lessonsTouching(student, subject).find((item) => {
      if (isAbs(item, student.id)) return false;
      const stream = (item.streams || []).find((entry) => entry.studentIds.includes(student.id));
      return stream && stream.topicCodes.includes(code);
    });
    const schoolClass = status.onSchool ? (status.mark ? "met" : "need") : "gap";
    const href = lesson ? ` href="#lesson/${encodeURIComponent(lesson.id)}"` : "";
    const tag = lesson ? "a" : "span";
    return `<div class="col">
      <span class="sq school ${schoolClass}" title="${esc(status.label)}"></span>
      <${tag} class="sq taught ${esc(status.mark || "none")}"${href} title="${esc(status.label)}" aria-label="${esc(status.label)}">
        <i class="${status.mark === "concepts" || status.mark === "both" ? "on" : ""}"></i>
        <i class="${status.mark === "ex" || status.mark === "both" ? "on" : ""}"></i>
      </${tag}>
      <span class="code">${esc(code)}</span>
    </div>`;
  }).join("");
  return `${noteHtml}<div class="diagram" role="group" aria-label="${esc(subjectLabel(subject))} for ${esc(student.english)}. ${needs.length} school topic${needs.length === 1 ? "" : "s"} not taught yet.">
    <div class="lane-names"><span>School</span><span>Taught</span><span></span></div>
    <div class="cols">${cols}</div>
  </div>`;
}

function syllabusChips(student, subject) {
  const codes = syllabusCodesOf(student, subject);
  const note = subject === "chem" ? String(student.schoolTopic || "").trim() : "";
  const noteHtml = note && note !== codes.join(" ") ? `<p class="note-line">${esc(note)}</p>` : "";
  if (!codes.length) return `${noteHtml || `<p class="meta">None yet</p>`}`;
  const chips = codes.map((code) => {
    const topic = topicByCode(code);
    return `<span class="code-chip"><strong>${esc(code)}</strong> ${esc(topic ? topic.name : "")}</span>`;
  }).join("");
  return `<div class="chips">${chips}</div>${noteHtml}`;
}

function testLines(student) {
  const tests = (student.tests || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!tests.length) return `<p class="meta">No test yet</p>`;
  const today = iso(new Date());
  return `<ul class="plain-list">${tests.map((test) => `<li class="${test.date < today ? "past" : ""}">${esc(formatTest(test))}</li>`).join("")}</ul>`;
}

function progressStudents() {
  const today = iso(new Date());
  const query = ui.findStudent.trim().toLowerCase();
  return state.students.filter((student) => {
    if (!enrolled(student, today)) return false;
    if (!query) return true;
    const blob = `${student.english} ${student.chinese} ${student.school} ${student.form} ${student.remark || ""}`.toLowerCase();
    return blob.includes(query);
  });
}

function partChip(label, on) {
  return `<span class="part ${on ? "on" : ""}">${esc(label)}</span>`;
}

function topicMarks(student, subject) {
  const bag = compareTopics(student, subject);
  if (!bag.codes.length) return `<span class="meta">—</span>`;
  const kind = laterKind(subject);
  return bag.codes.map((code) => {
    const topic = topicByCode(code);
    const name = topic ? topic.name : "";
    const parts = bag.taught.get(code) || { concepts: false, intro: false, exp: false };
    const onSchool = bag.school.has(code);
    const done = teachingDone(subject, parts);
    const schoolBar = `<span class="mk ${onSchool ? (done ? "met" : "need") : "gap"}"></span>`;
    const steps = subject === "bio"
      ? `${partChip("Concepts", parts.concepts)}${partChip("Intro ex", parts.intro)}${partChip("Exp ex", parts.exp)}`
      : `${partChip("Concepts", parts.concepts)}${partChip("Exp ex", parts.exp)}`;
    const laterOn = laterOf(student.id, code) === kind;
    return `<div class="topic-box ${done ? "done" : ""}">
      <div class="topic-name">${schoolBar}<span>${esc(code)} ${esc(name)}</span></div>
      <div class="parts">${steps}<button type="button" class="part later ${laterOn ? "on" : ""}" data-action="toggle-later" data-student="${esc(student.id)}" data-code="${esc(code)}" data-kind="${kind}" aria-pressed="${laterOn ? "true" : "false"}">${esc(laterLabel(subject))}</button></div>
    </div>`;
  }).join("");
}

function testFact(student, subject) {
  const key = subject === "bio" ? "bio" : subject === "chem" ? "chem" : "";
  const subjects = key ? [key] : ["chem", "bio"];
  const scheduled = subjects.flatMap((item) => scheduledTests(student, item))
    .filter((item) => item.date || item.codes.length);
  const legacy = (student.tests || []).filter((test) => {
    if (!test.code || test.kind) return false;
    if (!key) return true;
    const topic = topicByCode(test.code);
    return topic && topic.subject === key;
  });
  const parts = scheduled.map((item) => formatTest(item)).concat(legacy.map((test) => formatTest(test)));
  return parts.length ? parts.join(" · ") : "No test";
}

function vizCard(student, options) {
  const opts = options || {};
  const subjects = opts.subjects || ["chem", "bio"];
  const note = String(student.schoolTopic || "").trim();
  const remark = String(student.remark || "").trim();
  const rule = {
    chem: "Finish: concepts + exp ex",
    bio: "Finish: concepts + intro ex + exp ex",
  };
  return `<article class="panel">
    <header class="panel-head">
      <div>
        <strong>${esc(student.english)}</strong>
        <span>${esc(student.chinese)} · ${esc(student.school)} ${esc(student.form)}</span>
        ${note ? `<span>${esc(note)}</span>` : ""}
      </div>
      ${opts.copy === false ? "" : `<button type="button" class="btn small" data-action="copy-student-record" data-student="${esc(student.id)}">Copy</button>`}
    </header>
    <div class="panel-split">
      ${subjects.map((subject) => `<section class="box">
        <h3>${esc(subjectLabel(subject))}</h3>
        <p>${esc(rule[subject] || "")}</p>
        ${topicMarks(student, subject)}
      </section>`).join("")}
    </div>
    <div class="panel-foot">
      <div class="box"><b>Remark</b><span>${esc(remark || "—")}</span></div>
      <div class="box"><b>Test</b><span>${esc(testFact(student))}</span></div>
    </div>
  </article>`;
}

function progressSubject() {
  return parseHash().arg === "bio" ? "bio" : "chem";
}

function dashLegend(subject) {
  const later = subject === "bio" ? "Sum ex, click to mark" : "Publisher ex, click to mark";
  const steps = subject === "bio" ? "Concepts, intro ex, exp ex" : "Concepts, exp ex";
  return `<span><i class="pip syllabus off"></i> Not on the school list yet</span><span><i class="pip syllabus on"></i> On the school list</span><span><i class="pip step"></i> Not taught yet. Click to mark</span><span><i class="pip step on"></i> ${steps}</span><span><i class="pip later"></i> ${later}</span>`;
}

function heatCodes(students, subject) {
  const seen = new Set();
  students.forEach((student) => {
    compareTopics(student, subject).codes.forEach((code) => seen.add(code));
  });
  const order = pinnedTopics(subject).map((topic) => topic.code);
  const codes = order.filter((code) => seen.has(code));
  seen.forEach((code) => { if (!codes.includes(code)) codes.push(code); });
  return codes;
}

function heatCell(student, subject, code) {
  const bag = compareTopics(student, subject);
  if (!bag.codes.includes(code)) return `<td></td>`;
  const parts = bag.taught.get(code) || { concepts: false, intro: false, exp: false };
  const fromLesson = lessonMarks(student, subject).get(code) || { concepts: false, intro: false, exp: false };
  const byHand = handFlags(student.id, code);
  const onSchool = bag.school.has(code);
  const kind = laterKind(subject);
  const laterOn = laterOf(student.id, code) === kind;
  const topic = topicByCode(code);
  const name = topic ? topic.name : code;
  const stepKeys = subject === "bio" ? ["concepts", "intro", "exp"] : ["concepts", "exp"];
  const stepNames = subject === "bio" ? ["Concepts", "Intro ex", "Exp ex"] : ["Concepts", "Exp ex"];
  const detail = stepNames.map((label, index) => {
    const key = stepKeys[index];
    const how = byHand[key] ? "marked by hand" : parts[key] ? "done" : "not yet";
    return `${label} ${how}`;
  }).join(", ");
  const title = `${name}. ${onSchool ? "On the school list." : "Not on the school list at this stage."} ${detail}. ${laterLabel(subject)} ${laterOn ? "marked" : "not marked"}.`;
  const marks = stepKeys.map((key, index) => {
    const on = !!parts[key];
    const hand = !!byHand[key];
    const locked = !!fromLesson[key];
    return `<button type="button" class="pip step ${on ? "on" : ""} ${hand ? "hand" : ""}" data-action="toggle-hand" data-student="${esc(student.id)}" data-code="${esc(code)}" data-box="${key}" aria-label="${esc(stepNames[index])} ${esc(student.english)} ${esc(code)}" aria-pressed="${on ? "true" : "false"}" title="${esc(locked && !hand ? "Saved from a lesson" : "Click to mark by hand")}"></button>`;
  }).join("");
  return `<td class="heat-cell" title="${esc(title)}"><span class="pips"><i class="pip syllabus ${onSchool ? "on" : "off"}"></i>${marks}<button type="button" class="pip later ${laterOn ? "on" : ""}" data-action="toggle-later" data-student="${esc(student.id)}" data-code="${esc(code)}" data-kind="${kind}" aria-label="${esc(laterLabel(subject))} ${esc(student.english)} ${esc(code)}" aria-pressed="${laterOn ? "true" : "false"}"></button></span></td>`;
}

function heatHeads(codes) {
  if (!codes.length) return `<th class="topic quiet">—</th>`;
  return codes.map((code) => {
    const topic = topicByCode(code);
    return `<th class="topic"><strong>${esc(code)}</strong><span>${esc(topic ? topic.name : "")}</span></th>`;
  }).join("");
}

function heatSlice(students, subject, codes, withFacts) {
  const rows = students.map((student) => {
    const note = subject === "chem" ? String(student.schoolTopic || "").trim() : "";
    const remark = String(student.remark || "").trim();
    const cells = codes.map((code) => heatCell(student, subject, code)).join("");
    const facts = withFacts ? `<td class="heat-note">${esc(remark || "—")}</td><td class="heat-note">${esc(testFact(student, subject))}</td><td><button type="button" class="btn small" data-action="copy-student-record" data-student="${esc(student.id)}">Copy</button></td>` : "";
    return `<tr>
      <th>${esc(student.english)}<span>${esc(student.school)} ${esc(student.form)}</span>${note ? `<span>${esc(note)}</span>` : ""}</th>
      ${cells}${facts}
    </tr>`;
  }).join("");
  const factHead = withFacts ? `<th>Remark</th><th>Test</th><th></th>` : "";
  return `<table class="heat">
    <thead>
      <tr><th>Name</th>${heatHeads(codes)}${factHead}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function heatTable(students, subject, opts = {}) {
  const known = new Set(heatCodes(students, subject));
  const bands = topicGroups(subject).map((group) => ({
    group,
    codes: group.topics.map((topic) => topic.code).filter((code) => known.has(code)),
  })).filter((item) => item.codes.length)
    .filter((item) => !opts.sem || semesterOfGroup(subject, item.group.group) === opts.sem);
  if (!bands.length) return opts.sem ? `<p class="meta">No Sem ${esc(opts.sem)} topic on this day.</p>` : heatSlice(students, subject, [], true);
  return `<div class="band-stack">${bands.map((item, index) => {
    const key = `${subject}:${item.group.group}`;
    const hidden = opts.collapsible && ui.hiddenGroups[key];
    const head = opts.collapsible
      ? `<div class="band-head"><h3>${esc(item.group.group)} ${esc(item.group.name)}</h3><button type="button" class="btn small ghost" data-action="toggle-group" data-group="${esc(key)}">${hidden ? "Show" : "Hide"}</button></div>`
      : `<h3>${esc(item.group.group)} ${esc(item.group.name)}</h3>`;
    const table = hidden ? "" : `<div class="heat-wrap">${heatSlice(students, subject, item.codes, index === 0)}</div>`;
    return `<section class="heat-band${hidden ? " is-hidden" : ""}">${head}${table}</section>`;
  }).join("")}</div>`;
}

function dayGroups(students) {
  const known = listedDays();
  const groups = known.map((day) => ({
    day,
    people: students.filter((student) => student.day === day),
  })).filter((group) => group.people.length);
  const loose = students.filter((student) => !known.includes(student.day));
  if (loose.length) groups.push({ day: "", people: loose });
  return groups;
}

function visibleDayGroups(students) {
  const groups = dayGroups(students);
  if (!groups.length || ui.progressExpand) return groups;
  const day = groups.some((group) => group.day === ui.progressDay) ? ui.progressDay : groups[0].day;
  ui.progressDay = day;
  return groups.filter((group) => group.day === day);
}

function dashBody(students, subject) {
  const shown = subject || progressSubject();
  const groups = visibleDayGroups(students);
  if (!groups.length) return `<p class="meta">No student.</p>`;
  return groups.map((group) => `<section class="day-block">
    <h2>${esc(group.day ? dayLabel(group.day) : "No day")} <span>${group.people.length}</span></h2>
    <div class="people-grid">${group.people.map((student) => personPanel(student, shown)).join("")}</div>
  </section>`).join("");
}

function personPanel(student, subject, forPrint) {
  const bag = compareTopics(student, subject);
  const codes = bag.codes.filter((code) => topicSemester(student, subject, code) === ui.progressSem);
  const hidden = !!ui.hiddenGroups[student.id];
  const note = subject === "chem" ? String(student.schoolTopic || "").trim() : "";
  const remark = String(student.remark || "");
  const topics = hidden ? "" : (codes.length ? codes.map((code, index) => {
    const topic = topicByCode(code);
    const when = gateLabel(gateOf(student, subject, code));
    const cell = heatCell(student, subject, code).replace(/^<td[^>]*>/, "").replace(/<\/td>$/, "");
    return `<div class="person-topic"><div><strong>${index + 1}. ${esc(code)} ${esc(topic ? topic.name : "")}</strong>${when ? `<span>${esc(when)}</span>` : ""}</div>${cell}</div>`;
  }).join("") : `<p class="meta">No topic in Sem ${esc(ui.progressSem)}.</p>`);
  const remarkLine = forPrint
    ? `<span>Remark ${esc(remark.trim() || "—")}</span>`
    : `<label class="remark-line">Remark <input class="bare" data-field="remark" data-student="${esc(student.id)}" value="${esc(remark)}" placeholder="Add a remark"></label>`;
  return `<article class="person-panel${hidden ? " is-hidden" : ""}">
    <header class="panel-head">
      <div>
        <strong>${esc(student.english)}</strong>
        <span>${esc(student.school)} ${esc(student.form)}</span>
        ${note ? `<span>${esc(note)}</span>` : ""}
      </div>
      <div class="row">
        <button type="button" class="btn small ghost" data-action="toggle-person" data-student="${esc(student.id)}">${hidden ? "Show" : "Hide"}</button>
        <button type="button" class="btn small" data-action="copy-student-record" data-student="${esc(student.id)}">Copy</button>
      </div>
    </header>
    ${topics}
    <div class="person-facts">${remarkLine}<span>Test ${esc(testFact(student, subject))}</span></div>
  </article>`;
}

function renderProgress() {
  const subject = progressSubject();
  const finish = subject === "bio"
    ? "A Bio class finishes when concepts, intro ex, and exp ex are done."
    : "A Chem class finishes when concepts and exp ex are done.";
  const students = progressStudents();
  const days = dayGroups(students);
  if (!ui.progressExpand && days.length && !days.some((group) => group.day === ui.progressDay)) ui.progressDay = days[0].day;
  return `<main class="wrap wide">
    <div class="page-head">
      <div>
        <h1>Progress</h1>
        <p class="lede">${finish}</p>
      </div>
    </div>
    <div class="actionbar">
      <div class="group pills tabs">
        <a href="#progress/chem" class="${subject === "chem" ? "on" : ""}">Chem</a>
        <a href="#progress/bio" class="${subject === "bio" ? "on" : ""}">Bio</a>
      </div>
      <div class="group pills tabs">
        <button type="button" class="${ui.progressSem === "1" ? "on" : ""}" data-action="set-progress-sem" data-sem="1">Sem 1</button>
        <button type="button" class="${ui.progressSem === "2" ? "on" : ""}" data-action="set-progress-sem" data-sem="2">Sem 2</button>
      </div>
      <div class="group pills">
        ${dayGroups(students).map((group) => `<button type="button" class="${!ui.progressExpand && group.day === ui.progressDay ? "on" : ""}" data-action="set-progress-day" data-day="${esc(group.day)}">${esc(group.day ? dayLabel(group.day) : "No day")}</button>`).join("")}
        <button type="button" class="${ui.progressExpand ? "on" : ""}" data-action="toggle-progress-expand" aria-pressed="${ui.progressExpand ? "true" : "false"}">Expand</button>
      </div>
      <input class="find" data-field="find-student" value="${esc(ui.findStudent)}" placeholder="Name or school" aria-label="Find a student">
      <div class="group push">
        <button type="button" class="btn" data-action="copy-all-records">Copy shown</button>
        <button type="button" class="btn" data-action="print">Print</button>
      </div>
    </div>
    <div class="legend" id="dash-legend">${dashLegend(subject)}</div>
    <div id="dash-body">${dashBody(students)}</div>
  </main>`;
}

function dayFilter() {
  return `<div class="pills">
    ${[["all", "All"]].concat(listedDays().map((day) => [day, dayLabel(day)])).map(([id, label]) => `<button type="button" class="${ui.sylDay === id ? "on" : ""}" data-action="set-day" data-day="${id}">${label}</button>`).join("")}
  </div>`;
}

function syllabusColumns(subject) {
  const base = pinnedTopics(subject);
  const extra = new Set();
  for (const bag of Object.values(state.manual)) Object.keys(bag).forEach((code) => extra.add(code));
  state.contributions.forEach((c) => extra.add(c.code));
  const more = TOPICS.filter((t) => t.subject === subject && extra.has(t.code) && !base.some((b) => b.code === t.code));
  const all = base.concat(more);
  if (ui.sylGroup === "all") return all;
  return all.filter((t) => t.group === ui.sylGroup);
}

function classmates(student) {
  const school = String(student.school || "").trim().toUpperCase();
  const form = String(student.form || "").trim().toUpperCase();
  return state.students.filter((item) => (
    item.active
    && String(item.school || "").trim().toUpperCase() === school
    && String(item.form || "").trim().toUpperCase() === form
  ));
}

function syllabusGroups() {
  const visible = state.students.filter((s) => s.active && (ui.sylDay === "all" || s.day === ui.sylDay));
  const seen = new Set();
  const groups = [];
  visible.forEach((student) => {
    const key = `${String(student.school || "").trim().toUpperCase()}|${String(student.form || "").trim().toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    groups.push(classmates(student));
  });
  return groups;
}

function syllabusTable(subject, topics, groupsOfStudents) {
  const head = topics.map((topic) => `<th class="topic-head" title="${esc(topic.code)} ${esc(topic.name)}"><strong>${esc(topic.code)}</strong><span>${esc(topic.name)}</span></th>`).join("");
  const body = groupsOfStudents.map((people) => {
    const ids = people.map((student) => student.id).join(",");
    const cells = topics.map((topic) => {
      const listed = people.length > 0 && people.every((student) => syllabusCodesOf(student, subject).includes(topic.code));
      const sems = people.map((student) => topicSemester(student, subject, topic.code));
      const sharedSem = listed && sems.every((sem) => sem === sems[0]) ? sems[0] : "";
      const buttons = SYLLABUS_GATES.map((gate) => {
        const count = people.filter((student) => gateOf(student, subject, topic.code) === gate.id).length;
        const on = count === people.length && count > 0;
        const partial = count > 0 && count < people.length;
        const hinted = !on && !partial && ((sharedSem === "1" && gate.id === "s1ut") || (sharedSem === "2" && gate.id === "s2ut"));
        const stateClass = on ? "tick" : partial ? "partial" : hinted ? "tick" : "";
        const label = hinted ? (sharedSem === "2" ? "Sem 2" : "Sem 1") : gate.label;
        return `<button type="button" class="mark gate ${stateClass}" data-action="toggle-gate" data-students="${esc(ids)}" data-subject="${subject}" data-code="${esc(topic.code)}" data-gate="${gate.id}" aria-pressed="${on || hinted ? "true" : "false"}" aria-label="${esc(label)} ${esc(topic.code)} ${esc(topic.name)}" title="${esc(label)}">${on || hinted ? "✓" : partial ? "–" : ""}</button>`;
      }).join("");
      return `<td class="gates">${buttons}</td>`;
    }).join("");
    const title = people.length === 1
      ? `<strong>${esc(people[0].english)}</strong><span class="sub">${esc(people[0].school)}</span>`
      : `<strong>${esc(people.map((student) => student.english).join(", "))}</strong><span class="sub">${esc(people[0].school)} ${esc(people[0].form)}</span>`;
    return `<tr><td class="sticky">${title}</td>${cells}</tr>`;
  }).join("");
  return `<div class="syl-wrap"><table class="syl-table">
    <thead><tr><th class="sticky">Student</th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function topicSelect(subject, selected, field, ids, kind) {
  const options = pinnedTopics(subject).map((topic) => {
    const on = topic.code === selected ? " selected" : "";
    return `<option value="${esc(topic.code)}"${on}>${esc(topic.code)} ${esc(topic.name)}</option>`;
  }).join("");
  return `<select class="bare" data-field="${field}" data-students="${esc(ids)}" data-subject="${subject}" data-kind="${esc(kind)}" aria-label="${field === "test-from" ? "Range start" : "Range end"}"><option value="">—</option>${options}</select>`;
}

function testBoard(subject, groupsOfStudents) {
  if (!groupsOfStudents.length) return "";
  const cards = groupsOfStudents.map((people) => {
    const ids = people.map((student) => student.id).join(",");
    const title = people.length === 1
      ? people[0].english
      : `${people[0].school} ${people[0].form}`;
    const who = people.map((student) => student.english).join(", ");
    const lines = SYLLABUS_GATES.map((gate) => {
      const when = sharedTestDate(people, subject, gate.id);
      const range = sharedTestRange(people, subject, gate.id);
      return `<div class="test-line">
        <b>${esc(gate.short)}</b>
        <input class="bare" type="date" data-field="test-date" data-students="${esc(ids)}" data-subject="${subject}" data-kind="${esc(gate.id)}" value="${esc(when.date)}" aria-label="${esc(gate.short)} date">
        ${topicSelect(subject, range.from, "test-from", ids, gate.id)}
        <span>to</span>
        ${topicSelect(subject, range.to, "test-to", ids, gate.id)}
        <span class="range">${esc(when.mixed || range.mixed ? "Different in this class" : range.label)}</span>
        <button type="button" class="btn small ghost" data-action="clear-test" data-students="${esc(ids)}" data-subject="${subject}" data-kind="${esc(gate.id)}">Clear</button>
      </div>`;
    }).join("");
    return `<article class="test-card"><header><strong>${esc(title)}</strong><span>${esc(who)}</span></header>${lines}</article>`;
  }).join("");
  return `<section class="test-board">
    <p class="meta">Date is the schedule. From and to is the range. Same school and form share one row. This does not change the lesson plan.</p>
    <div class="test-list">${cards}</div>
  </section>`;
}

function syllabusMark(people, subject, code) {
  const listed = people.length > 0 && people.every((student) => syllabusCodesOf(student, subject).includes(code));
  if (!listed) return "";
  const sems = people.map((student) => topicSemester(student, subject, code));
  if (sems.every((sem) => sem === "2")) return "S2";
  if (sems.every((sem) => sem === "1")) return "S1";
  return "✓";
}

function renderSyllabusPrint() {
  const subject = ui.sylSubject === "bio" ? "bio" : "chem";
  const tests = ui.sylTab === "tests";
  const groupsOfStudents = syllabusGroups();
  const day = ui.sylDay === "all" ? "All days" : dayLabel(ui.sylDay);
  if (tests) {
    return `<section class="print-sheet"><h1>${esc(subjectLabel(subject))} test dates</h1><p>${esc(day)}</p>${testBoard(subject, groupsOfStudents)}</section>`;
  }
  const blocks = syllabusTopicGroups(subject).map((group) => {
    const head = group.topics.map((topic) => `<th>${esc(topic.code)}<span>${esc(topic.name)}</span></th>`).join("");
    const rows = groupsOfStudents.map((people) => {
      const name = people.length === 1 ? people[0].english : people.map((student) => student.english).join(", ");
      const cells = group.topics.map((topic) => `<td>${esc(syllabusMark(people, subject, topic.code))}</td>`).join("");
      return `<tr><th>${esc(name)}<span>${esc(people[0].school)} ${esc(people[0].form)}</span></th>${cells}</tr>`;
    }).join("");
    return `<section class="syl-block"><h2>${esc(group.group)} ${esc(group.name)}</h2><table><thead><tr><th>Student</th>${head}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join("");
  return `<section class="print-sheet"><h1>${esc(subjectLabel(subject))} syllabus</h1><p>${esc(day)}. S1 is Sem 1. S2 is Sem 2.</p>${blocks}</section>`;
}

function renderProgressPrint() {
  const subject = progressSubject();
  const sem = ui.progressSem === "2" ? "2" : "1";
  const days = visibleDayGroups(progressStudents());
  const body = days.map((group) => `<section class="syl-block"><h2>${esc(group.day ? dayLabel(group.day) : "No day")} · Sem ${esc(sem)}</h2><div class="people-grid">${group.people.map((student) => personPanel(student, subject, true)).join("")}</div></section>`).join("");
  return `<section class="print-sheet"><h1>${esc(subjectLabel(subject))} progress</h1><div class="legend">${dashLegend(subject)}</div>${body}</section>`;
}

function renderSyllabus() {
  const subject = ui.sylSubject === "bio" ? "bio" : "chem";
  const tests = ui.sylTab === "tests";
  const groupsOfStudents = syllabusGroups();
  const blocks = `<div class="group-grid">${syllabusTopicGroups(subject).map((group) => `<section class="sem-block">
    <h3>${esc(group.group)} ${esc(group.name)}</h3>
    ${syllabusTable(subject, group.topics, groupsOfStudents)}
  </section>`).join("")}</div>`;
  const lede = tests
    ? "Date is the schedule. From and to is the range. Same school and form share a row."
    : "Click topics in the order the school teaches them. Progress keeps that order. A Sem 1 mark stays on Sem 1, and a Sem 2 mark stays on Sem 2. Same school and form share a row.";
  return `<main class="wrap wide">
    <div class="page-head">
      <div>
        <h1>${esc(subjectLabel(subject))} ${tests ? "test dates" : "syllabus"}</h1>
        <p class="lede">${lede}</p>
      </div>
    </div>
    <div class="actionbar">
      <div class="group pills tabs">
        <button type="button" class="${tests ? "" : "on"}" data-action="set-syl-tab" data-tab="syll">Syllabus</button>
        <button type="button" class="${tests ? "on" : ""}" data-action="set-syl-tab" data-tab="tests">Test dates</button>
      </div>
      <div class="group pills">
        <button type="button" class="${subject === "chem" ? "on" : ""}" data-action="set-subject" data-subject="chem">Chem</button>
        <button type="button" class="${subject === "bio" ? "on" : ""}" data-action="set-subject" data-subject="bio">Bio</button>
      </div>
      ${dayFilter()}
      <div class="group push">
        <button type="button" class="btn" data-action="print">Print</button>
      </div>
    </div>
    ${tests ? testBoard(subject, groupsOfStudents) : blocks}
  </main>`;
}

function renderStudents() {
  const active = state.students.filter((s) => s.active);
  const archived = state.students.filter((s) => !s.active);
  const editing = ui.editId ? studentById(ui.editId) : null;
  const ask = ui.askQuit ? studentById(ui.askQuit) : null;
  return `<main class="wrap">
    <div class="page-head">
      <div><h1>Names</h1><p class="lede">Add or remove a student. The copy format stays <span id="name-sample">何 浚軒 Nathan (QES) S3</span>. <a href="#backup">Backup</a></p></div>
    </div>
    <div class="grid-2">
      <form id="student-form" class="card">
        <h2>${editing ? "Edit student" : "Add student"}</h2>
        <div class="form-grid" style="margin-top:10px">
          <label class="field">Chinese name <input class="bare" name="chinese" required value="${esc(editing ? editing.chinese : "")}"></label>
          <label class="field">English name <input class="bare" name="english" required value="${esc(editing ? editing.english : "")}"></label>
          <label class="field">School <input class="bare" name="school" required maxlength="8" value="${esc(editing ? editing.school : "")}"></label>
          <label class="field">Form <input class="bare" name="form" required value="${esc(editing ? editing.form : "S3")}"></label>
        </div>
        <label class="field" style="margin-top:8px">Day
          <select class="bare" name="day">
            ${DAY_ORDER.map((day) => `<option value="${day}" ${(editing ? editing.day : "sat") === day ? "selected" : ""}>${dayLabel(day)}</option>`).join("")}
          </select>
        </label>
        <p class="preview-name">Preview <strong id="name-preview"></strong></p>
        <div class="row">
          <button class="btn primary" type="submit">${editing ? "Save student" : "Add student"}</button>
          ${editing ? `<button class="btn ghost" type="button" data-action="cancel-edit">Cancel</button>` : ""}
        </div>
      </form>
      <div>
        <div class="student-list">
          ${active.map((s) => `<div class="card student-line">
            <div class="student-main">
              <strong>${esc(displayName(s))}</strong>
              <span class="sub">${esc(dayLabel(s.day))}${s.joined ? ` · From ${esc(prettyDate(s.joined).replace(/^[A-Za-z]+ /, ""))}` : ""}</span>
              <label class="remark-line">Remark <input class="bare" data-field="remark" data-student="${esc(s.id)}" value="${esc(s.remark || "")}" placeholder="Add a remark"></label>
            </div>
            <div class="row">
              <button type="button" class="btn small" data-action="copy-name" data-student="${esc(s.id)}">Copy</button>
              <button type="button" class="btn small" data-action="edit-student" data-student="${esc(s.id)}">Edit</button>
              <button type="button" class="btn small danger" data-action="ask-quit" data-student="${esc(s.id)}">Quit</button>
            </div>
          </div>`).join("")}
        </div>
        ${ask ? `<div class="warn" style="margin-top:10px">
          <p>Quit ${esc(ask.english)}? They leave future lessons. Past records stay.</p>
          <div class="row" style="margin-top:8px">
            <button type="button" class="btn small danger" data-action="confirm-quit" data-student="${esc(ask.id)}">Quit</button>
            <button type="button" class="btn small" data-action="cancel-quit">Keep</button>
          </div>
        </div>` : ""}
        ${archived.length ? `<h2 style="margin-top:16px">Quit</h2>` : ""}
        ${archived.map((s) => `<div class="card student-line" style="margin-top:8px">
          <span>${esc(displayName(s))}</span>
          <button type="button" class="btn small" data-action="restore-student" data-student="${esc(s.id)}">Restore</button>
        </div>`).join("")}
      </div>
    </div>
  </main>`;
}

function renderBackup() {
  return `<main class="wrap">
    <div class="page-head">
      <div>
        <h1>Backup</h1>
        <p class="lede">Records stay in this browser. Copy the backup if you might open the page from another address, or before clearing the browser.</p>
      </div>
    </div>
    <div class="card">
      <div class="row">
        <button type="button" class="btn teal" data-action="copy-backup">Copy backup</button>
      </div>
      <label class="field" style="margin-top:12px">Paste a backup here
        <textarea class="bare" id="backup-in" rows="8" placeholder="Paste the backup text"></textarea>
      </label>
      <button type="button" class="btn" style="margin-top:8px" data-action="restore-backup">Restore backup</button>
    </div>
  </main>`;
}

function updateNamePreview() {
  const form = document.getElementById("student-form");
  const el = document.getElementById("name-preview");
  if (!form || !el) return;
  const chinese = form.chinese.value.trim();
  const english = form.english.value.trim();
  const school = form.school.value.trim().toUpperCase();
  const formName = form.form.value.trim();
  el.textContent = chinese && english && school ? `${chinese} ${english} (${school}) ${formName}` : "Chinese English (SCH) S3";
}

function searchResultsHtml(subject, query, streamId) {
  const stream = lessonFromHash()?.streams.find((s) => s.id === streamId);
  const taken = new Set(stream ? stream.topicCodes : []);
  const hits = searchTopics(subject, query).filter((t) => !taken.has(t.code));
  if (!hits.length) return `<p class="meta" style="padding:8px">No topic.</p>`;
  return hits.map((t) => `<button type="button" data-action="add-topic" data-stream="${esc(streamId)}" data-code="${esc(t.code)}"><strong>${esc(t.code)}</strong> ${esc(t.name)}<br><small>${esc(t.groupName)}</small></button>`).join("");
}

function hwResultsHtml(subject, query, streamId) {
  const hits = searchTopics(subject, query);
  if (!hits.length) return `<p class="meta" style="padding:8px">No topic.</p>`;
  return hits.map((t) => `<button type="button" data-action="set-hw-topic" data-stream="${esc(streamId)}" data-code="${esc(t.code)}"><strong>${esc(t.code)}</strong> ${esc(t.name)}<br><small>${esc(t.groupName)}</small></button>`).join("");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.hidden = false;
  el.textContent = msg;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 1600);
}

function flashButton(button, label) {
  if (!button) return;
  const previous = button.textContent;
  button.textContent = label;
  setTimeout(() => { if (button.isConnected) button.textContent = previous; }, 1600);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  flashButton(button, "Copied");
  toast("Copied");
}

function individualBundle(lesson) {
  return buildOutputs(lesson).individuals.map((item) => `${item.name}\n${item.text}`).join("\n\n");
}

function onClick(e) {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) {
    const zone = e.target.closest("[data-drop='stream']");
    const lesson = lessonFromHash();
    if (zone && lesson && ui.picked && !e.target.closest("button, input, textarea, a")) {
      placeStudent(lesson, ui.picked, zone.dataset.stream);
      ui.picked = null;
      draw();
    }
    return;
  }
  const action = actionEl.dataset.action;
  const lesson = (actionEl.dataset.lesson && state.lessons[actionEl.dataset.lesson]) || lessonFromHash();
  if (action === "print") {
    const page = parseHash().page;
    const previous = document.title;
    if (page === "syllabus") {
      const subject = ui.sylSubject === "bio" ? "Bio" : "Chem";
      document.title = ui.sylTab === "tests" ? `${subject} test dates` : `${subject} syllabus`;
    }
    if (page === "progress") {
      const subject = progressSubject() === "bio" ? "Bio" : "Chem";
      document.title = `${subject} progress Sem ${ui.progressSem === "2" ? "2" : "1"}`;
    }
    if (page === "progress") draw({ keepScroll: true });
    if (page === "syllabus" || page === "progress") {
      const restore = () => {
        document.title = previous;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
    }
    window.print();
    return;
  }
  if (action === "print-week") {
    ui.printTarget = "week";
    draw();
    const previous = document.title;
    document.title = `Pre-class ${weekRangeLabel(state.saturday)}`;
    const restore = () => {
      document.title = previous;
      ui.printTarget = "";
      window.removeEventListener("afterprint", restore);
      draw();
    };
    window.addEventListener("afterprint", restore);
    window.print();
    return;
  }
  if (action === "toggle-glance") { ui.showGlance = !ui.showGlance; draw(); return; }
  if (action === "show-add-extra") { ui.addExtra = true; ui.addDay = false; draw(); return; }
  if (action === "hide-add-extra") { ui.addExtra = false; draw(); return; }
  if (action === "remove-extra" && lesson && lesson.extra) {
    state.contributions = state.contributions.filter((item) => item.lessonId !== lesson.id);
    delete state.lessons[lesson.id];
    persist();
    location.hash = "#week";
    return;
  }
  if (action === "show-add-day") { ui.addDay = true; ui.addExtra = false; draw(); return; }
  if (action === "hide-add-day") { ui.addDay = false; draw(); return; }
  if (action === "remove-day") {
    const day = actionEl.dataset.day;
    if (!SLOTS.some((slot) => slot.day === day)) {
      state.slots = (state.slots || []).filter((slot) => slot.day !== day);
      persist();
    }
    draw();
    return;
  }
  if (action === "week-shift" || action === "cal-shift") {
    const delta = Number(actionEl.dataset.delta) || 0;
    const view = ui.calView === "month" || ui.calView === "year" || ui.calView === "sem" ? ui.calView : "week";
    if (action === "week-shift" || view === "week") {
      state.saturday = addDays(state.saturday, action === "week-shift" ? delta : delta * 7);
      ui.calDate = state.saturday;
    } else if (view === "month") {
      const d = parseIso(calendarAnchor());
      ui.calDate = iso(new Date(d.getFullYear(), d.getMonth() + delta, 1));
      state.saturday = thisSaturday(parseIso(ui.calDate));
    } else {
      const d = parseIso(calendarAnchor());
      ui.calDate = iso(new Date(d.getFullYear() + delta, d.getMonth(), 1));
      state.saturday = thisSaturday(parseIso(ui.calDate));
    }
    persist();
    draw({ keepScroll: false });
    return;
  }
  if (action === "set-cal-view") {
    const next = actionEl.dataset.view;
    ui.calView = next === "month" || next === "year" || next === "sem" ? next : "week";
    if (!ui.calDate) ui.calDate = state.saturday;
    if (ui.calView === "week") ui.calDate = state.saturday;
    draw({ keepScroll: false });
    return;
  }
  if (action === "set-rough-sem") {
    ui.roughSem = actionEl.dataset.sem === "2" ? "2" : "1";
    draw();
    return;
  }
  if (action === "set-rough-subject") {
    ui.roughSubject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    draw();
    return;
  }
  if (action === "queue-topic") {
    const subject = ui.roughSubject === "bio" ? "bio" : "chem";
    const code = actionEl.dataset.code;
    if (code) roughQueue(subject).push(code);
    persist();
    draw();
    return;
  }
  if (action === "unqueue-topic") {
    const subject = ui.roughSubject === "bio" ? "bio" : "chem";
    const index = Number(actionEl.dataset.index);
    const queue = roughQueue(subject);
    if (index >= 0 && index < queue.length) queue.splice(index, 1);
    persist();
    draw();
    return;
  }
  if (action === "clear-queue") {
    const subject = ui.roughSubject === "bio" ? "bio" : "chem";
    roughQueue(subject).splice(0);
    persist();
    draw();
    return;
  }
  if (action === "clear-term-plan") {
    const subject = ui.roughSubject === "bio" ? "bio" : "chem";
    const range = termRange(ui.roughSem === "2" ? "2" : "1");
    roughQueue(subject).splice(0);
    if (!state.termPlan) state.termPlan = {};
    activeDays().forEach((day) => {
      datesForWeekday(day, range.start, range.end).forEach((date) => {
        delete state.termPlan[termKey(date, subject)];
      });
    });
    persist();
    draw();
    toast("Semester topics cleared");
    return;
  }
  if (action === "fill-rough") {
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const day = actionEl.dataset.day;
    const queue = roughQueue(subject);
    if (!queue.length) { toast("Click topics in the order you will teach"); return; }
    const range = termRange(ui.roughSem === "2" ? "2" : "1");
    const dates = datesForWeekday(day, range.start, range.end);
    dates.forEach((date, index) => {
      if (queue[index]) placeRoughTopic(date, subject, queue[index]);
    });
    persist();
    draw();
    toast("Semester suggestion saved");
    return;
  }
  if (action === "toggle-plan-split") {
    const date = actionEl.dataset.date;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    editTermPlan(date, subject, (plan) => {
      if (plan.split) {
        plan.split = false;
        plan.groups = [plan.groups[0] || { topics: [], tutorial: false }];
      } else {
        plan.split = true;
        if (plan.groups.length < 2) plan.groups.push({ topics: [], tutorial: false });
      }
    });
    persist();
    draw();
    return;
  }
  if (action === "add-plan-group") {
    const date = actionEl.dataset.date;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    editTermPlan(date, subject, (plan) => {
      plan.split = true;
      plan.groups.push({ topics: [], tutorial: false });
    });
    persist();
    draw();
    return;
  }
  if (action === "remove-plan-group") {
    const date = actionEl.dataset.date;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const index = Number(actionEl.dataset.group);
    editTermPlan(date, subject, (plan) => {
      if (plan.groups.length < 2) return;
      plan.groups.splice(index, 1);
      if (plan.groups.length < 2) plan.split = false;
    });
    persist();
    draw();
    return;
  }
  if (action === "remove-plan-topic") {
    const date = actionEl.dataset.date;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const index = Number(actionEl.dataset.group);
    const code = actionEl.dataset.code;
    editTermPlan(date, subject, (plan) => {
      const group = plan.groups[index];
      if (!group) return;
      if (code === "tutorial") group.tutorial = false;
      else group.topics = group.topics.filter((item) => item !== code);
    });
    persist();
    draw();
    return;
  }
  if (action === "print-sem") {
    const previous = document.title;
    const subject = ui.roughSubject === "bio" ? "Bio" : "Chem";
    const sem = ui.roughSem === "2" ? "2" : "1";
    document.title = `${subject} Sem ${sem} timetable plan`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    return;
  }
  if (action === "open-month") {
    ui.calView = "month";
    ui.calDate = actionEl.dataset.date || state.saturday;
    state.saturday = thisSaturday(parseIso(ui.calDate));
    persist();
    draw({ keepScroll: false });
    return;
  }
  if (action === "open-slot") {
    const date = actionEl.dataset.date;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const slot = allSlots().find((item) => item.day === weekdayKey(date) && item.subject === subject);
    if (!slot || !date) return;
    const lesson = ensureLesson(slot, date);
    location.hash = `#lesson/${encodeURIComponent(lesson.id)}`;
    return;
  }
  if (action === "add-stream" && lesson) {
    const stream = blankStream();
    if (lesson.extra) stream.extra = true;
    lesson.streams.push(stream);
    touch(lesson);
    draw();
    return;
  }
  if (action === "delete-stream" && lesson) {
    lesson.streams = lesson.streams.filter((s) => s.id !== actionEl.dataset.stream);
    touch(lesson);
    draw();
    return;
  }
  if (action === "set-mode" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) stream.mode = actionEl.dataset.mode;
    touch(lesson);
    draw();
    return;
  }
  if (action === "set-hw-type" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) {
      stream.hwType = stream.hwType === actionEl.dataset.type ? "" : actionEl.dataset.type;
      stream.hw = !!(stream.hwCode && stream.hwType);
    }
    touch(lesson);
    draw();
    return;
  }
  if (action === "set-hw-topic" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) {
      stream.hwCode = actionEl.dataset.code;
      stream.hw = !!(stream.hwCode && stream.hwType);
    }
    touch(lesson);
    draw();
    return;
  }
  if (action === "clear-hw" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) {
      stream.hwCode = "";
      stream.hwType = "";
      stream.hw = false;
    }
    touch(lesson);
    draw();
    return;
  }
  if ((action === "toggle-extra" || action === "toggle-hw") && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) stream[action === "toggle-extra" ? "extra" : "hw"] = !stream[action === "toggle-extra" ? "extra" : "hw"];
    touch(lesson);
    draw();
    return;
  }
  if (action === "toggle-more") {
    ui.moreStream = ui.moreStream === actionEl.dataset.stream ? null : actionEl.dataset.stream;
    draw();
    return;
  }
  if (action === "toggle-expand") {
    ui.expandTopics = !ui.expandTopics;
    draw();
    return;
  }
  if (action === "add-topic" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream && !stream.topicCodes.includes(actionEl.dataset.code)) stream.topicCodes.push(actionEl.dataset.code);
    touch(lesson);
    draw();
    return;
  }
  if (action === "remove-topic" && lesson) {
    const stream = lesson.streams.find((s) => s.id === actionEl.dataset.stream);
    if (stream) stream.topicCodes = stream.topicCodes.filter((code) => code !== actionEl.dataset.code);
    touch(lesson);
    draw();
    return;
  }
  if (action === "add-all" && lesson) {
    const streamId = actionEl.dataset.stream;
    if (!lesson.streams.some((stream) => stream.id === streamId)) return;
    const pool = lesson.extra ? dayStudents(lesson) : roster(lesson);
    const placed = new Set(lesson.streams.flatMap((stream) => stream.studentIds));
    pool.forEach((student) => {
      if (isAbs(lesson, student.id) || placed.has(student.id)) return;
      placeStudent(lesson, student.id, streamId);
    });
    ui.picked = null;
    draw();
    return;
  }
  if (action === "place-picked" && lesson) {
    if (!ui.picked) { toast("Select a student first"); return; }
    placeStudent(lesson, ui.picked, actionEl.dataset.stream);
    ui.picked = null;
    draw();
    return;
  }
  if (action === "pick-student") {
    ui.picked = ui.picked === actionEl.dataset.student ? null : actionEl.dataset.student;
    draw();
    return;
  }
  if (action === "unassign" && lesson) {
    placeStudent(lesson, actionEl.dataset.student, null);
    draw();
    return;
  }
  if (action === "toggle-abs" && lesson) {
    const id = actionEl.dataset.student;
    if (isAbs(lesson, id)) delete lesson.attendance[id];
    else {
      lesson.attendance[id] = "abs";
      placeStudent(lesson, id, null);
    }
    touch(lesson);
    draw();
    return;
  }
  if (action === "clear-topics" && lesson) {
    wipeTeaching(lesson, false);
    draw();
    return;
  }
  if (action === "ask-remove-taught") {
    ui.reviewRemove = actionEl.dataset.lesson || "";
    draw();
    return;
  }
  if (action === "cancel-remove-taught") {
    ui.reviewRemove = "";
    draw();
    return;
  }
  if (action === "confirm-remove-taught") {
    const target = state.lessons[actionEl.dataset.lesson];
    if (!target) return;
    wipeTeaching(target, true);
    ui.reviewRemove = "";
    draw();
    toast("Taught lesson removed");
    return;
  }
  if (action === "confirm" && lesson) {
    const issue = problems(lesson);
    if (issue.blocking.length) { draw(); toast("Add a topic to every stream that has students"); return; }
    if (issue.unassigned.length) { ui.warnLesson = lesson.id; draw(); return; }
    commitLesson(lesson);
    draw();
    document.getElementById("paste-root")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Lesson saved");
    return;
  }
  if (action === "mark-unassigned-abs" && lesson) {
    for (const student of problems(lesson).unassigned) {
      lesson.attendance[student.id] = "abs";
      placeStudent(lesson, student.id, null);
    }
    commitLesson(lesson);
    draw();
    toast("Lesson saved");
    return;
  }
  if (action === "save-anyway" && lesson) {
    if (problems(lesson).blocking.length) return;
    commitLesson(lesson);
    draw();
    toast("Lesson saved");
    return;
  }
  if (action === "dismiss-warn") { ui.warnLesson = null; draw(); return; }
  if (action === "copy-class" && lesson) { copyText(buildOutputs(lesson).classText); return; }
  if (action === "copy-individuals" && lesson) { copyText(individualBundle(lesson)); return; }
  if (action === "copy-one" && lesson) {
    const item = buildOutputs(lesson).individuals.find((row) => row.studentId === actionEl.dataset.student);
    if (item) copyText(item.text);
    return;
  }
  if (action === "copy-student-record") {
    const student = studentById(actionEl.dataset.student);
    if (!student) return;
    const subject = parseHash().page === "progress" ? progressSubject() : "";
    const rows = studentRecordRows(student, subject);
    if (!rows.length) { flashButton(actionEl, "Nothing saved"); toast("Nothing saved yet"); return; }
    copyText(recordsTsv([student], subject), actionEl);
    return;
  }
  if (action === "copy-all-records") {
    const students = visibleDayGroups(progressStudents()).flatMap((group) => group.people);
    const subject = progressSubject();
    const text = recordsTsv(students, subject);
    if (text.split("\n").length < 2) { flashButton(actionEl, "Nothing saved"); toast("Nothing saved yet"); return; }
    copyText(text, actionEl);
    return;
  }
  if (action === "copy-excel" && lesson) { copyText(buildOutputs(lesson).tsv); return; }
  if (action === "toggle-gate") {
    const ids = String(actionEl.dataset.students || "").split(",").filter(Boolean);
    const people = ids.map(studentById).filter(Boolean);
    if (!people.length) return;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const code = actionEl.dataset.code;
    const gate = actionEl.dataset.gate;
    if (!SYLLABUS_GATES.some((item) => item.id === gate)) return;
    const turnOn = people.some((student) => gateOf(student, subject, code) !== gate);
    const key = subject === "bio" ? "bio" : "chem";
    people.forEach((student) => {
      ensureSyllabus(student);
      const codes = syllabusCodesOf(student, subject);
      const map = student.gates[key];
      const index = codes.indexOf(code);
      if (turnOn) {
        if (index < 0) codes.push(code);
        map[code] = gate;
        setTopicSemester(student, subject, code, gate.startsWith("s2") ? "2" : "1");
      } else {
        delete map[code];
        setTopicSemester(student, subject, code, "");
        if (index >= 0) codes.splice(index, 1);
      }
    });
    persist();
    draw();
    return;
  }
  if (action === "toggle-school") {
    const ids = String(actionEl.dataset.students || actionEl.dataset.student || "").split(",").filter(Boolean);
    const people = ids.map(studentById).filter(Boolean);
    if (!people.length) return;
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const code = actionEl.dataset.code;
    const turnOn = people.some((student) => !syllabusCodesOf(student, subject).includes(code));
    people.forEach((student) => {
      const codes = syllabusCodesOf(student, subject);
      const index = codes.indexOf(code);
      if (turnOn && index < 0) codes.push(code);
      if (!turnOn && index >= 0) codes.splice(index, 1);
    });
    persist();
    draw();
    return;
  }
  if (action === "jump-student") {
    const card = document.getElementById(`pic-${actionEl.dataset.student}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "set-progress-sem") {
    ui.progressSem = actionEl.dataset.sem === "2" ? "2" : "1";
    draw();
    return;
  }
  if (action === "set-progress-day") {
    ui.progressDay = actionEl.dataset.day || "";
    ui.progressExpand = false;
    draw();
    return;
  }
  if (action === "toggle-progress-expand") {
    ui.progressExpand = !ui.progressExpand;
    draw();
    return;
  }
  if (action === "toggle-person") {
    const id = actionEl.dataset.student;
    if (id) ui.hiddenGroups[id] = !ui.hiddenGroups[id];
    const box = document.getElementById("dash-body");
    if (box) box.innerHTML = dashBody(progressStudents(), progressSubject());
    else draw();
    return;
  }
  if (action === "toggle-group") {
    const key = actionEl.dataset.group;
    if (key) ui.hiddenGroups[key] = !ui.hiddenGroups[key];
    const box = document.getElementById("dash-body");
    if (box) box.innerHTML = dashBody(progressStudents(), progressSubject());
    else draw();
    return;
  }
  if (action === "set-dash") {
    ui.dash = actionEl.dataset.dash || "class";
    const box = document.getElementById("dash-body");
    const legend = document.getElementById("dash-legend");
    document.querySelectorAll("[data-action='set-dash']").forEach((button) => {
      button.classList.toggle("on", button.dataset.dash === ui.dash);
    });
    if (legend) legend.innerHTML = dashLegend(progressSubject());
    if (box) box.innerHTML = dashBody(progressStudents(), progressSubject());
    else draw();
    return;
  }
  if (action === "set-day") { ui.sylDay = actionEl.dataset.day; draw(); return; }
  if (action === "set-subject") { ui.sylSubject = actionEl.dataset.subject; ui.sylGroup = "all"; draw(); return; }
  if (action === "set-syl-tab") { ui.sylTab = actionEl.dataset.tab === "tests" ? "tests" : "syll"; draw(); return; }
  if (action === "set-group") { ui.sylGroup = actionEl.dataset.group; draw(); return; }
  if (action === "select-student") {
    ui.sylStudent = ui.sylStudent === actionEl.dataset.student ? null : actionEl.dataset.student;
    draw();
    return;
  }
  if (action === "toggle-later") {
    const studentId = actionEl.dataset.student;
    const code = actionEl.dataset.code;
    const kind = actionEl.dataset.kind;
    if (!state.later) state.later = {};
    if (!state.later[studentId]) state.later[studentId] = {};
    state.later[studentId][code] = state.later[studentId][code] === kind ? "" : kind;
    refreshHandNote();
    persist();
    draw();
    return;
  }
  if (action === "toggle-hand") {
    const studentId = actionEl.dataset.student;
    const code = actionEl.dataset.code;
    const box = actionEl.dataset.box;
    const student = studentById(studentId);
    const topic = topicByCode(code);
    if (!student || !topic || !HAND_BOXES.includes(box)) return;
    const fromLesson = (lessonMarks(student, topic.subject).get(code) || {})[box];
    const fromHand = !!handFlags(studentId, code)[box];
    if (fromLesson && !fromHand) {
      toast("That box is already saved from a lesson.");
      return;
    }
    setHandBox(studentId, code, box, !fromHand);
    persist();
    draw();
    return;
  }
  if (action === "cycle-mark") {
    const order = ["", "concepts", "ex", "both"];
    const current = displayMark(actionEl.dataset.student, actionEl.dataset.code);
    const next = order[(order.indexOf(current) + 1) % order.length];
    setManual(actionEl.dataset.student, actionEl.dataset.code, next);
    persist();
    draw();
    return;
  }
  if (action === "check-visible") {
    const visible = state.students.filter((s) => s.active && (ui.sylDay === "all" || s.day === ui.sylDay));
    const allOn = visible.every((s) => ui.checked[s.id]);
    visible.forEach((s) => { ui.checked[s.id] = !allOn; });
    draw();
    return;
  }
  if (action === "bulk-apply") {
    const raw = document.querySelector("[data-field='bulk-topic']")?.value || "";
    const code = resolveCode(raw);
    if (!code) { toast("Type a topic code first"); return; }
    const ids = Object.keys(ui.checked).filter((id) => ui.checked[id]);
    if (!ids.length) { toast("Select students first"); return; }
    ids.forEach((id) => setManual(id, code, ui.bulkMode));
    persist();
    draw();
    toast("Syllabus updated");
    return;
  }
  if (action === "clear-test") {
    const ids = String(actionEl.dataset.students || "").split(",").filter(Boolean);
    const people = ids.map(studentById).filter(Boolean);
    const subject = actionEl.dataset.subject === "bio" ? "bio" : "chem";
    const kind = actionEl.dataset.kind;
    if (!people.length || !SYLLABUS_GATES.some((item) => item.id === kind)) return;
    setTestDate(people, subject, kind, "");
    clearTestRange(people, subject, kind);
    persist();
    draw();
    return;
  }
  if (action === "copy-syllabus") {
    const student = studentById(actionEl.dataset.student);
    if (student) copyText(schoolSyllabus(student, actionEl.dataset.subject === "bio" ? "bio" : "chem"));
    return;
  }
  if (action === "copy-name") { copyText(displayName(studentById(actionEl.dataset.student))); return; }
  if (action === "edit-student") { ui.editId = actionEl.dataset.student; ui.askQuit = null; draw({ keepScroll: false }); return; }
  if (action === "cancel-edit") { ui.editId = null; draw(); return; }
  if (action === "ask-quit") { ui.askQuit = actionEl.dataset.student; draw(); return; }
  if (action === "cancel-quit") { ui.askQuit = null; draw(); return; }
  if (action === "confirm-quit") {
    const student = studentById(actionEl.dataset.student);
    student.active = false;
    for (const item of Object.values(state.lessons)) {
      if (item.confirmed) continue;
      for (const stream of item.streams) stream.studentIds = stream.studentIds.filter((id) => id !== student.id);
      delete item.attendance[student.id];
    }
    ui.askQuit = null;
    persist();
    draw();
    return;
  }
  if (action === "restore-student") {
    studentById(actionEl.dataset.student).active = true;
    persist();
    draw();
    return;
  }
  if (action === "copy-backup") {
    copyText(JSON.stringify({
      version: 1,
      saturday: state.saturday,
      slots: state.slots || [],
      students: state.students,
      lessons: state.lessons,
      contributions: state.contributions,
      manual: state.manual,
      later: state.later || {},
      hand: state.hand || {},
      handNote: state.handNote || "",
      terms: state.terms || {},
      termPlan: state.termPlan || {},
      termQueue: state.termQueue || { chem: [], bio: [] },
    }, null, 2));
    return;
  }
  if (action === "restore-backup") {
    const raw = document.getElementById("backup-in")?.value || "";
    try {
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.students) || typeof data.lessons !== "object") throw new Error("bad");
      state = {
        version: 1,
        saturday: data.saturday || thisSaturday(new Date()),
        slots: Array.isArray(data.slots) ? data.slots : [],
        students: data.students.map((student) => { ensureSyllabus(student); return student; }),
        lessons: data.lessons || {},
        contributions: data.contributions || [],
        manual: data.manual || {},
        later: data.later || {},
        hand: data.hand || {},
        handNote: data.handNote || "",
        terms: data.terms || {},
        termPlan: data.termPlan || {},
        termQueue: data.termQueue || { chem: [], bio: [] },
      };
      persist();
      location.hash = "#week";
      draw({ keepScroll: false });
      toast("Backup restored");
    } catch (err) {
      toast("That backup could not be read.");
    }
  }
}

function onInput(e) {
  const field = e.target.dataset.field;
  const lesson = lessonFromHash();
  if (e.target.form && e.target.form.id === "student-form") {
    updateNamePreview();
    return;
  }
  if (!field) return;
  if (field === "term-start" || field === "term-end") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
    const sem = e.target.dataset.sem === "2" ? "2" : "1";
    const current = termRange(sem);
    if (!state.terms) state.terms = {};
    state.terms[sem] = {
      start: field === "term-start" ? e.target.value : current.start,
      end: field === "term-end" ? e.target.value : current.end,
    };
    persist();
    draw();
    return;
  }
  if (field === "plan-add") {
    const code = e.target.value;
    const date = e.target.dataset.date;
    const subject = e.target.dataset.subject === "bio" ? "bio" : "chem";
    const index = Number(e.target.dataset.group);
    if (!code || !date) return;
    editTermPlan(date, subject, (plan) => {
      const group = plan.groups[index];
      if (!group) return;
      if (code === "tutorial") group.tutorial = true;
      else if (!group.topics.includes(code)) group.topics.push(code);
    });
    persist();
    draw();
    return;
  }
  if (field === "test-date" || field === "test-from" || field === "test-to") {
    const ids = String(e.target.dataset.students || "").split(",").filter(Boolean);
    const people = ids.map(studentById).filter(Boolean);
    const subject = e.target.dataset.subject === "bio" ? "bio" : "chem";
    const kind = e.target.dataset.kind;
    if (!people.length || !SYLLABUS_GATES.some((item) => item.id === kind)) return;
    if (field === "test-date") {
      setTestDate(people, subject, kind, e.target.value || "");
      persist();
      draw();
      return;
    }
    const row = e.target.closest(".test-line");
    const from = row?.querySelector("[data-field='test-from']")?.value || "";
    const to = row?.querySelector("[data-field='test-to']")?.value || "";
    if (!from && !to) clearTestRange(people, subject, kind);
    else if (from && to) applyTestRange(people, subject, kind, from, to);
    else return;
    persist();
    draw();
    return;
  }
  if ((field === "note" || field === "teacher") && lesson) {
    const stream = lesson.streams.find((s) => s.id === e.target.dataset.stream);
    if (!stream) return;
    stream[field === "note" ? "note" : "teacher"] = e.target.value;
    touch(lesson);
    const prev = document.querySelector(`[data-preview="${CSS.escape(stream.id)}"]`);
    if (prev) prev.textContent = sentence(stream) || "Pick a topic to build the line.";
    refreshPaste(lesson);
    return;
  }
  if (field === "remark") {
    const student = studentById(e.target.dataset.student);
    if (!student) return;
    student.remark = e.target.value;
    persist();
    if (lesson) refreshPaste(lesson);
    return;
  }
  if (field === "topic-search" && lesson) {
    const box = e.target.parentElement.querySelector("[data-results]");
    box.hidden = false;
    box.innerHTML = searchResultsHtml(lesson.subject, e.target.value, e.target.dataset.stream);
    return;
  }
  if (field === "hw-search" && lesson) {
    const box = e.target.parentElement.querySelector("[data-hw-results]");
    box.hidden = false;
    box.innerHTML = hwResultsHtml(lesson.subject, e.target.value, e.target.dataset.stream);
    return;
  }
  if (field === "slot-start" || field === "slot-end" || field === "slot-room") {
    const openLesson = lessonFromHash();
    if (!openLesson) return;
    if (field === "slot-start" && e.target.value) openLesson.start = e.target.value;
    if (field === "slot-end" && e.target.value) openLesson.end = e.target.value;
    if (field === "slot-room") openLesson.room = e.target.value;
    if (!openLesson.extra) {
      upsertSlot(openLesson.day, openLesson.subject, {
        start: openLesson.start, end: openLesson.end, room: openLesson.room,
      });
    }
    persist();
    const lede = document.querySelector("[data-lesson-lede]");
    if (lede) lede.textContent = `${openLesson.start}–${openLesson.end} · ${openLesson.room}`;
    const time = document.querySelector(".tt-cell.on .time");
    if (time) time.textContent = `${openLesson.start}–${openLesson.end}`;
    return;
  }
  if (field === "find-student") {
    ui.findStudent = e.target.value;
    const box = document.getElementById("dash-body");
    if (box) box.innerHTML = dashBody(progressStudents(), progressSubject());
    return;
  }
  if (field === "saturday") {
    state.saturday = thisSaturday(parseIso(e.target.value));
    e.target.value = state.saturday;
    persist();
    draw({ keepScroll: false });
    return;
  }
  if (field === "check-student") {
    ui.checked[e.target.dataset.student] = e.target.checked;
    return;
  }
  if (field === "bulk-mode") ui.bulkMode = e.target.value;
}

function onFocusIn(e) {
  const field = e.target.dataset.field;
  if (field !== "topic-search" && field !== "hw-search") return;
  const lesson = lessonFromHash();
  if (!lesson) return;
  const box = e.target.parentElement.querySelector(field === "hw-search" ? "[data-hw-results]" : "[data-results]");
  box.hidden = false;
  box.innerHTML = field === "hw-search"
    ? hwResultsHtml(lesson.subject, e.target.value, e.target.dataset.stream)
    : searchResultsHtml(lesson.subject, e.target.value, e.target.dataset.stream);
}

function onFocusOut(e) {
  const field = e.target.dataset.field;
  if (field !== "topic-search" && field !== "hw-search") return;
  const box = e.target.parentElement.querySelector(field === "hw-search" ? "[data-hw-results]" : "[data-results]");
  setTimeout(() => { if (box) box.hidden = true; }, 180);
}

function onDragStart(e) {
  const chip = e.target.closest("[data-student-chip]");
  if (!chip) return;
  if (e.target.closest("[data-action='toggle-abs'], [data-action='unassign']")) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.setData("text/plain", chip.dataset.student);
  e.dataTransfer.effectAllowed = "move";
  ui.picked = chip.dataset.student;
}

function onDragOver(e) {
  const zone = e.target.closest("[data-drop]");
  if (!zone) return;
  e.preventDefault();
  zone.classList.add("drop-hot");
}

function onDragLeave(e) {
  const zone = e.target.closest("[data-drop]");
  if (zone) zone.classList.remove("drop-hot");
}

function onDrop(e) {
  const zone = e.target.closest("[data-drop]");
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove("drop-hot");
  const lesson = lessonFromHash();
  const id = e.dataTransfer.getData("text/plain");
  if (!lesson || !id) return;
  placeStudent(lesson, id, zone.dataset.drop === "pool" ? null : zone.dataset.stream);
  ui.picked = null;
  draw();
}

async function boot() {
  const hadLocal = load();
  const restored = await restoreFromDisk(hadLocal);
  weekLessons(state.saturday);
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  app.addEventListener("change", onInput);
  app.addEventListener("focusin", onFocusIn);
  app.addEventListener("focusout", onFocusOut);
  app.addEventListener("dragstart", onDragStart);
  app.addEventListener("dragover", onDragOver);
  app.addEventListener("dragleave", onDragLeave);
  app.addEventListener("drop", onDrop);
  app.addEventListener("submit", (e) => {
    if (e.target.id === "add-extra-form") {
      e.preventDefault();
      const data = new FormData(e.target);
      const day = String(data.get("day") || "");
      const subject = data.get("subject") === "bio" ? "bio" : "chem";
      if (!activeDays().includes(day)) return;
      const extraLesson = createExtraLesson(day, subject);
      ui.addExtra = false;
      persist();
      location.hash = `#lesson/${encodeURIComponent(extraLesson.id)}`;
      return;
    }
    if (e.target.id === "add-day-form") {
      e.preventDefault();
      const pickedDay = String(new FormData(e.target).get("day") || "");
      if (!DAY_ORDER.includes(pickedDay) || activeDays().includes(pickedDay)) return;
      state.slots.push(
        { day: pickedDay, subject: "chem", start: "11:00", end: "12:00", room: "" },
        { day: pickedDay, subject: "bio", start: "13:00", end: "14:00", room: "" },
      );
      ui.addDay = false;
      persist();
      draw();
      return;
    }
    if (e.target.id !== "student-form") return;
    e.preventDefault();
    const data = new FormData(e.target);
    const chinese = String(data.get("chinese") || "").trim();
    const english = String(data.get("english") || "").trim();
    const school = String(data.get("school") || "").trim().toUpperCase();
    const form = String(data.get("form") || "").trim() || "S3";
    const pickedDay = String(data.get("day") || "sat");
    const day = DAY_ORDER.includes(pickedDay) ? pickedDay : "sat";
    if (!chinese || !english || !school) return;
    if (ui.editId) {
      Object.assign(studentById(ui.editId), { chinese, english, school, form, day });
      ui.editId = null;
    } else {
      let id = english.toLowerCase().replace(/[^a-z0-9]+/g, "") || uid();
      if (studentById(id)) id = `${id}-${uid()}`;
      state.students.push({ id, chinese, english, school, form, day, active: true, remark: "", schoolTopic: "", syllabus: { chem: "", bio: "" }, tests: [] });
    }
    persist();
    draw();
    toast("Student saved");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ui.picked) {
      ui.picked = null;
      draw();
    }
  });
  window.addEventListener("hashchange", () => draw({ keepScroll: false }));
  const previousNote = state.handNote || "";
  refreshHandNote();
  if ((state.handNote || "") !== previousNote) persist();
  draw({ keepScroll: false });
  if (restored) toast("Restored the copy saved on this computer.");
  window.__desk = { buildOutputs, sentence, state, displayName, roster, displayMark, commitLesson, persist };
}

boot();
