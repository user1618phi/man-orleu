// For every template and 200 seeds: no bug path equals the answer or another bug path,
// exactly one correct choice per step, all texts present in both languages.
import { TEMPLATES } from "../lib/templates";
import { allCells, instantiate, checkEmploy } from "../lib/engine";
import type { L } from "../lib/types";

const SEEDS = 200;
let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures < 40) console.error("FAIL", msg);
};
const okL = (l: L, where: string) => {
  if (!l.kk?.trim() || !l.ru?.trim()) fail(`${where}: empty text`);
};

for (const t of TEMPLATES) {
  okL(t.title, `${t.id}.title`);
  okL(t.situation, `${t.id}.situation`);
  if (/\d/.test(t.situation.kk) || /\d/.test(t.situation.ru)) fail(`${t.id}: digits inside situation prose`);
  if (t.formulate.choices.filter((c) => c.correct).length !== 1) fail(`${t.id}: formulate must have one correct choice`);
  for (let seed = 0; seed < SEEDS; seed++) {
    const inst = instantiate(t, seed);
    const p = inst.params;
    const tol = t.employ.tolerance ?? 0.01;
    const ans = t.employ.answer(p);
    const vals = [ans, ...t.employ.bugs.map((b) => b.value(p))];
    if (!vals.every(Number.isFinite)) fail(`${t.id}#${seed}: non-finite value ${vals}`);
    if (ans <= 0) fail(`${t.id}#${seed}: answer not positive (${ans})`);
    for (let i = 0; i < vals.length; i++)
      for (let j = i + 1; j < vals.length; j++)
        if (Math.abs(vals[i] - vals[j]) <= 2 * tol) fail(`${t.id}#${seed}: path ${i} == path ${j} (${vals[i]})`);
    if (!checkEmploy(inst, ans).correct) fail(`${t.id}#${seed}: answer not accepted`);
    t.employ.bugs.forEach((b, i) => {
      const v = checkEmploy(inst, b.value(p));
      if (v.correct || v.bugIndex !== i) fail(`${t.id}#${seed}: bug ${i} not diagnosed`);
    });
    const ic = t.interpret.choices(p);
    if (ic.filter((c) => c.correct).length !== 1) fail(`${t.id}#${seed}: interpret must have one correct choice`);
    ic.forEach((c, i) => okL(c.text, `${t.id}#${seed}.interpret[${i}]`));
    const cells = allCells(inst.stimulus);
    const ids = new Set(cells.map((c) => c.id));
    if (ids.size !== cells.length) fail(`${t.id}: duplicate cell ids`);
    for (const c of cells) {
      const txt = c.text(p);
      okL(txt, `${t.id}#${seed}.cell ${c.id}`);
      if (/NaN|undefined|Infinity/.test(txt.kk + txt.ru)) fail(`${t.id}#${seed}: bad cell ${c.id} ${txt.ru}`);
    }
  }
  console.log(`ok  ${t.id.padEnd(10)} ${SEEDS} seeds, ${t.employ.bugs.length} bug paths`);
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nall ${TEMPLATES.length} templates passed`);
