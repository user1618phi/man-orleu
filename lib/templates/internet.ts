import { distinct, pick } from "../rng";
import { money, num, same } from "../format";
import type { TaskTemplate } from "../types";

export const internet: TaskTemplate = {
  id: "internet",
  title: { kk: "Мобильді интернет", ru: "Мобильный интернет" },
  context: "tariff",
  params(rng, level) {
    for (;;) {
      const U = level === 1 ? pick(rng, [1, 2, 3, 4]) : pick(rng, [1.5, 2, 2.5, 3, 3.5, 4.5]);
      const Q = level === 1 ? pick(rng, [0.5, 1]) : pick(rng, [0.3, 0.4, 0.5, 0.6, 0.8]);
      const cost = Math.round(U * 1000 * Q);
      const P = pick(rng, [990, 1490, 1990, 2490]);
      const X = pick(rng, [5, 8, 10]);
      const p = { U, Q, P, X };
      if (Math.abs(P - cost) < 50) continue;
      if (!distinct([cost, U * Q, U * 100 * Q, U * 1000, (U * 1000) / Q], 1.1)) continue;
      return p;
    }
  },
  situation: {
    kk: "Арман айына интернетке қанша жұмсайтынын білгісі келеді. Оператор екі тариф ұсынады: пакет немесе әр мегабайт үшін төлеу. Арман өткен айда қанша трафик жұмсағанын телефонынан қарады.",
    ru: "Арман хочет понять, сколько он тратит на интернет в месяц. Оператор предлагает два тарифа: пакет или оплата за каждый мегабайт. Арман посмотрел в телефоне, сколько трафика ушло за прошлый месяц.",
  },
  stimulus: (p) => [
    {
      kind: "table",
      caption: { kk: "Тарифтер", ru: "Тарифы" },
      head: [
        { kk: "тариф", ru: "тариф" },
        { kk: "не кіреді", ru: "что входит" },
        { kk: "бағасы", ru: "цена" },
      ],
      rows: [
        [
          { id: "pkg", text: () => ({ kk: "Пакет", ru: "Пакет" }), needed: false },
          { id: "pkgx", text: () => same(`${p.X} ГБ`), needed: false },
          { id: "pkgp", text: () => ({ kk: `${money(p.P)} / ай`, ru: `${money(p.P)} / мес` }), needed: true },
        ],
        [
          { id: "mb", text: () => ({ kk: "Мегабайтпен", ru: "По мегабайтам" }), needed: false },
          { id: "mbx", text: () => ({ kk: "шектеусіз", ru: "без лимита" }), needed: false },
          { id: "mbq", text: () => same(`${num(p.Q)} ₸ / 1 МБ`), needed: true },
        ],
      ],
      footnote: { id: "conv", text: () => same("1 ГБ = 1000 МБ"), needed: true },
    },
    {
      kind: "card",
      title: { kk: "Телефондағы статистика", ru: "Статистика в телефоне" },
      facts: [
        { label: { kk: "өткен айда", ru: "за прошлый месяц" }, value: { id: "use", text: () => same(`${num(p.U)} ГБ`), needed: true } },
        { label: { kk: "қоңыраулар", ru: "звонки" }, value: { id: "calls", text: () => same("140 мин"), needed: false, trap: true } },
      ],
    },
  ],
  formulate: {
    prompt: { kk: "Есепте не табу керек?", ru: "Что нужно найти в задаче?" },
    choices: [
      {
        text: { kk: "Арманға қай тариф арзанырақ", ru: "Какой тариф дешевле для Армана" },
        correct: true,
        why: { kk: "Дұрыс: оның трафигімен екі тарифті салыстыру керек.", ru: "Верно: нужно сравнить два тарифа при его трафике." },
      },
      {
        text: { kk: "Пакетте қанша гигабайт бар", ru: "Сколько гигабайт в пакете" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Бұл кестеде жазылған. Сұрақ ақша туралы.", ru: "Это написано в таблице. Вопрос — про деньги." },
      },
      {
        text: { kk: "Арман айына неше минут сөйлейді", ru: "Сколько минут Арман говорит по телефону" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Қоңыраулар бұл есепке қатысы жоқ.", ru: "Звонки к этой задаче не относятся." },
      },
    ],
    dataHint: { kk: "Трафик гигабайтпен, ал баға мегабайтпен берілген. Ескертуді қара.", ru: "Трафик дан в гигабайтах, а цена — за мегабайт. Посмотри примечание." },
  },
  employ: {
    prompt: { kk: "«Мегабайтпен» тарифі бойынша Арман айына неше теңге төлер еді?", ru: "Сколько тенге в месяц Арман заплатил бы по тарифу «По мегабайтам»?" },
    unit: same("₸"),
    answer: (p) => Math.round(p.U * 1000 * p.Q),
    tolerance: 0.5,
    bugs: [
      {
        value: (p) => p.U * p.Q,
        errorType: "unit_error",
        why: { kk: "Гигабайтты мегабайтқа айналдырмадың.", ru: "Ты не перевёл гигабайты в мегабайты." },
      },
      {
        value: (p) => p.U * 100 * p.Q,
        errorType: "unit_error",
        why: { kk: "1 ГБ-та неше МБ бар екенін тексер.", ru: "Проверь, сколько МБ в 1 ГБ." },
      },
      {
        value: (p) => p.U * 1000,
        errorType: "partial_solution",
        why: { kk: "Бұл — мегабайт саны. Енді бағаны есепте.", ru: "Это число мегабайт. Теперь посчитай цену." },
      },
      {
        value: (p) => (p.U * 1000) / p.Q,
        errorType: "wrong_operation",
        why: { kk: "Бөлудің орнына көбейту керек еді.", ru: "Нужно было умножить, а не разделить." },
      },
    ],
    hints: [
      { kk: "Алдымен трафикті мегабайтқа айналдыр.", ru: "Сначала переведи трафик в мегабайты." },
      { kk: "Мегабайт санын 1 МБ бағасына көбейт.", ru: "Умножь число мегабайт на цену 1 МБ." },
    ],
  },
  interpret: {
    prompt: { kk: "Арманға қай тариф тиімді?", ru: "Какой тариф выгоднее Арману?" },
    choices: (p) => {
      const pkg = p.P < p.U * 1000 * p.Q;
      const wrong = { kk: "Өз жауабыңды пакет бағасымен салыстыр.", ru: "Сравни свой ответ с ценой пакета." };
      return [
        { text: { kk: "Пакет", ru: "Пакет" }, correct: pkg, errorType: pkg ? undefined : "no_interpretation", why: pkg ? { kk: "Дұрыс: пакет арзанырақ.", ru: "Верно: пакет дешевле." } : wrong },
        { text: { kk: "Мегабайтпен төлеу", ru: "Оплата по мегабайтам" }, correct: !pkg, errorType: pkg ? "no_interpretation" : undefined, why: !pkg ? { kk: "Дұрыс: мегабайтпен арзанырақ.", ru: "Верно: по мегабайтам дешевле." } : wrong },
        { text: { kk: "Айырмашылығы жоқ", ru: "Без разницы" }, correct: false, errorType: "no_interpretation", why: { kk: "Екі сома тең емес — салыстыр.", ru: "Суммы не равны — сравни их." } },
      ];
    },
  },
};
