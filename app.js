const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Constants for layout
const DW = 260;      // Standard decision node width
const W = 280;       // Leaf card width
const COL_W = 350;   // Horizontal column spacing
const ROW_GAP = 70;  // Vertical row gap between stage groups
const GY = 12;       // Gap between stacked cards
const PX = 60, PY = 90; // Canvas padding

// Default IDs connecting directly to Google Drive files (from config.js)
const DEFAULT_TEMPLATE_ID = (window.PLANNER_CONFIG && window.PLANNER_CONFIG.defaultTemplateId) || '';
const DEFAULT_FOLDER_ID   = (window.PLANNER_CONFIG && window.PLANNER_CONFIG.defaultFolderId) || '';

const MAT = [
  'Whiteboard & markers', 'Slides / projector', 'Printed handouts',
  'Textbook', 'Case study pack', 'Calculators', 'Devices & internet', 'Graph paper'
];

/**
 * The Decision Tree Flow:
 * Phase 1: Curriculum Hierarchy (Strand -> Substrand -> Outcome)
 * Phase 2: Curriculum Targets (Intention -> Indicator -> Success Criteria)
 * Phase 3: National Competencies & Shared Values (with Indicators)
 * Phase 4: Prior Learning, Materials & Pedagogy
 * Phase 5: Instructional Strategies (Starter, Main Activity, Closure)
 * Phase 6: Adjustable 35-Minute Timer Balancer
 * Phase 7: Assessment Tools
 */
const FLOW = [
  // --- Phase 1: Curriculum Hierarchy ---
  { st: 1, key: 'STRAND', title: 'Strand / Unit', src: 'strands', multi: 0, group: 0, col: 0,
    hint: 'Select the curriculum strand (Unit) from your syllabus.' },
  { st: 1, key: 'SUBSTRAND', title: 'Sub-strand', src: 'substrands', multi: 0, group: 0, col: 1, pk: 'STRAND', et: 'h',
    hint: 'Select the sub-strand under this unit.' },
  { st: 1, key: 'OUTCOME', title: 'Curriculum Outcome', src: 'outcomes', multi: 1, group: 0, col: 2, pk: 'SUBSTRAND', et: 'h',
    hint: 'Choose the learning outcome(s) for the week.' },

  // --- Phase 2: Curriculum Targets (fetched directly from sheet) ---
  { st: 2, key: 'INTENTION', title: 'Learning Intention', src: 'target_intention', multi: 1, group: 1, col: 0, pk: 'OUTCOME', et: 'wrap',
    hint: 'Syllabus learning intention (confirm or customize).' },
  { st: 2, key: 'INDICATOR', title: 'Indicator of Learning', src: 'target_indicator', multi: 1, group: 1, col: 1, pk: 'INTENTION', et: 'h',
    hint: 'Observable evidence demonstrating the outcome.' },
  { st: 2, key: 'SUCCESS_CRITERIA', title: 'Success Criteria', src: 'target_criteria', multi: 1, group: 1, col: 2, pk: 'INDICATOR', et: 'h',
    hint: 'How students will show they have met the goals.' },

  // --- Phase 3: Core Attributes (Appear Below, showing indicators) ---
  { st: 3, key: 'COMPETENCIES', title: 'Key Competencies', src: 'competencies', multi: 1, group: 2, col: 0, pk: 'SUCCESS_CRITERIA', et: 'wrap',
    hint: 'Select applicable key competencies with classroom indicators (up to 6).' },
  { st: 3, key: 'VALUES', title: 'Shared Values', src: 'values', multi: 1, group: 2, col: 1, pk: 'COMPETENCIES', et: 'h',
    hint: 'Select applicable shared values with classroom indicators (up to 5).' },

  // --- Phase 4: Learning Environment & Pedagogy ---
  { st: 4, key: 'PRIOR_LEARNING', title: 'Prior Learning', text: 'What foundational knowledge do students already bring?', group: 3, col: 0, pk: 'VALUES', et: 'wrap',
    hint: 'Prior concept connection for student recall.' },
  { st: 4, key: 'MATERIALS', title: 'Materials Needed', opts: MAT, multi: 1, group: 3, col: 1, pk: 'PRIOR_LEARNING', et: 'h',
    hint: 'Select resources required for the lessons.' },
  { st: 4, key: 'PEDAGOGY', title: 'Pedagogy Approach', opts: ['Teacher-centred', 'Student-centred', 'Blended (Teacher & Student)'], multi: 1, group: 3, col: 2, pk: 'MATERIALS', et: 'h',
    hint: 'Instructional orientation used across activities.' },

  // --- Phase 5: Teaching Strategies (Strict Activity Matching) ---
  { st: 5, key: 'STARTER', title: 'Starter Strategy', src: 'strategies_starter', multi: 1, group: 4, col: 0, pk: 'PEDAGOGY', et: 'wrap',
    hint: 'Showing ONLY strategies assigned to Starter activity.' },
  { st: 5, key: 'MAIN', title: 'Main Activity Strategy', src: 'strategies_main', multi: 1, group: 4, col: 1, pk: 'STARTER', et: 'h',
    hint: 'Showing ONLY strategies assigned to Main activity.' },
  { st: 5, key: 'CLOSURE', title: 'Closure Strategy', src: 'strategies_closure', multi: 1, group: 4, col: 2, pk: 'MAIN', et: 'h',
    hint: 'Showing ONLY strategies assigned to Closure activity.' },

  // --- Phase 6: Time Allocation (35 min Period) ---
  { st: 6, key: 'TIME_ALLOCATION', title: 'Time Allocation (35 min)', group: 5, col: 1, pk: 'CLOSURE', et: 'v', isTimeBar: true,
    hint: 'Coupled 35-minute duration. Increasing one activity balances the others.' },

  // --- Phase 7: Assessment ---
  { st: 7, key: 'ASSESSMENT', title: 'Assessment Tools', src: 'assessments', multi: 1, group: 6, col: 1, pk: 'TIME_ALLOCATION', et: 'v',
    hint: 'Formative or summative tools to evaluate comprehension.' }
];

let db = {};
let G = [];      // Active node groups
let E = [];      // SVG edges
let final = null; // Final generation node
let sel = {};    // Current selections

// Interactive time state (total = 35 mins)
let times = { starter: 5, main: 25, closure: 5 };

// Session / mode state
let DEMO = false;          // offline sample data
let CURRENT_USER = null;   // { email, name, role }
let installPrompt = null;  // PWA install event
let STACKED = false;       // single-column layout on narrow screens

