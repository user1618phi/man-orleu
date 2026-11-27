import { distinct, int, pick } from "../rng";
import { money, same } from "../format";
import type { TaskTemplate } from "../types";

export const hay: TaskTemplate = {
  id: "hay",
  title: { kk: "Қысқа шөп", ru: "Сено на зиму" },
  context: "farm",
  params(rng, level) {
    for (;;) {
      const Q = level === 1 ? pick(rng, [23, 34, 47, 52]) : int(rng, 15, 60, 5);
      const H = pick(rng, [2, 3, 4]);
      const D = pick(rng, [90, 120, 150]);
      const B = level === 3 ? pick(rng, [18, 22, 24, 26]) : pick(rng, [20, 25, 30]);
      const kg = Q * H * D;
      const exact = kg / B;
      if (Number.isInteger(exact)) continue;
      const need = Math.ceil(exact);
      const price = pick(rng, [1500, 1800, 2000, 2500]);
      const budget = Math.round((need * price * pick(rng, [0.85, 0.92, 1.08, 1.15])) / 10000) * 10000;
      if (Math.abs(budget - need * price) < 1) continue;
      if (!distinct([need, Math.floor(exact), kg, Math.ceil((Q * H) / B), exact], 0.05)) continue;
      return { Q, H, D, B, price, budget };
    }
  },
  situation: {
    kk: "Ерболдың атасы қойларына қысқа шөп сатып алмақ. Шөп тайлап сатылады, жартылай тай сатылмайды. Ербол атасына қанша тай керек екенін есептеп береді.",
    ru: "Дедушка Ербола покупает сено для овец на зиму. Сено продают тюками, половину тюка не продают. Ербол помогает посчитать, сколько тюков нужно.",
  },
  stimulus: (p) => [
    {
      kind: "card",
      title: { kk: "Шаруашылық", ru: "Хозяйство" },
      facts: [
        { label: { kk: "қой саны", ru: "овец" }, value: { id: "q", text: () => same(String(p.Q)), needed: true } },
        { label: { kk: "бір қойға күніне", ru: "на одну овцу в день" }, value: { id: "h", text: () => same(`${p.H} кг`), needed: true } },
        { label: { kk: "қыстау", ru: "зимовка" }, value: { id: "d", text: () => ({ kk: `${p.D} күн`, ru: `${p.D} дней` }), needed: true } },
        { label: { kk: "жылқы", ru: "лошадей" }, value: { id: "horse", text: () => same("2"), needed: false, trap: true } },
      ],
    },
    {
      kind: "receipt",
      title: { kk: "Шөп сатушы", ru: "Продавец сена" },
      lines: [
        { label: { kk: "бір тай", ru: "один тюк" }, value: { id: "b", text: () => same(`${p.B} кг`), needed: true } },
        { label: { kk: "бағасы", ru: "цена" }, value: { id: "price", text: () => ({ kk: `${money(p.price)} / тай`, ru: `${money(p.price)} / тюк` }), needed: false } },
        { label: { kk: "атаның ақшасы", ru: "у дедушки есть" }, value: { id: "budget", text: () => same(money(p.budget)), needed: false } },
      ],
      footnote: { id: "whole", text: () => ({ kk: "Тек бүтін тайлап сатылады", ru: "Продаётся только целыми тюками" }), needed: true },
    },
  ],
  formulate: {
    prompt: { kk: "Есепте не табу керек?", ru: "Что нужно найти в задаче?" },
    choices: [
      {
        text: { kk: "Бүкіл қысқа қанша тай шөп сатып алу керек", ru: "Сколько тюков сена купить на всю зиму" },
        correct: true,
        why: { kk: "Дұрыс: тайлап сатылады, сондықтан жауап — тай саны.", ru: "Верно: сено продают тюками, значит ответ — число тюков." },
      },
      {
        text: { kk: "Бір қой күніне қанша шөп жейді", ru: "Сколько сена съедает одна овца в день" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Бұл берілген. Сұрақ бүкіл отар мен бүкіл қыс туралы.", ru: "Это дано. Вопрос — про всё стадо и всю зиму." },
      },
      {
        text: { kk: "Қысқа барлығы неше килограмм шөп керек", ru: "Сколько всего килограммов сена нужно на зиму" },
        correct: false,
        errorType: "partial_solution",
        why: { kk: "Бұл аралық қадам: сатушы килограммен емес, таймен сатады.", ru: "Это промежуточный шаг: продают не килограммами, а тюками." },
      },
    ],
    dataHint: { kk: "Қой саны, күндік норма, қыс ұзақтығы, тай салмағы және ескерту.", ru: "Число овец, норма в день, длина зимы, вес тюка и примечание." },
  },
  employ: {
    prompt: { kk: "Атасы неше тай шөп сатып алуы керек?", ru: "Сколько тюков сена нужно купить дедушке?" },
    unit: { kk: "тай", ru: "тюк." },
    answer: (p) => Math.ceil((p.Q * p.H * p.D) / p.B),
    bugs: [
      { value: (p) => Math.floor((p.Q * p.H * p.D) / p.B), errorType: "wrong_operation", why: { kk: "Төмен қарай дөңгелектедің — шөп көктемге дейін жетпейді.", ru: "Ты округлил вниз — сена до весны не хватит." } },
      { value: (p) => (p.Q * p.H * p.D) / p.B, errorType: "ignored_condition", why: { kk: "Жартылай тай сатылмайды — дөңгелекте.", ru: "Половину тюка не продают — округли." } },
      { value: (p) => p.Q * p.H * p.D, errorType: "unit_error", why: { kk: "Бұл — килограмм. Тайға айналдыр.", ru: "Это килограммы. Переведи в тюки." } },
      { value: (p) => Math.ceil((p.Q * p.H) / p.B), errorType: "partial_solution", why: { kk: "Бұл тек бір күнге. Бүкіл қысты есепте.", ru: "Это только на один день. Посчитай на всю зиму." } },
    ],
    hints: [
      { kk: "Алдымен бүкіл отарға бүкіл қысқа неше килограмм керек екенін тап.", ru: "Сначала найди, сколько килограммов нужно всему стаду на всю зиму." },
      { kk: "Килограммды бір тайдың салмағына бөл. Бөлшек шықса, не істейсің?", ru: "Раздели килограммы на вес тюка. Если вышла дробь — что делать?" },
    ],
  },
  interpret: {
    prompt: { kk: "Атаның ақшасы керекті шөпке жете ме?", ru: "Хватит ли дедушкиных денег на нужное сено?" },
    choices: (p) => {
      const need = Math.ceil((p.Q * p.H * p.D) / p.B);
      const enough = need * p.price <= p.budget;
      const wrong = { kk: "Тай санын бағасына көбейтіп, атаның ақшасымен салыстыр.", ru: "Умножь число тюков на цену и сравни с деньгами дедушки." };
      return [
        { text: { kk: "Иә, жетеді", ru: "Да, хватит" }, correct: enough, errorType: enough ? undefined : "no_interpretation", why: enough ? { kk: "Дұрыс: шөптің құны атаның ақшасынан аз.", ru: "Верно: сено стоит меньше, чем есть у дедушки." } : wrong },
        { text: { kk: "Жоқ, ақша жетпейді", ru: "Нет, денег не хватит" }, correct: !enough, errorType: enough ? "no_interpretation" : undefined, why: !enough ? { kk: "Дұрыс: шөп атаның ақшасынан қымбат.", ru: "Верно: сено стоит дороже, чем есть у дедушки." } : wrong },
        { text: { kk: "Азырақ сатып алып, қойларды аз тамақтандыру", ru: "Купить меньше и кормить овец поменьше" }, correct: false, errorType: "no_interpretation", why: { kk: "Норма — қой аман қыстауы үшін. Сұрақ ақша туралы.", ru: "Норма нужна, чтобы овцы перезимовали. Вопрос — про деньги." } },
      ];
    },
  },
};
