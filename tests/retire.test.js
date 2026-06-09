/*
 * retire-inv 退休/FIRE 計算邏輯測試
 * --------------------------------------------------
 * 直接從 ../index.app.js 抽出純計算函式做斷言，
 * 不依賴 React / 瀏覽器，純 Node 即可跑：
 *
 *     node tests/retire.test.js
 *
 * 測試的函式（皆為 index.app.js 內的實際程式碼）：
 *   simulate, simShock, coastYearsTo, monteCarlo,
 *   calcLaborPension, eduStage, eduCostYear, FIRE_TYPES
 *
 * 若這些函式的邏輯改了、結果跟預期不符，測試會 FAIL，
 * 方便你日後改程式時確認沒把算式改壞。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.app.js'), 'utf8').replace(/\x00/g, '');

/* ---- 從原始碼抽出指定區塊（以括號配對抓出完整定義） ---- */
function balanced(src, fromIdx, open, close) {
  const start = src.indexOf(open, fromIdx);
  if (start < 0) throw new Error('open not found from ' + fromIdx);
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) { depth--; if (depth === 0) return src.slice(fromIdx, j + 1); }
  }
  throw new Error('unbalanced block');
}
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('找不到 function ' + name + '（index.app.js 可能改名/被搬走）');
  return balanced(SRC, i, '{', '}');
}
function constArr(name) { const i = SRC.indexOf('const ' + name); return balanced(SRC, i, '[', ']') + ';'; }
function constObj(name) { const i = SRC.indexOf('const ' + name); return balanced(SRC, i, '{', '}') + ';'; }
function constLine(name) { const i = SRC.indexOf('const ' + name); return SRC.slice(i, SRC.indexOf(';', i) + 1); }

/* 把需要的定義組起來後 eval，匯出成物件 */
const bundle = [
  constLine('WAN'),
  constObj('EDU_DEFAULT'),
  constArr('FIRE_TYPES'),
  fn('eduStage'),
  fn('eduCostYear'),
  fn('simulate'),
  fn('simShock'),
  fn('coastYearsTo'),
  fn('gaussian'),
  fn('monteCarlo'),
  fn('calcLaborPension'),
  'return { WAN, EDU_DEFAULT, FIRE_TYPES, eduStage, eduCostYear, simulate, simShock, coastYearsTo, monteCarlo, calcLaborPension };'
].join('\n');

const L = (new Function(bundle))();

/* ---------------- 迷你測試框架 ---------------- */
let pass = 0, fail = 0; const fails = [];
function eq(name, got, exp) { if (got === exp) pass++; else { fail++; fails.push(`${name}: got ${got}, exp ${exp}`); } }
function near(name, got, exp, eps = 1e-6) { if (Math.abs(got - exp) <= eps) pass++; else { fail++; fails.push(`${name}: got ${got}, exp ${exp}`); } }
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

/* ================= FIRE_TYPES ================= */
(() => {
  const t = L.FIRE_TYPES; const by = id => t.find(x => x.id === id);
  eq('FIRE_TYPES 共 5 種', t.length, 5);
  eq('Regular 倍率=1', by('regular').expMult, 1);
  eq('Lean 倍率=0.6', by('lean').expMult, 0.6);
  eq('Fat 倍率=1.8', by('fat').expMult, 1.8);
  ok('Barista 標記 barista', by('barista').barista === true);
  ok('Coast 標記 coast', by('coast').coast === true);
})();

/* ================= simulate ================= */
(() => {
  const p = { age0: 40, year0: 2025, asset0: 100, monthly: 10, rWork: 0.05, rRetire: 0.04, inflation: 0.03, retireYear: 2027, withdraw0: 50 };
  const rows = L.simulate(p);
  eq('simulate 列數 = 100-age0', rows.length, 60);
  eq('第一年(2026) 年份', rows[0].year, 2026);
  eq('第一年(2026) 年齡', rows[0].age, 41);
  near('累積期：100*1.05 + 120 = 225', rows[0].value, 225);
  eq('累積期不提領', rows[0].withdraw, 0);
  const r42 = rows.find(r => r.age === 42);                 // 2027 = 退休首年
  near('退休首年提領 50*(1.03^2)', r42.withdraw, 50 * Math.pow(1.03, 2));
  near('退休首年資產 (225-53.045)*1.04', r42.value, (225 - 50 * Math.pow(1.03, 2)) * 1.04);

  // Coast：停止投入（monthly=0），累積期只靠複利
  const c = L.simulate({ ...p, monthly: 0, retireYear: 2030, withdraw0: 0 });
  near('monthly=0 累積期只複利 100*1.05', c[0].value, 105);
})();