// Load settings from localStorage or defaults
try {
  ['tpl', 'folder', 'week', 'grade', 'lessons'].forEach(k => {
    const v = localStorage.getItem('lt_' + k);
    if (v) $('#' + k).value = v;
    $('#' + k).addEventListener('change', e => localStorage.setItem('lt_' + k, e.target.value));
  });
} catch (e) {}

if (!$('#tpl').value && DEFAULT_TEMPLATE_ID) $('#tpl').value = DEFAULT_TEMPLATE_ID;
if (!$('#folder').value && DEFAULT_FOLDER_ID) $('#folder').value = DEFAULT_FOLDER_ID;

function toast(t) {
  const b = $('#toast');
  b.textContent = t;
  b.style.display = 'block';
}
$('#toast').onclick = () => { $('#toast').style.display = 'none'; };

const by = k => G.find(g => g.d.key === k);

function mk(cls, html) {
  const el = document.createElement('div');
  el.className = 'node trim ' + cls;
  el.innerHTML = html;
  $('#canvas').appendChild(el);
  return { el };
}

function from(n, p) {
  n.el.style.left = p.el.style.left || '0px';
  n.el.style.top = p.el.style.top || '0px';
}

function show(ns) {
  requestAnimationFrame(() => requestAnimationFrame(() => ns.forEach(n => n.el.classList.remove('trim'))));
}

function edge(a, b, c, t) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (c) p.setAttribute('class', 'c');
  $('#svg').appendChild(p);
  const e = { a, b, p, t };
  E.push(e);
  return e;
}

/** Draws smooth SVG cubic Bézier curves connecting progressive decisions */
function draw() {
  E.forEach(e => {
    const A = e.a.el, B = e.b.el;
    const al = A.offsetLeft, at = A.offsetTop, aw = A.offsetWidth, ah = A.offsetHeight;
    const bl = B.offsetLeft, bt = B.offsetTop, bw = B.offsetWidth, bh = B.offsetHeight;
    // On narrow screens the whole tree is stacked in one column, so every
    // connector becomes a vertical curve.
    const t = (STACKED && (e.t === 'h' || e.t === 'B' || e.t === 'wrap')) ? 'v' : e.t;
    let d;

    if (t === 'h') {
      const x1 = al + aw, y1 = at + ah / 2;
      const x2 = bl, y2 = bt + bh / 2;
      const k = Math.max(30, (x2 - x1) / 2);
      d = `M${x1} ${y1} C${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`;
    } else if (t === 'B') {
      const x1 = al + 24, y1 = at + ah;
      const x2 = bl, y2 = bt + bh / 2;
      d = `M${x1} ${y1} C${x1} ${y1 + (y2 - y1) * 0.6}, ${x1 + 10} ${y2}, ${x2} ${y2}`;
    } else if (t === 'v') {
      const x1 = al + aw / 2, y1 = at + ah;
      const x2 = bl + bw / 2, y2 = bt;
      const k = (y2 - y1) / 2;
      d = `M${x1} ${y1} C${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
    } else if (t === 'wrap') {
      const x1 = al + aw / 2, y1 = at + ah;
      const x2 = bl + bw / 2, y2 = bt;
      const midY = y1 + (y2 - y1) * 0.5;
      d = `M${x1} ${y1} C${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    } else {
      const x1 = al + aw, y1 = at + ah / 2;
      const x2 = bl, y2 = bt + bh / 2;
      d = `M${x1} ${y1} L${x2} ${y2}`;
    }

    e.p.setAttribute('d', d);
  });
}

function animate(ms = 600) {
  const t = performance.now();
  (function f() {
    draw();
    if (performance.now() - t < ms) requestAnimationFrame(f);
  })();
}

/** Dynamic grid layout positioning nodes and child branch cards */
function layout() {
  const cv = $('#canvas');
  void cv.offsetWidth;
  const H = n => n.el.offsetHeight;

  const totalCols = 3;
  const availableWidth = $('#wrap').clientWidth || 1200;
  STACKED = availableWidth < 1080;
  const ox = STACKED ? 16 : Math.max(40, (availableWidth - (totalCols * COL_W)) / 2);

  let mx = 0, my = 0;
  const set = (n, x, y) => {
    n.x = x; n.y = y;
    n.el.style.left = x + 'px';
    n.el.style.top = y + 'px';
    mx = Math.max(mx, x + n.el.offsetWidth);
    my = Math.max(my, y + H(n));
  };

  const groups = {};
  G.forEach(g => {
    const grp = g.d.group != null ? g.d.group : 0;
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(g);
  });

  let curY = PY;
  const sortedGroupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);

  if (STACKED) {
    // Single column: every decision and its cards flow top-to-bottom.
    sortedGroupKeys.forEach(grpIdx => {
      const groupNodes = groups[grpIdx].slice().sort((a, b) => (a.d.col || 0) - (b.d.col || 0));
      groupNodes.forEach(g => {
        set(g.dn, ox, curY);
        curY += H(g.dn) + GY;
        g.leaves.forEach(c => {
          set(c, ox + 18, curY);
          curY += H(c) + GY;
        });
        curY += ROW_GAP - GY;
      });
    });
    if (final) {
      set(final, ox, curY);
      curY += H(final) + ROW_GAP;
    }
  } else {
    sortedGroupKeys.forEach(grpIdx => {
      const groupNodes = groups[grpIdx];
      let maxGroupH = 0;

      groupNodes.forEach(g => {
        const col = g.d.col != null ? g.d.col : 0;
        const x = ox + col * COL_W;

        set(g.dn, x, curY);

        let leafY = curY + H(g.dn) + GY;
        g.leaves.forEach(c => {
          set(c, x + 16, leafY);
          leafY += H(c) + GY;
        });

        const nodeTotalH = g.leaves.length ? (leafY - curY) : H(g.dn);
        maxGroupH = Math.max(maxGroupH, nodeTotalH);
      });

      curY += maxGroupH + ROW_GAP;
    });

    if (final) {
      const x = ox + 1 * COL_W;
      set(final, x, curY);
      curY += H(final) + ROW_GAP;
    }
  }

  // Single column needs only a small right margin, so phones do not get a
  // pointless horizontal scrollbar.
  const w = Math.max(mx + (STACKED ? 16 : PX), availableWidth);
  const h = Math.max(my + PY, curY + 40);

  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  $('#svg').setAttribute('width', w);
  $('#svg').setAttribute('height', h);

  animate();
}

