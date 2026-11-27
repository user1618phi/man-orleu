import { distinct, int } from "../rng";
import { same } from "../format";
import type { Cell, Params, TaskTemplate } from "../types";

const DAYS = [
  { kk: "дүйсенбі", ru: "понедельник" },
  { kk: "сейсенбі", ru: "вторник" },
  { kk: "сәрсенбі", ru: "среда" },
  { kk: "бейсенбі", ru: "четверг" },
  { kk: "жұма", ru: "пятница" },
  { kk: "сенбі", ru: "суббота" },
];
const temps = (p: Params) => [p.t0, p.t1, p.t2, p.t3, p.t4, p.t5];
const deg = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)} °C`;
const sum = (p: Params) => temps(p).reduce((a, b) => a + b, 0);

export const weather: TaskTemplate = {
  id: "weather",
  title: { kk: "Көшет отырғызу уақыты", ru: "Когда высаживать рассаду" },
  context: "chart",
  params(rng, level) {
    for (;;) {
      const m = int(rng, 5, 12);
      const spread = level === 1 ? 4 : level === 2 ? 6 : 8;
      const t = Array.from({ length: 5 }, () => m + int(rng, -spread, spread));
      const last = 6 * m - t.reduce((a, b) => a + b, 0);
      if (last < m - spread || last > m + spread) continue;
      const all = [...t, last];
      const mx = Math.max(...all);
      const mn = Math.min(...all);
      const s = 6 * m;
      if (!distinct([m, s, s / 7, (mx + mn) / 2, mx - mn], 0.2)) continue;
      return { t0: all[0], t1: all[1], t2: all[2], t3: all[3], t4: all[4], t5: all[5] };
    }
  },
  situation: {
    kk: "Мектеп жылыжайынан көшетті ашық жерге шығару керек. Агроном екі шарт қойды. Оқушылар бір апта бойы таңертең температураны өлшеп, кестеге жазды.",
    ru: "Рассаду из школьной теплицы пора высаживать в открытый грунт. Агроном поставил два условия. Ученики неделю измеряли температуру по утрам и записали её в таблицу.",
  },
  stimulus: (p) => [
    {
      kind: "table",
      caption: { kk: "Таңғы температура", ru: "Утренняя температура" },
      head: [
        { kk: "күн", ru: "день" },
        { kk: "таңертең", ru: "утром" },
      ],
      rows: temps(p).map((v, i): Cell[] => [
        { id: `d${i}`, text: () => DAYS[i], needed: false },
        { id: `t${i}`, text: () => same(deg(v)), needed: true },
      ]),
      footnote: { id: "sun", text: () => ({ kk: "Жексенбіде өлшенбеді", ru: "В воскресенье не измеряли" }), needed: true },
    },
    {
      kind: "card",
      title: { kk: "Агрономның шарттары", ru: "Условия агронома" },
      facts: [
        { label: { kk: "апталық орташа", ru: "средняя за неделю" }, value: { id: "c1", text: () => ({ kk: "8 °C-тан төмен емес", ru: "не ниже 8 °C" }), needed: false } },
        { label: { kk: "ең суық күн", ru: "самый холодный день" }, value: { id: "c2", text: () => ({ kk: "2 °C-тан төмен емес", ru: "не ниже 2 °C" }), needed: false } },
        { label: { kk: "көшет саны", ru: "сколько рассады" }, value: { id: "n", text: () => same("120"), needed: false, trap: true } },
      ],
    },
  ],
  formulate: {
    prompt: { kk: "Есепте не табу керек?", ru: "Что нужно найти в задаче?" },
    choices: [
      {
        text: { kk: "Апталық орташа температураны және ең суық күнді — сосын шарттармен салыстыру", ru: "Среднюю температуру за неделю и самый холодный день — и сравнить с условиями" },
        correct: true,
        why: { kk: "Дұрыс: агрономның екі шарты да тексеріледі.", ru: "Верно: проверяются оба условия агронома." },
      },
      {
        text: { kk: "Ең жылы күнді", ru: "Самый тёплый день" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Шарттарда ең жылы күн туралы ештеңе жоқ.", ru: "В условиях нет ничего про самый тёплый день." },
      },
      {
        text: { kk: "Неше көшет отырғызу керек", ru: "Сколько рассады высаживать" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Көшет саны ауа райына байланысты емес.", ru: "Количество рассады не зависит от погоды." },
      },
    ],
    dataHint: { kk: "Кестедегі барлық күн және жексенбі туралы ескерту.", ru: "Все дни из таблицы и примечание про воскресенье." },
  },
  employ: {
    prompt: { kk: "Өлшенген күндердегі орташа температура неше градус?", ru: "Чему равна средняя температура за дни с замерами?" },
    unit: same("°C"),
    answer: (p) => sum(p) / 6,
    tolerance: 0.05,
    bugs: [
      { value: (p) => sum(p), errorType: "partial_solution", why: { kk: "Бұл — қосынды. Орташаны табу үшін бір қадам қалды.", ru: "Это сумма. До среднего остался один шаг." } },
      { value: (p) => sum(p) / 7, errorType: "ignored_condition", why: { kk: "Жексенбіде өлшенбеді — кестеде неше күн бар?", ru: "В воскресенье не измеряли — сколько дней в таблице?" } },
      { value: (p) => (Math.max(...temps(p)) + Math.min(...temps(p))) / 2, errorType: "wrong_operation", why: { kk: "Сен тек ең жылы мен ең суық күнді алдың. Орташа барлық күннен есептеледі.", ru: "Ты взял только самый тёплый и самый холодный день. Среднее считается по всем дням." } },
      { value: (p) => Math.max(...temps(p)) - Math.min(...temps(p)), errorType: "wrong_operation", why: { kk: "Бұл — ауытқу (ең жылы мен ең суықтың айырмасы), орташа емес.", ru: "Это разброс (разница самого тёплого и холодного), а не среднее." } },
    ],
    hints: [
      { kk: "Барлық өлшенген күндердің температурасын қос.", ru: "Сложи температуру всех дней с замерами." },
      { kk: "Қосындыны өлшенген күн санына бөл.", ru: "Раздели сумму на число дней с замерами." },
    ],
  },
  interpret: {
    prompt: { kk: "Көшетті осы аптадан кейін отырғызуға бола ма?", ru: "Можно ли высаживать рассаду после этой недели?" },
    choices: (p) => {
      const mean = sum(p) / 6;
      const mn = Math.min(...temps(p));
      const lowMean = mean < 8;
      const coldDay = !lowMean && mn < 2;
      const yes = !lowMean && !coldDay;
      return [
        {
          text: { kk: "Иә, екі шарт та орындалды", ru: "Да, оба условия выполнены" },
          correct: yes,
          errorType: yes ? undefined : "no_interpretation",
          why: yes ? { kk: "Дұрыс: орташа да, ең суық күн де жеткілікті.", ru: "Верно: и среднее, и самый холодный день в норме." } : { kk: "Екі шартты да кестемен тексер.", ru: "Проверь оба условия по таблице." },
        },
        {
          text: { kk: "Жоқ: орташа температура төмен", ru: "Нет: средняя температура ниже нормы" },
          correct: lowMean,
          errorType: lowMean ? undefined : "no_interpretation",
          why: lowMean ? { kk: "Дұрыс: орташа шарттан төмен.", ru: "Верно: среднее ниже условия." } : { kk: "Өз жауабыңды бірінші шартпен салыстыр.", ru: "Сравни свой ответ с первым условием." },
        },
        {
          text: { kk: "Жоқ: орташа жеткілікті, бірақ бір күн тым суық болды", ru: "Нет: среднее в норме, но был слишком холодный день" },
          correct: coldDay,
          errorType: coldDay ? undefined : "ignored_condition",
          why: coldDay ? { kk: "Дұрыс: орташа жақсы, бірақ бір күн суық — ауытқу маңызды.", ru: "Верно: среднее хорошее, но один день холодный — важен разброс." } : { kk: "Ең суық күнді екінші шартпен салыстыр.", ru: "Сравни самый холодный день со вторым условием." },
        },
      ];
    },
  },
};