/* ================= simulate（Barista 兼職分攤） ================= */
(() => {
  const p = { age0: 40, year0: 2025, asset0: 100, monthly: 10, rWork: 0.05, rRetire: 0.04, inflation: 0.03, retireYear: 2027, withdraw0: 50, baristaIncome: 30, baristaUntilAge: 43 };
  const rows = L.simulate(p);
  const r42 = rows.find(r => r.age === 42);   // 42<43 → 兼職分攤生效
  near('Barista 期間提領 = (50-30)*1.03^2', r42.withdraw, 20 * Math.pow(1.03, 2));
  const r43 = rows.find(r => r.age === 43);   // 43 不<43 → 恢復全額
  near('兼職結束後恢復全額提領', r43.withdraw, 50 * Math.pow(1.03, 3));
})();

/* ================= coastYearsTo ================= */
(() => {
  eq('已達標 → 0 年', L.coastYearsTo(300, 10, 0.05, 300), 0);
  eq('100→300 需 2 年', L.coastYearsTo(100, 10, 0.05, 300), 2);
  eq('永遠到不了 → null', L.coastYearsTo(1, 0, 0, 2), null);
})();

/* ================= simShock（長照衝擊） ================= */
(() => {
  const p = { age0: 60, year0: 2025, asset0: 1000, monthly: 0, rWork: 0.04, rRetire: 0.04, inflation: 0, retireYear: 2025, withdraw0: 40 };
  const base = L.simShock(p, null);
  const shocked = L.simShock(p, { age: 62, monthly: 5, years: 2 });
  near('無衝擊 61歲 (1000-40)*1.04', base.find(r => r.age === 61).value, 998.4);
  near('無衝擊 62歲', base.find(r => r.age === 62).value, 996.736);
  near('有衝擊 62歲 多扣 5*12', shocked.find(r => r.age === 62).value, 934.336);
  ok('衝擊後資產較低', shocked[shocked.length - 1].value < base[base.length - 1].value);
})();

/* ================= calcLaborPension（勞保年金） ================= */
(() => {
  const a = L.calcLaborPension(5, 10);   // 年資<15 不符資格
  eq('年資<15 → 月領 0', a.monthly, 0);
  ok('年資<15 → 不符資格', a.eligible === false);
  const b = L.calcLaborPension(5, 30);   // 月薪5萬封頂45800、年資30
  eq('投保薪資封頂 45800', b.base, 45800);
  ok('符合請領資格', b.eligible === true);
  near('B式較高 45800*30*0.0155', b.monthly, 45800 * 30 * 0.0155);
  ok('採用 B 式', b.useB === true);
})();

/* ================= monteCarlo（vol=0 時為確定性） ================= */
(() => {
  const win = { age0: 40, year0: 2025, asset0: 1000, monthly: 10, rWork: 0.05, rRetire: 0.04, inflation: 0.03, retireYear: 2080, withdraw0: 1 };
  const mcWin = L.monteCarlo(win, 0, 0, 50);
  eq('穩健情境成功率=100%', mcWin.successRate, 1);
  eq('百分位序列長度 = 100-age0', mcWin.p50.length, 60);

  const lose = { age0: 60, year0: 2025, asset0: 10, monthly: 0, rWork: 0, rRetire: 0, inflation: 0, retireYear: 2025, withdraw0: 40 };
  const mcLose = L.monteCarlo(lose, 0, 0, 50);
  eq('必然耗盡情境成功率=0%', mcLose.successRate, 0);
})();

/* ================= 教育金 ================= */
(() => {
  eq('5歲→幼兒園', L.eduStage(5), 'pre');
  eq('7歲→國小', L.eduStage(7), 'elem');
  eq('13歲→國中', L.eduStage(13), 'jun');
  eq('16歲→高中', L.eduStage(16), 'sen');
  eq('20歲→大學', L.eduStage(20), 'uni');
  eq('2歲→學齡前(null)', L.eduStage(2), null);
  eq('25歲→已畢業(null)', L.eduStage(25), null);
  eq('公立國小年費=2萬', L.eduCostYear([{ age: 6, priv: false }], L.EDU_DEFAULT, 0), 2);
  eq('私立國小年費=25萬', L.eduCostYear([{ age: 6, priv: true }], L.EDU_DEFAULT, 0), 25);
  eq('5歲讀幼兒園=6萬', L.eduCostYear([{ age: 5, priv: false }], L.EDU_DEFAULT, 0), 6);
})();

/* ---------------- 輸出結果 ---------------- */
console.log(`\nretire-inv 計算邏輯測試：${pass} 通過 / ${fail} 失敗（共 ${pass + fail}）`);
if (fail) { console.log('\n失敗項目：'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
else { console.log('✓ 全部通過'); }