function focusOn(n) {
  const wrap = $('#wrap');
  const targetLeft = STACKED
    ? 0
    : Math.max(0, n.x - Math.max(0, (wrap.clientWidth - n.el.offsetWidth) / 2));
  const targetTop = Math.max(0, n.y - 96);
  wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
}

function hud() {
  if (final) {
    $('#stage-num').textContent = 'Final';
    $('#stage-text').textContent = 'Generate Lesson Plan';
    $('#dots').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(i => `<i class="d"></i>`).join('') + '<i class="n"></i>';
    return;
  }
  const curG = G[G.length - 1];
  if (!curG) return;
  const curStage = curG.d.st;
  $('#stage-num').textContent = `Step ${curStage}`;
  $('#stage-text').textContent = curG.d.title;
  $('#dots').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(i =>
    `<i class="${i < curStage ? 'd' : i === curStage ? 'n' : ''}"></i>`
  ).join('');
}

/**
 * Coupled 3-Activity Time Balancer:
 * Automatically rebalances times so Starter + Main + Closure === 35 minutes always.
 */
function adjustTime(changedKey, newVal) {
  newVal = parseInt(newVal, 10);
  if (isNaN(newVal)) return;

  const mins = { starter: 2, main: 15, closure: 2 };
  const maxs = { starter: 15, main: 30, closure: 12 };

  newVal = Math.max(mins[changedKey], Math.min(maxs[changedKey], newVal));
  const delta = newVal - times[changedKey];
  if (delta === 0) return;

  times[changedKey] = newVal;

  const others = ['starter', 'main', 'closure'].filter(k => k !== changedKey);
  const targetOrder = (changedKey === 'main')
    ? ['starter', 'closure']
    : (others.includes('main') ? ['main', others.find(k => k !== 'main')] : others);

  let remainingDelta = -delta;
  for (let k of targetOrder) {
    const avail = (remainingDelta < 0)
      ? (times[k] - mins[k])
      : (maxs[k] - times[k]);

    if (remainingDelta < 0) {
      const reduce = Math.min(-remainingDelta, avail);
      times[k] -= reduce;
      remainingDelta += reduce;
    } else {
      const add = Math.min(remainingDelta, avail);
      times[k] += add;
      remainingDelta -= add;
    }
    if (remainingDelta === 0) break;
  }

  if (remainingDelta !== 0) {
    times[changedKey] -= (-remainingDelta);
  }

  updateTimeUI();
}

function updateTimeUI() {
  const sW = (times.starter / 35) * 100;
  const mW = (times.main / 35) * 100;
  const cW = (times.closure / 35) * 100;

  const segS = $('.seg-starter');
  const segM = $('.seg-main');
  const segC = $('.seg-closure');
  if (segS) { segS.style.width = sW + '%'; segS.innerHTML = `<span>Starter ${times.starter}m</span>`; }
  if (segM) { segM.style.width = mW + '%'; segM.innerHTML = `<span>Main ${times.main}m</span>`; }
  if (segC) { segC.style.width = cW + '%'; segC.innerHTML = `<span>Closure ${times.closure}m</span>`; }

  ['starter', 'main', 'closure'].forEach(k => {
    const slider = $(`input.time-slider[data-act="${k}"]`);
    if (slider) slider.value = times[k];
    const valSpan = $(`.val-${k}`);
    if (valSpan) valSpan.textContent = times[k] + 'm';
  });

  document.querySelectorAll('.preset-pill').forEach(btn => {
    const match = parseInt(btn.dataset.s, 10) === times.starter &&
                  parseInt(btn.dataset.m, 10) === times.main &&
                  parseInt(btn.dataset.c, 10) === times.closure;
    btn.classList.toggle('active', match);
  });
}

/** Formats indicator bullet points cleanly */
function formatIndicatorText(txt) {
  if (!txt) return '';
  return txt
    .replace(/\s*-\s*Evident when/gi, '\n• Evident when')
    .replace(/^• /, '')
    .trim();
}

