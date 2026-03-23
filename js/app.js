// ══ WordNet App Core ══
"use strict";

const escapeHTML = (str) => String(str || '').replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
const $ = (id) => document.getElementById(id);

// ═══ 大类配置 ═══
// data.js 中每个主题的 category 字段直接填大类名（如"结构与建造"）
const CATEGORIES = [
  { id: 'perception', name: '感知与认知', icon: '👁', color: '#60a8f0', desc: '视觉·认知·光·语言' },
  { id: 'motion',     name: '运动与变化', icon: '⚡', color: '#f06858', desc: '行走·携带·推拉·旋转' },
  { id: 'structure',  name: '结构与建造', icon: '🏗', color: '#e8b04a', desc: '建立·形状·连接·切割' },
  { id: 'life',       name: '生命与人类', icon: '🧬', color: '#4dd8a0', desc: '生命·身体·情感·医学' },
  { id: 'power',      name: '权力与社会', icon: '⚖', color: '#b48cf0', desc: '统治·力量·法律·经济' },
  { id: 'time',       name: '时间与数量', icon: '⏳', color: '#e0925a', desc: '时间·测量·程度·持续' },
  { id: 'nature',     name: '自然与物质', icon: '🌿', color: '#50b8c8', desc: '天体·现象·生态' },
  { id: 'tech',       name: '科技与学术', icon: '🔬', color: '#d868a0', desc: '技术·规模·创新·逻辑' },
];

const State = {
  fg: null, themeId: null, wordId: null,
  activeNodeId: null, hoverNodeId: null,
  audio: null, wordMap: {}, prevView: null, zoomTimer: null, trackInterval: null,
  currentCatId: null, catSearchQuery: '',
  _starfieldActive: true, _showUnlearned: false,
};

const DOM = {
  pHome: $('p-home'), homeGrid: $('home-grid'),
  pCat: $('p-cat'), catGrid: $('cat-grid'),
  catTitle: $('cat-title'), catStat: $('cat-stat'),
  btnCatBack: $('btn-cat-back'), catSearchInput: $('cat-search-input'),
  pGraph: $('p-graph'), fgWrap: $('fg-wrap'),
  tbarName: $('tbar-name'), tbarStat: $('tbar-stat'),
  btnBack: $('btn-back'), gHint: $('g-hint'),
  sheetOverlay: $('sheet-overlay'), bottomSheet: $('bottom-sheet'), bsInner: $('bs-inner'),
  imgZone: $('bs-img-zone'), img: $('bs-img'), imgPlaceholder: $('bs-img-placeholder'),
  wordBig: $('bs-word-big'), posTag: $('bs-pos-tag'),
  phonetic: $('bs-phonetic'), phonRow: $('bs-phon-row'), speakIcon: $('bs-speak-icon'),
  logicTag: $('bs-logic-tag'), meaning: $('bs-meaning'), chips: $('bs-chips'),
  loader: $('loader'),
};

// ══ Color system ══
const COSMOS_COLORS = {
  noun: '#5ba0f5', verb: '#f06060', adj: '#50d890',
  adv: '#f5b245', prep: '#b08df0', root: '#f0e6c8', default: '#6e7e92'
};

const getPosColor = (posStr) => {
  if (!posStr) return COSMOS_COLORS.default;
  const firstPos = posStr.split(/[\/;,]/)[0].toLowerCase().trim();
  if (firstPos.includes('v') || firstPos.includes('动词')) return COSMOS_COLORS.verb;
  if (firstPos.includes('adj') || firstPos.includes('a.') || firstPos.includes('形容词')) return COSMOS_COLORS.adj;
  if (firstPos.includes('adv') || firstPos.includes('ad.') || firstPos.includes('副词')) return COSMOS_COLORS.adv;
  if (firstPos.includes('prep') || firstPos.includes('介词')) return COSMOS_COLORS.prep;
  if (firstPos.includes('n') || firstPos.includes('名词')) return COSMOS_COLORS.noun;
  return COSMOS_COLORS.default;
};

// ══ Theme Color Auto-Assignment ══
const GOLDEN_ANGLE = 137.508;
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r=c; g=x; b=0; } else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; } else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; } else { r=c; g=0; b=x; }
  return '#' + [r,g,b].map(v => Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
};

const generateDeepSpaceColors = (n) => {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * GOLDEN_ANGLE) % 360;
    colors.push(hslToHex(hue, 55 + 15*Math.sin(i*0.3), 62 + 8*Math.cos(i*0.5)));
  }
  return colors;
};

const assignThemeColors = (db) => {
  if (!db) return;
  const keys = Object.keys(db);
  const palette = generateDeepSpaceColors(Math.max(keys.length, 90));
  keys.forEach((key, idx) => {
    if (!db[key].color || db[key].color.trim() === '') db[key].color = palette[idx];
  });
};

const initWordMap = () => {
  if (typeof DB === 'undefined') return;
  assignThemeColors(DB);
  Object.entries(DB).forEach(([tid, theme]) => {
    theme.nodes.forEach(n => {
      State.wordMap[n.id] = { ...n, themeId: tid, themeColor: theme.color, themeIcon: theme.icon };
    });
  });
};

// ══ Page Navigation ══
const showPage = (pageEl) => {
  document.querySelectorAll('.page').forEach(p => p.classList.add('off'));
  pageEl.classList.remove('off');
};

// ══ Learning Progress (localStorage) ══
const LEARNED_KEY = 'wordnet_learned';

const getLearnedSet = () => {
  try {
    const raw = localStorage.getItem(LEARNED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const markLearned = (wordId) => {
  const set = getLearnedSet();
  if (set.has(wordId)) return false;
  set.add(wordId);
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...set])); } catch {}
  return true;
};

const getLearnedCountForTheme = (themeId) => {
  const theme = DB[themeId];
  if (!theme) return 0;
  const learned = getLearnedSet();
  return theme.nodes.filter(n => learned.has(n.id)).length;
};

const getLearnedCountForCategory = (cat) => {
  const themes = getThemesForCategory(cat);
  const learned = getLearnedSet();
  let count = 0;
  themes.forEach(([id, t]) => {
    count += t.nodes.filter(n => learned.has(n.id)).length;
  });
  return count;
};

const getTotalWordsForCategory = (cat) => {
  const themes = getThemesForCategory(cat);
  return themes.reduce((sum, [, t]) => sum + (t.nodes ? t.nodes.length : 0), 0);
};
