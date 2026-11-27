import { distinct, pick } from "../rng";
import { num, same, time } from "../format";
import type { Params, TaskTemplate } from "../types";

const km = (p: Params) => (p.d * p.S) / 100000;
const minutes = (p: Params) => (km(p) / p.v) * 60;

export const map: TaskTemplate = {
  id: "map",
  title: { kk: "Көлге жорық", ru: "Поход к озеру" },
  context: "map",
  params(rng, level) {
    for (;;) {
      const S = level === 1 ? 50000 : pick(rng, [25000, 50000, 100000]);
      const d = level === 3 ? pick(rng, [5, 6, 7, 9, 11, 13]) : pick(rng, [4, 6, 8, 10, 12]);
      const v = pick(rng, [4, 5]);
      const m = minutes({ S, d, v });
      if (!Number.isInteger(m) || m < 20 || m > 180) continue;
      const start = pick(rng, [14 * 60, 15 * 60, 15 * 60 + 30, 16 * 60]);
      const rest = pick(rng, [30, 40, 60]);
      const slack = pick(rng, [-25, -15, 15, 25]);
      const sunset = start + 2 * m + rest + slack;
      const p = { S, d, v, start, rest, sunset };
      if (!distinct([m, km(p), km(p) * 1000, km(p) / v, (v / km(p)) * 60, m * 10], 1.1)) continue;
      return p;
    }
  },
  situation: {
    kk: "Сынып демалыс күні көлге жаяу барып, қараңғы түскенше қайтпақ. Мұғалім жолды картадан өлшеді. Жаяу жүру жылдамдығы жорық жоспарында жазылған.",
    ru: "Класс в выходной идёт пешком к озеру и хочет вернуться до темноты. Учитель измерил путь по карте. Скорость пешком записана в плане похода.",
  },
  stimulus: (p) => [
    {
      kind: "card",
      title: { kk: "Карта", ru: "Карта" },
      facts: [
        { label: { kk: "масштаб", ru: "масштаб" }, value: { id: "scale", text: () => same(`1 : ${num(p.S)}`), needed: true } },
        { label: { kk: "картадағы жол", ru: "путь на карте" }, value: { id: "d", text: () => same(`${p.d} см`), needed: true } },
        { label: { kk: "көлдің тереңдігі", ru: "глубина озера" }, value: { id: "depth", text: () => same("4 м"), needed: false, trap: true } },
      ],
    },
    {
      kind: "receipt",
      title: { kk: "Жорық жоспары", ru: "План похода" },
      lines: [
        { label: { kk: "жылдамдық", ru: "скорость" }, value: { id: "v", text: () => ({ kk: `${p.v} км/сағ`, ru: `${p.v} км/ч` }), needed: true } },
        { label: { kk: "шығу", ru: "выход" }, value: { id: "start", text: () => same(time(p.start)), needed: false } },
        { label: { kk: "көл басында", ru: "у озера" }, value: { id: "rest", text: () => same(`${p.rest} мин`), needed: false } },
        { label: { kk: "күн батуы", ru: "закат" }, value: { id: "sunset", text: () => same(time(p.sunset)), needed: false } },
      ],
      footnote: { id: "cm", text: () => ({ kk: "1 км = 100 000 см", ru: "1 км = 100 000 см" }), needed: false },
    },
  ],
  formulate: {
    prompt: { kk: "Есепте не табу керек?", ru: "Что нужно найти в задаче?" },
    choices: [
      {
        text: { kk: "Көлге дейін жүру уақытын, сосын күн батқанша қайтуға үлгеретінін", ru: "Сколько идти до озера, а потом — успеют ли вернуться до заката" },
        correct: true,
        why: { kk: "Дұрыс: алдымен жол уақыты, сосын бүкіл жорықтың уақыты.", ru: "Верно: сначала время в пути, потом время всего похода." },
      },
      {
        text: { kk: "Картадағы жолдың ұзындығын", ru: "Длину пути на карте" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Ол картада өлшенген. Ақиқат қашықтық басқа.", ru: "Она уже измерена. Настоящее расстояние другое." },
      },
      {
        text: { kk: "Көлдің тереңдігін", ru: "Глубину озера" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Тереңдік жорық уақытына әсер етпейді.", ru: "Глубина не влияет на время похода." },
      },
    ],
    dataHint: { kk: "Масштаб, картадағы жол және жылдамдық.", ru: "Масштаб, путь на карте и скорость." },
  },
  employ: {
    prompt: { kk: "Көлге дейін бір жаққа неше минут жүреді?", ru: "Сколько минут идти до озера в одну сторону?" },
    unit: same("мин"),
    answer: (p) => minutes(p),
    tolerance: 0.5,
    bugs: [
      { value: (p) => km(p), errorType: "partial_solution", why: { kk: "Бұл — километр. Енді уақытты есепте.", ru: "Это километры. Теперь посчитай время." } },
      { value: (p) => km(p) / p.v, errorType: "unit_error", why: { kk: "Бұл — сағат. Сұрақ минутпен.", ru: "Это часы. Спрашивают в минутах." } },
      { value: (p) => km(p) * 1000, errorType: "partial_solution", why: { kk: "Бұл — метр. Енді уақытты есепте.", ru: "Это метры. Теперь посчитай время." } },
      { value: (p) => (p.v / km(p)) * 60, errorType: "wrong_operation", why: { kk: "Жылдамдықты жолға бөлдің — керісінше керек.", ru: "Ты разделил скорость на путь — нужно наоборот." } },
      { value: (p) => minutes(p) * 10, errorType: "unit_error", why: { kk: "Масштабты тексер: 1 км-де неше сантиметр бар?", ru: "Проверь масштаб: сколько сантиметров в 1 км?" } },
    ],
    hints: [
      { kk: "Масштаб бойынша картадағы сантиметрді шын километрге айналдыр.", ru: "По масштабу переведи сантиметры на карте в настоящие километры." },
      { kk: "Уақыт = жол : жылдамдық. Сағатты минутқа айналдыруды ұмытпа.", ru: "Время = путь : скорость. Не забудь перевести часы в минуты." },
    ],
  },
  interpret: {
    prompt: { kk: "Сынып күн батқанша қайтып үлгере ме?", ru: "Успеет ли класс вернуться до заката?" },
    choices: (p) => {
      const ok = p.start + 2 * minutes(p) + p.rest <= p.sunset;
      const wrong = { kk: "Барып-қайту уақытын және көл басындағы уақытты шығу уақытына қос.", ru: "Прибавь ко времени выхода дорогу туда и обратно и время у озера." };
      return [
        { text: { kk: "Иә, үлгереді", ru: "Да, успеет" }, correct: ok, errorType: ok ? undefined : "no_interpretation", why: ok ? { kk: "Дұрыс: қайту уақыты күн батуынан ерте.", ru: "Верно: возвращение раньше заката." } : wrong },
        { text: { kk: "Жоқ, ертерек шығу керек", ru: "Нет, нужно выйти раньше" }, correct: !ok, errorType: ok ? "no_interpretation" : undefined, why: !ok ? { kk: "Дұрыс: күн батқаннан кейін қайтады.", ru: "Верно: вернутся уже после заката." } : wrong },
        { text: { kk: "Иә, өйткені көлге дейін бір сағаттан аз", ru: "Да, ведь до озера меньше часа" }, correct: false, errorType: "ignored_condition", why: { kk: "Қайту жолы мен көл басындағы уақытты да ескеру керек.", ru: "Нужно учесть и обратную дорогу, и время у озера." } },
      ];
    },
  },
};