/** Fetches items for the current decision node based on previous selections */
function itemsFor(src) {
  const schemeVal = $('#scheme').value;
  const allCurriculum = (db.outcomes || []).filter(x => {
    return !schemeVal || !x.scheme || x.scheme === schemeVal;
  });

  // 1. STRANDS
  if (src === 'strands') {
    const map = new Map();
    allCurriculum.forEach(x => {
      const strand = x.strand || x.unit || 'Standard Unit';
      if (!map.has(strand)) {
        map.set(strand, { label: strand, sub: 'Unit Strand', row: x.row });
      }
    });
    return Array.from(map.values());
  }

  // 2. SUBSTRANDS
  if (src === 'substrands') {
    const chosenStrand = (sel.STRAND && sel.STRAND[0]) || '';
    const map = new Map();
    allCurriculum
      .filter(x => !chosenStrand || x.strand === chosenStrand || x.unit === chosenStrand)
      .forEach(x => {
        const sub = x.substrand || 'General';
        if (!map.has(sub)) {
          map.set(sub, { label: sub, sub: 'Sub-strand', row: x.row });
        }
      });
    return Array.from(map.values());
  }

  // 3. OUTCOMES
  if (src === 'outcomes') {
    const chosenSub = (sel.SUBSTRAND && sel.SUBSTRAND[0]) || '';
    const chosenStrand = (sel.STRAND && sel.STRAND[0]) || '';
    const filtered = allCurriculum.filter(x => {
      const matchStrand = !chosenStrand || x.strand === chosenStrand || x.unit === chosenStrand;
      const matchSub = !chosenSub || x.substrand === chosenSub;
      return matchStrand && matchSub;
    });

    return filtered.map(x => ({
      label: x.outcome || x.label,
      sub: x.indicator ? `Indicator: ${x.indicator}` : '',
      row: x.row,
      item: x
    }));
  }

  // 4. LEARNING TARGETS
  const selectedOutcomeNames = sel.OUTCOME || [];
  const matchedOutcomes = allCurriculum.filter(x => selectedOutcomeNames.includes(x.outcome || x.label));

  if (src === 'target_intention') {
    const set = new Set();
    const items = [];
    matchedOutcomes.forEach(x => {
      const val = x.intention || (x.row && (x.row.Intension || x.row.Intention));
      if (val && !set.has(val)) {
        set.add(val);
        items.push({ label: val, tag: 'From Syllabus', isPre: true });
      }
    });
    if (!items.length) items.push({ label: 'Understand core concept and key principles', tag: 'Default Intention', isPre: true });
    return items;
  }

  if (src === 'target_indicator') {
    const set = new Set();
    const items = [];
    matchedOutcomes.forEach(x => {
      const val = x.indicator || (x.row && x.row.Indicator);
      if (val && !set.has(val)) {
        set.add(val);
        items.push({ label: val, tag: 'From Syllabus', isPre: true });
      }
    });
    if (!items.length) items.push({ label: 'Students accurately explain and apply concepts', tag: 'Default Indicator', isPre: true });
    return items;
  }

  if (src === 'target_criteria') {
    const set = new Set();
    const items = [];
    matchedOutcomes.forEach(x => {
      const val = x.successCriteria || (x.row && (x.row.SuccessCriteria || x.row.Criteria));
      if (val && !set.has(val)) {
        set.add(val);
        items.push({ label: val, tag: 'From Syllabus', isPre: true });
      }
    });
    if (!items.length) items.push({ label: 'I can define the core terms and solve sample questions', tag: 'Default Criteria', isPre: true });
    return items;
  }

  // 5. KEY COMPETENCIES (Displaying detailed indicators)
  if (src === 'competencies') {
    return (db.competencies || []).map(x => ({
      label: x.label,
      indicator: x.indicator || x.sub || '',
      sub: formatIndicatorText(x.indicator || x.sub || ''),
      tag: 'Competency'
    }));
  }

  // 6. SHARED VALUES (Displaying detailed indicators)
  if (src === 'values') {
    return (db.values || []).map(x => ({
      label: x.label,
      indicator: x.indicator || x.sub || '',
      sub: formatIndicatorText(x.indicator || x.sub || ''),
      tag: 'Shared Value'
    }));
  }

  // 7. TEACHING STRATEGIES (Strict Activity Matching: Starter, Main, Closure)
  const strats = db.strategies || [];

  if (src === 'strategies_starter') {
    return strats.filter(s => {
      const act = String(s.activity || (s.row && (s.row.Activity || s.row.StarterClosure)) || '').trim().toLowerCase();
      return act === 'starter' || /^starter/i.test(act);
    }).map(s => ({
      label: s.label || s.name,
      sub: s.sub || s.procedure,
      tag: 'Starter',
      row: s.row
    }));
  }

  if (src === 'strategies_main') {
    return strats.filter(s => {
      const act = String(s.activity || (s.row && (s.row.Activity || s.row.StarterClosure)) || '').trim().toLowerCase();
      return act === 'main' || /^main/i.test(act);
    }).map(s => ({
      label: s.label || s.name,
      sub: s.sub || s.procedure,
      tag: s.approach ? `Main · ${s.approach}` : 'Main Activity',
      row: s.row
    }));
  }

  if (src === 'strategies_closure') {
    return strats.filter(s => {
      const act = String(s.activity || (s.row && (s.row.Activity || s.row.StarterClosure)) || '').trim().toLowerCase();
      return act === 'closure' || /^clos/i.test(act);
    }).map(s => ({
      label: s.label || s.name,
      sub: s.sub || s.procedure,
      tag: 'Closure',
      row: s.row
    }));
  }

  // 8. ASSESSMENTS
  if (src === 'assessments') {
    return (db.assessments || []).map(x => {
      const type = x.type || (x.row && (x.row.Type || x.row.Category)) || '';
      return {
        label: x.label,
        sub: x.sub || x.description,
        tag: type || 'Formative',
        row: x.row
      };
    }).sort((a, b) => (a.tag || '').localeCompare(b.tag || ''));
  }

  return db[src] || [];
}

/** Opens a decision node group */
function openGroup(gi) {
  if (gi >= FLOW.length) return openFinal();
  const d = FLOW[gi];
  const g = { d, leaves: [], done: false };
  G[gi] = g;

  // 1. Time Balancer Node
  if (d.isTimeBar) {
    g.dn = mk('dn wide', `
      <span class="pill">Step ${d.st}</span>
      <b>${esc(d.title)}</b>
      <span class="hint">${esc(d.hint || '')}</span>
      
      <div class="time-widget">
        <div class="time-track">
          <div class="time-seg seg-starter" style="width: 14.3%;"><span>Starter 5m</span></div>
          <div class="time-seg seg-main" style="width: 71.4%;"><span>Main 25m</span></div>
          <div class="time-seg seg-closure" style="width: 14.3%;"><span>Closure 5m</span></div>
        </div>

        <div class="time-row">
          <div class="time-label"><span class="dot dot-starter"></span><b>Starter</b></div>
          <button class="step-btn" data-act="starter" data-dir="-1">-</button>
          <input type="range" class="time-slider" min="2" max="15" value="${times.starter}" data-act="starter">
          <button class="step-btn" data-act="starter" data-dir="1">+</button>
          <span class="time-val val-starter">${times.starter}m</span>
        </div>

        <div class="time-row">
          <div class="time-label"><span class="dot dot-main"></span><b>Main Activity</b></div>
          <button class="step-btn" data-act="main" data-dir="-1">-</button>
          <input type="range" class="time-slider" min="15" max="30" value="${times.main}" data-act="main">
          <button class="step-btn" data-act="main" data-dir="1">+</button>
          <span class="time-val val-main">${times.main}m</span>
        </div>

        <div class="time-row">
          <div class="time-label"><span class="dot dot-closure"></span><b>Closure</b></div>
          <button class="step-btn" data-act="closure" data-dir="-1">-</button>
          <input type="range" class="time-slider" min="2" max="12" value="${times.closure}" data-act="closure">
          <button class="step-btn" data-act="closure" data-dir="1">+</button>
          <span class="time-val val-closure">${times.closure}m</span>
        </div>

        <div class="time-presets">
          <button class="preset-pill active" data-s="5" data-m="25" data-c="5">5 / 25 / 5 Standard</button>
          <button class="preset-pill" data-s="7" data-m="23" data-c="5">7 / 23 / 5 Hook</button>
          <button class="preset-pill" data-s="5" data-m="22" data-c="8">5 / 22 / 8 Reflection</button>
          <button class="preset-pill" data-s="10" data-m="20" data-c="5">10 / 20 / 5 Deep Intro</button>
        </div>

        <div class="total-badge">Total: <b id="total-min">35 / 35</b> mins <span class="check-mark">✓</span></div>
      </div>

      <button class="go" style="visibility:visible">Confirm 35-Minute Allocation</button>
    `);

    g.dn.el.querySelectorAll('.time-slider').forEach(slider => {
      slider.oninput = e => adjustTime(e.target.dataset.act, e.target.value);
    });

    g.dn.el.querySelectorAll('.step-btn').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.act;
        const dir = parseInt(btn.dataset.dir, 10);
        adjustTime(act, times[act] + dir);
      };
    });

    g.dn.el.querySelectorAll('.preset-pill').forEach(btn => {
      btn.onclick = () => {
        times.starter = parseInt(btn.dataset.s, 10);
        times.main = parseInt(btn.dataset.m, 10);
        times.closure = parseInt(btn.dataset.c, 10);
        updateTimeUI();
      };
    });

    g.dn.btn = g.dn.el.querySelector('.go');
    g.dn.btn.onclick = () => {
      sel.TIME_ALLOCATION = [Object.assign({}, times)];
      confirmG(g);
    };

    if (d.pk) {
      const parentNode = by(d.pk).dn;
      from(g.dn, parentNode);
      edge(parentNode, g.dn, 1, d.et || 'v');
    }
    
    hud();
    layout();
    show([g.dn]);
    setTimeout(() => { focusOn(g.dn); updateTimeUI(); }, 60);
    return;
  }

  // 2. Standard Decision Parent Node
  g.dn = mk('dn', `
    <span class="pill">Step ${d.st}</span>
    <b>${esc(d.title)}</b>
    <span class="hint">${esc(d.hint || '')}</span>
    ${d.text ? `<textarea placeholder="${esc(d.text)}" aria-label="${esc(d.title)}"></textarea>` : ''}
    <button class="go">${d.multi ? 'Confirm &amp; Trim' : 'Confirm Selection'}</button>
  `);

  g.dn.btn = g.dn.el.querySelector('.go');
  g.dn.btn.onclick = () => confirmG(g);

  if (d.text) {
    g.ta = g.dn.el.querySelector('textarea');
    g.ta.oninput = () => upd(g);
  }

  if (d.pk) {
    const parentNode = by(d.pk).dn;
    from(g.dn, parentNode);
    edge(parentNode, g.dn, 1, d.et || 'h');
  } else {
    g.dn.el.style.left = PX + 'px';
    g.dn.el.style.top = PY + 'px';
  }

  // Generate branch leaves
  const items = d.text ? [] : (d.opts ? d.opts.map(o => ({ label: o })) : itemsFor(d.src));

  items.forEach(it => {
    const n = mk('card', `
      <div class="title">${esc(it.label)}</div>
      ${it.sub ? `<div class="desc">${esc(it.sub)}</div>` : ''}
      ${it.tag ? `<small class="tg">${esc(it.tag)}</small>` : ''}
    `);

    n.label = it.label;
    n.indicator = it.indicator || it.sub || '';
    n.on = !!it.isPre;
    if (n.on) n.el.classList.add('on');

    n.el.tabIndex = 0;
    n.el.setAttribute('role', 'button');
    n.el.onclick = () => pick(g, n);
    n.el.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(g, n);
      }
    };

    from(n, g.dn);
    g.leaves.push(n);
    edge(g.dn, n, 0, 'B');
  });

  if (!d.text && !items.length) {
    g.dn.el.insertAdjacentHTML('beforeend', `<small class="note">No matching options found in sheet.</small>`);
  } else {
    upd(g);
  }

  hud();
  layout();
  show([g.dn].concat(g.leaves));
  setTimeout(() => focusOn(g.dn), 60);
}

function pick(g, n) {
  if (g.d.multi) {
    n.on = !n.on;
  } else {
    g.leaves.forEach(c => c.on = (c === n));
  }
  g.leaves.forEach(c => c.el.classList.toggle('on', c.on));
  upd(g);
}

function upd(g) {
  const ready = g.d.text
    ? (g.ta.value.trim().length > 0)
    : (g.leaves.some(c => c.on));
  g.dn.el.classList.toggle('ready', ready);
}

function confirmG(g) {
  const gi = G.indexOf(g);
  const keep = g.leaves.filter(c => c.on);
  const drop = g.leaves.filter(c => !c.on);

  if (!g.d.isTimeBar) {
    sel[g.d.key] = g.d.text
      ? [g.ta.value.trim()]
      : keep.map(c => c.label);

    // Save details for competencies and values
    if (g.d.key === 'COMPETENCIES') {
      sel.COMPETENCY_DETAILS = keep.map(c => c.indicator || '');
    }
    if (g.d.key === 'VALUES') {
      sel.VALUES_DETAILS = keep.map(c => c.indicator || '');
    }
  }

  g.dn.btn.disabled = true;

  // Visual trimming animation
  drop.forEach(c => c.el.classList.add('trim'));
  E.filter(e => drop.includes(e.b)).forEach(e => e.p.classList.add('gone'));

  if (gi === 0) $('#scheme').disabled = true;

  setTimeout(() => {
    drop.forEach(c => c.el.remove());
    E = E.filter(e => {
      if (drop.includes(e.b)) { e.p.remove(); return false; }
      return true;
    });

    E.filter(e => keep.includes(e.b)).forEach(e => e.p.setAttribute('class', 'c'));
    keep.forEach(c => {
      c.el.onclick = null;
      c.el.onkeydown = null;
      c.el.tabIndex = -1;
    });

    if (g.ta) g.ta.readOnly = true;
    g.leaves = keep;
    g.done = true;
    g.dn.el.classList.add('done');

    openGroup(gi + 1);
  }, (g.d.text || g.d.isTimeBar) ? 0 : 420);
}

function openFinal() {
  const parentNode = G[G.length - 1].dn;
  final = mk('final', `
    <h3 style="margin:0 0 8px;font-size:15px;color:var(--cy)">Decision Tree Complete</h3>
    <p style="font-size:12px;color:var(--mut);margin:0 0 14px">35-minute plan structure is locked and ready.</p>
    <button class="go" id="gen">Generate Weekly Plan File</button>
    <p id="msg"></p>
  `);

  from(final, parentNode);
  edge(parentNode, final, 1, 'v');
  $('#gen').onclick = generate;

  hud();
  layout();
  show([final]);
  setTimeout(() => focusOn(final), 60);
}

function generate() {
  const tpl = $('#tpl').value.trim();
  const folder = $('#folder').value.trim();
  const msg = $('#msg');
  const btn = $('#gen');

  if (!tpl) {
    $('#panel').classList.add('open');
    $('#tpl').focus();
    toast('Please configure the Master Template File ID in settings first.');
    return;
  }

  if (DEMO) {
    toast('Preview mode cannot create Google Sheets files. Connect your Apps Script URL to enable export.');
    return;
  }

  const n = parseInt($('#lessons').value, 10) || Math.max(1, (sel.OUTCOME || []).length);
  btn.disabled = true;
  msg.className = '';
  msg.textContent = 'Generating Google Sheets weekly plan…';
  layout();

  PlannerAPI.call('generateWeeklyPlanFile', {
    plan: {
      templateId: tpl,
      folderId: folder,
      scheme: $('#scheme').value,
      week: $('#week').value.trim(),
      grade: $('#grade').value.trim(),
      lessons: n,
      times: times,
      selections: sel
    }
  }, { timeout: 240000 })
    .then(r => {
      msg.innerHTML = `
        <div style="margin-top:6px;font-size:13px;color:var(--green);font-weight:600">✓ Plan Created Successfully!</div>
        <a href="${esc(r.url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:14px">
          Open ${esc(r.name)} ↗
        </a>
        <div style="font-size:11.5px;color:var(--mut);margin-top:4px">(${r.lessons} lesson tabs populated · 35 min balance)</div>
        ${r.note ? `<div style="font-size:11px;color:var(--gold);margin-top:4px">${esc(r.note)}</div>` : ''}
      `;
      btn.disabled = false;
      layout();
      setTimeout(() => focusOn(final), 80);
    })
    .catch(e => {
      msg.className = 'err';
      msg.textContent = 'Could not create file: ' + e.message;
      btn.disabled = false;
      layout();
    });
}

function start() {
  $('#panel').classList.remove('open');
  document.querySelectorAll('.node').forEach(n => n.remove());
  $('#svg').innerHTML = '';
  G = [];
  E = [];
  sel = {};
  final = null;
  $('#scheme').disabled = false;
  openGroup(0);
}

/** Initializes the planner by fetching real database sheets via Apps Script */
function init() {
  $('#panel').classList.remove('open');
  $('#toast').style.display = 'none';

  if (DEMO) {
    // Development / Offline Preview Data modeled exactly after your sheet
    db = {
      schemes: [{ label: 'Economics' }, { label: 'Business' }],
      outcomes: [
        {
          strand: '4.6 Employment and unemployment',
          unit: '4.6 Employment and unemployment',
          substrand: '4.6.1 Definitions of employment, unemployment and full employment',
          outcome: 'To define employment, unemployment and full employment',
          indicator: 'To define employment, unemployment and full employment',
          intention: 'To write definition of employment and unemployment',
          successCriteria: 'To define employment and unemployment',
          scheme: 'Economics',
          row: {}
        },
        {
          strand: '4.6 Employment and unemployment',
          unit: '4.6 Employment and unemployment',
          substrand: '4.6.2 Measurement of unemployment',
          outcome: 'To explore how unemployment is measured (labour force survey)',
          indicator: 'To explain how unemployment is measured (labour force survey)',
          intention: 'To write how unemployment is measured (labour force survey)',
          successCriteria: 'To write how unemployment is measured (labour force survey)',
          scheme: 'Economics',
          row: {}
        },
        {
          strand: '4.6 Employment and unemployment',
          unit: '4.6 Employment and unemployment',
          substrand: '4.6.2 Measurement of unemployment',
          outcome: 'To explore the formula for the unemployment rate',
          indicator: 'To calculate the unemployment rate',
          intention: 'To calculate for the unemployment rate',
          successCriteria: 'To calculate using the formula for the unemployment rate',
          scheme: 'Economics',
          row: {}
        }
      ],
      values: [
        {
          label: 'Values related to self',
          indicator: '- Evident when students complete assessments independently without copying\n- Evident when students express personal opinions with confidence\n- Evident when students clean workstations responsibly'
        },
        {
          label: 'Values related to others',
          indicator: '- Evident when students offer help to struggling classmates\n- Evident when students share group resources fairly\n- Evident when students listen quietly while others speak'
        },
        {
          label: 'Values related to the local and global community',
          indicator: '- Evident when students share valuable ideas during class discussions\n- Evident when students speak up against unfairness or bullying\n- Evident when students respect different cultures'
        },
        {
          label: 'Values related to the environment',
          indicator: '- Evident when students treat plants and habitats with care\n- Evident when students turn off lights and conserve resources'
        }
      ],
      competencies: [
        {
          label: 'Practicing Islam:',
          indicator: '- Evident when students open and close interactions using Islamic greetings\n- Evident when students demonstrate Islamic values of honesty and kindness'
        },
        {
          label: 'Understanding & managing self:',
          indicator: '- Evident when students manage time effectively to complete independent tasks\n- Evident when students monitor behavior and concentration during challenging tasks'
        },
        {
          label: 'Living a healthy life:',
          indicator: '- Evident when students maintain correct ergonomics and safety procedures\n- Evident when students evaluate healthy daily habits'
        },
        {
          label: 'Relating to people:',
          indicator: '- Evident when students listen actively without interrupting\n- Evident when students resolve peer disagreements using peaceful communication'
        },
        {
          label: 'Thinking critically & creatively:',
          indicator: '- Evident when students question assumptions, analyze evidence, and examine multiple perspectives\n- Evident when students generate creative solutions'
        },
        {
          label: 'Making meaning:',
          indicator: '- Evident when students interpret charts, graphs, and subject-specific symbols accurately\n- Evident when students select appropriate vocabulary to present ideas clearly'
        },
        {
          label: 'Using technology & media:',
          indicator: '- Evident when students execute targeted digital searches\n- Evident when students critically verify source credibility and online bias'
        },
        {
          label: 'Using sustainable practices:',
          indicator: '- Evident when students minimize waste by economizing materials\n- Evident when students propose sustainable solutions to environmental issues'
        }
      ],
      strategies: [
        // Starters (Strictly Activity === 'Starter')
        { label: 'The Hook', sub: 'Present the Stimulus: Display an intriguing image or 30s audio trigger without revealing the topic.', activity: 'Starter' },
        { label: 'KWL Chart', sub: 'Track what students Know and Want to know before diving into the lesson.', activity: 'Starter' },
        { label: 'Scaffolding / Prior-Knowledge Activation', sub: 'Review foundational knowledge to prepare students for new concepts.', activity: 'Starter' },
        { label: 'Think-Pair-Share', sub: 'Pose an opening prompt for individual thought, partner dialogue, and class share.', activity: 'Starter' },
        { label: 'Entrance Ticket', sub: 'Short prompt answered at start of class to activate prior learning.', activity: 'Starter' },
        { label: 'Four Corners', sub: 'Students physically move to designated corners based on their stance or answer.', activity: 'Starter' },
        
        // Mains (Strictly Activity === 'Main')
        { label: 'Direct Instruction', sub: 'Systematically guides students through step-by-step demonstrations and modeling.', activity: 'Main', approach: 'Teacher-centred' },
        { label: 'The Lecture Method', sub: 'Verbally presents formatted content, facts, or conceptual frameworks.', activity: 'Main', approach: 'Teacher-centred' },
        { label: 'Expository Teaching', sub: 'Advance organizer followed by logical deductive content presentation.', activity: 'Main', approach: 'Teacher-centred' },
        { label: 'Demonstration Method', sub: 'Step-by-step modeling of a process or experiment before student execution.', activity: 'Main', approach: 'Teacher-centred' },
        { label: 'Jigsaw Technique', sub: 'Expert groups master content and teach home peers.', activity: 'Main', approach: 'Student-centred' },
        { label: 'Inquiry-Based Learning (5E Model)', sub: 'Engage, Explore, Explain, Elaborate, and Evaluate.', activity: 'Main', approach: 'Student-centred' },

        // Closures (Strictly Activity === 'Closure')
        { label: 'Exit Ticket', sub: 'Short targeted prompt answered before leaving.', activity: 'Closure' },
        { label: '3-2-1 Reflection', sub: '3 key takeaways, 2 connections, 1 remaining question.', activity: 'Closure' },
        { label: 'KWL', sub: 'Final reflection on what students Learned during the period.', activity: 'Closure' },
        { label: 'Elevator Pitch', sub: '60-second concise synthesis of the lesson essence.', activity: 'Closure' },
        { label: 'Gallery Walk', sub: 'Students circulate the room reviewing peer artifacts and recording reflections.', activity: 'Closure' },
        { label: 'Snowball Toss', sub: 'Students write a key takeaway on paper, toss it, and read a peer response.', activity: 'Closure' }
      ],
      assessments: [
        { label: 'Exit & Entry Tickets', sub: 'Short prompts answered at start or end of class.', type: 'Formative Assessment' },
        { label: 'In-Class Digital Polling', sub: 'Live interactive quizzes (Kahoot, Mentimeter) for instant feedback.', type: 'Formative Assessment' },
        { label: 'Whiteboard Response Checks', sub: 'Quick answers held up simultaneously.', type: 'Formative Assessment' },
        { label: 'Unit Tests', sub: 'Formal evaluation across multiple topics.', type: 'Summative Assessment' }
      ]
    };

    $('#scheme').innerHTML = '<option value="Economics">Economics</option><option value="Business">Business</option>';
    toast('Preview mode: sample data. Connect your Apps Script URL for live data.');
    start();
    return;
  }

  // Live data from the Apps Script backend
  PlannerAPI.call('getDatabase')
    .then(r => {
      db = r.data || {};
      applyDatabase(db, r.missing);
    })
    .catch(e => {
      toast('Could not read spreadsheet database: ' + e.message);
      showPlannerMessage('Database unavailable', e.message);
    });
}

/** Fills the scheme dropdown and starts the tree. */
function applyDatabase(data, missing) {
  const schemes = (data.schemes && data.schemes.length) ? data.schemes : [{ label: 'Economics' }];
  $('#scheme').innerHTML = schemes.map(s => `<option value="${esc(s.label)}">${esc(s.label)}</option>`).join('');
  if (missing && missing.length) {
    toast('Notice: missing sheet tabs — ' + missing.join(', '));
  }
  start();
}

$('#reload').onclick = init;
$('#reset').onclick = start;
$('#redesign-tpl-btn').onclick = () => {
  const tpl = $('#tpl').value.trim() || DEFAULT_TEMPLATE_ID;
  const btn = $('#redesign-tpl-btn');
  btn.disabled = true;
  btn.textContent = 'Applying Executive Design to Template…';
  if (DEMO) {
    toast('Preview mode cannot edit Drive files. Connect your Apps Script URL to enable this.');
    btn.disabled = false;
    btn.textContent = '🎨 Redesign Master Template in Drive';
    return;
  }
  PlannerAPI.call('redesignMasterTemplate', { templateId: tpl }, { timeout: 180000 })
    .then(() => {
      toast('✓ Master template successfully redesigned with executive layout!');
      btn.disabled = false;
      btn.textContent = '✓ Master Template Redesigned';
      setTimeout(() => { btn.textContent = '🎨 Redesign Master Template in Drive'; }, 3500);
    })
    .catch(e => {
      toast('Could not redesign template: ' + e.message);
      btn.disabled = false;
      btn.textContent = '🎨 Redesign Master Template in Drive';
    });
};
$('#scheme').onchange = () => {
  if (G.length <= 1 && (!G[0] || !G[0].done)) start();
};
window.addEventListener('resize', () => {
  if (G.length) layout();
});

/* ============================================================
   AUTH + APP SHELL
   ============================================================ */

function initials(user) {
  const name = String((user && (user.name || user.email)) || '?').trim();
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function showPlannerMessage(title, message) {
  toast(title + (message ? ': ' + message : ''));
}

function setAuthMsg(text, kind) {
  const el = $('#authMsg');
  el.textContent = text || '';
  el.className = 'auth-msg' + (kind ? ' ' + kind : '');
}

function setAuthBusy(busy, label) {
  const btn = $('#authSubmit');
  btn.disabled = !!busy;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = label || 'Please wait…';
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
    delete btn.dataset.label;
  }
}

function showAuth() {
  $('#auth').hidden = false;
  $('#app').hidden = true;
}

function showApp() {
  $('#auth').hidden = true;
  $('#app').hidden = false;
}

function enterApp(user) {
  CURRENT_USER = user || {};
  DEMO = false;
  $('#userName').textContent = CURRENT_USER.name || CURRENT_USER.email || 'Account';
  $('#umName').textContent = CURRENT_USER.name || 'Signed in';
  $('#umEmail').textContent = CURRENT_USER.email || '';
  $('#avatar').textContent = initials(CURRENT_USER);
  $('#umInstall').hidden = false;
  $('#authInstall').hidden = false;
  $('#demoBanner').hidden = true;
  $('#authMode').textContent = 'Connected';
  showApp();
  init();
}

function enterDemo() {
  DEMO = true;
  CURRENT_USER = { name: 'Preview mode', email: 'sample data', role: 'teacher' };
  $('#userName').textContent = 'Preview';
  $('#umName').textContent = 'Preview mode';
  $('#umEmail').textContent = 'Sample data — not signed in';
  $('#avatar').textContent = 'PV';
  $('#umInstall').hidden = false;
  $('#authInstall').hidden = false;
  $('#authMode').textContent = 'Demo mode';
  $('#demoBanner').hidden = false;
  showApp();
  init();
}

function signOut() {
  const finish = () => {
    PlannerAPI.clearSession();
    DEMO = false;
    CURRENT_USER = null;
    location.reload();
  };
  if (DEMO || !PlannerAPI.hasBackend()) { finish(); return; }
  PlannerAPI.call('logout', {}, { timeout: 10000 }).then(finish, finish);
}

function pingBackend() {
  const url = PlannerAPI.apiUrl();
  $('#authMode').textContent = url ? 'Connecting…' : 'Not connected';

  if (!url) {
    setAuthMsg('No backend URL is set in config.js.', 'err');
    return Promise.resolve(false);
  }

  if (/\/macros\/library\//.test(url)) {
    $('#authMode').textContent = 'Connection failed';
    setAuthMsg('The URL in config.js is an Apps Script library link, not a Web App. In Apps Script choose Deploy → Manage deployments → Web app and use the URL that ends in /exec.', 'err');
    return Promise.resolve(false);
  }

  return PlannerAPI.call('authStatus', {}, { timeout: 20000 })
    .then(status => {
      $('#authMode').textContent = 'Connected';
      if (status && status.accounts === 0) {
        setAuthMsg('Connected, but there are no accounts yet. Add a row to the Database_Logins tab in the database spreadsheet.', 'err');
      } else {
        setAuthMsg('');
      }
      return true;
    })
    .catch(err => {
      $('#authMode').textContent = 'Connection failed';
      setAuthMsg('Could not reach the backend. ' + err.message, 'err');
      return false;
    });
}

function submitAuth(e) {
  e.preventDefault();
  if (DEMO) { enterDemo(); return; }

  const url = PlannerAPI.apiUrl();
  if (!url || /\/macros\/library\//.test(url)) {
    setAuthMsg('The backend URL in config.js must be the Web App URL that ends in /exec.', 'err');
    return;
  }

  const email = $('#authEmail').value.trim();
  const password = $('#authPass').value;
  const remember = $('#authRemember').checked;

  if (!email || !email.includes('@')) { setAuthMsg('Enter a valid email address.', 'err'); return; }
  if (!password) { setAuthMsg('Enter your password.', 'err'); return; }

  setAuthMsg('');
  setAuthBusy(true, 'Signing in…');

  PlannerAPI.call('login', { email: email, password: password }, { timeout: 30000 })
    .then(result => {
      PlannerAPI.saveSession(result.token, result.user, remember);
      setAuthBusy(false);
      enterApp(result.user);
    })
    .catch(err => {
      setAuthBusy(false);
      setAuthMsg(err.message, 'err');
    });
}

function wireAuth() {
  $('#authForm').addEventListener('submit', submitAuth);
  $('#authDemo').addEventListener('click', enterDemo);
  $('#authInstall').addEventListener('click', installApp);
}

function wireUserMenu() {
  $('#userBtn').addEventListener('click', e => {
    e.stopPropagation();
    const open = $('#userMenu').hidden;
    $('#userMenu').hidden = !open;
    $('#userBtn').setAttribute('aria-expanded', String(open));
  });

  $('#gear').addEventListener('click', e => {
    e.stopPropagation();
    const open = !$('#panel').classList.contains('open');
    $('#panel').classList.toggle('open', open);
    $('#gear').setAttribute('aria-expanded', String(open));
    $('#userMenu').hidden = true;
    $('#userBtn').setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#userbox')) {
      $('#userMenu').hidden = true;
      $('#userBtn').setAttribute('aria-expanded', 'false');
    }
    if (!e.target.closest('#panel') && !e.target.closest('#gear')) {
      $('#panel').classList.remove('open');
      $('#gear').setAttribute('aria-expanded', 'false');
    }
  });

  $('#umSignout').addEventListener('click', signOut);
  $('#umInstall').addEventListener('click', installApp);
}

function wireScrolling() {
  const wrap = $('#wrap');
  let down = false, moved = false, startX = 0, startY = 0, startL = 0, startT = 0;

  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    if (e.target.closest('button, input, select, textarea, a, .card, .dn')) return;
    down = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    startL = wrap.scrollLeft; startT = wrap.scrollTop;
  });

  wrap.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) { moved = true; wrap.classList.add('panning'); }
    wrap.scrollLeft = startL - dx;
    wrap.scrollTop = startT - dy;
  });

  const end = () => {
    if (!down) return;
    down = false;
    wrap.classList.remove('panning');
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointerleave', end);
  wrap.addEventListener('pointercancel', end);
}

function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.then(() => {
      installPrompt = null;
      $('#authInstall').hidden = true;
      $('#umInstall').hidden = true;
    });
    return;
  }
  toast('To install: open your browser menu and choose “Install app” or “Add to Home screen”.');
}

function wireInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    $('#authInstall').hidden = false;
    if (CURRENT_USER) $('#umInstall').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('#authInstall').hidden = true;
    $('#umInstall').hidden = true;
    toast('✓ Lesson Tree Planner installed.');
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}

function boot() {
  showAuth();
  wireAuth();
  wireUserMenu();
  wireScrolling();
  wireInstall();
  registerServiceWorker();

  const session = PlannerAPI.readSession();
  const url = PlannerAPI.apiUrl();

  if (!url) {
    pingBackend();
    return;
  }

  // Validate any remembered session before showing the planner.
  if (session && session.token) {
    $('#authMode').textContent = 'Restoring session…';
    PlannerAPI.call('whoami', {}, { timeout: 20000 })
      .then(r => {
        const user = (r && r.user) || session.user;
        if (!user) throw new Error('Session expired.');
        enterApp(user);
      })
      .catch(err => {
        if (err && err.api) {
          PlannerAPI.clearSession();
          pingBackend().then(() => setAuthMsg('Your session expired. Please sign in again.'));
        } else {
          pingBackend();
        }
      });
    return;
  }

  pingBackend();
}

boot();

