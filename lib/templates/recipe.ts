import { distinct, pick } from "../rng";
import { same } from "../format";
import type { TaskTemplate } from "../types";

export const recipe: TaskTemplate = {
  id: "recipe",
  title: { kk: "Қонаққа бауырсақ", ru: "Баурсаки для гостей" },
  context: "recipe",
  params(rng, level) {
    for (;;) {
      const N = pick(rng, [4, 6, 8]);
      const k = level === 1 ? pick(rng, [2, 3]) : level === 2 ? pick(rng, [1.5, 2, 2.5, 3]) : pick(rng, [1.25, 1.5, 1.75, 2.5]);
      const G = N * k;
      if (!Number.isInteger(G)) continue;
      const F = pick(rng, [400, 500, 600, 800]);
      const bag = pick(rng, [1, 2]);
      const need = (F * G) / N;
      if (!Number.isInteger(need)) continue;
      if (Math.abs(need - bag * 1000) < 1) continue;
      if (!distinct([need, G / N, (F * N) / G, F + (G - N), need / 1000], 0.02)) continue;
      return { N, G, F, bag, milk: (F / 2) | 0 };
    }
  },
  situation: {
    kk: "Демалыста Нұрлан үйге қонақ шақырды, апасы бауырсақ пісірмек. Апасының рецепті азырақ адамға арналған. Нұрлан ұн жетер-жетпесін тексергісі келеді.",
    ru: "На выходных Нурлан позвал гостей, бабушка будет жарить баурсаки. Бабушкин рецепт рассчитан на меньшее число людей. Нурлан хочет проверить, хватит ли муки.",
  },
  stimulus: (p) => [
    {
      kind: "receipt",
      title: { kk: "Апамның рецепті", ru: "Рецепт бабушки" },
      lines: [
        { label: { kk: "кімге", ru: "на сколько человек" }, value: { id: "n", text: () => ({ kk: `${p.N} адам`, ru: `${p.N} чел.` }), needed: true } },
        { label: { kk: "ұн", ru: "мука" }, value: { id: "f", text: () => same(`${p.F} г`), needed: true } },
        { label: { kk: "сүт", ru: "молоко" }, value: { id: "milk", text: () => same(`${p.milk} мл`), needed: false } },
        { label: { kk: "ашытқы", ru: "дрожжи" }, value: { id: "yeast", text: () => same("10 г"), needed: false } },
        { label: { kk: "қуыру уақыты", ru: "время жарки" }, value: { id: "fry", text: () => same("15 мин"), needed: false, trap: true } },
      ],
    },
    {
      kind: "card",
      title: { kk: "Үйде", ru: "Дома" },
      facts: [
        { label: { kk: "қонақ пен отбасы", ru: "гостей вместе с семьёй" }, value: { id: "g", text: () => ({ kk: `${p.G} адам`, ru: `${p.G} чел.` }), needed: true } },
        { label: { kk: "ұн қапшығы", ru: "пакет муки" }, value: { id: "bag", text: () => same(`${p.bag} кг`), needed: false } },
      ],
    },
  ],
  formulate: {
    prompt: { kk: "Есепте не табу керек?", ru: "Что нужно найти в задаче?" },
    choices: [
      {
        text: { kk: "Барлық адамға қанша ұн керек және үйдегі ұн жете ме", ru: "Сколько муки нужно на всех и хватит ли той, что дома" },
        correct: true,
        why: { kk: "Дұрыс: рецептті адам санына қарай өзгертіп, қормен салыстыру.", ru: "Верно: пересчитать рецепт на всех и сравнить с запасом." },
      },
      {
        text: { kk: "Бауырсақты қанша уақыт қуыру керек", ru: "Сколько минут жарить баурсаки" },
        correct: false,
        errorType: "wrong_data",
        why: { kk: "Қуыру уақыты адам санына байланысты емес.", ru: "Время жарки не зависит от числа гостей." },
      },
      {
        text: { kk: "Қонақ рецепттегіден неше есе көп", ru: "Во сколько раз гостей больше, чем в рецепте" },
        correct: false,
        errorType: "partial_solution",
        why: { kk: "Бұл тек аралық қадам — сұрақ ұн туралы.", ru: "Это только промежуточный шаг — вопрос про муку." },
      },
    ],
    dataHint: { kk: "Рецепт кімге арналған, онда қанша ұн және үйде неше адам болады.", ru: "На сколько человек рецепт, сколько в нём муки и сколько будет людей." },
  },
  employ: {
    prompt: { kk: "Барлық адамға неше грамм ұн керек?", ru: "Сколько граммов муки нужно на всех?" },
    unit: same("г"),
    answer: (p) => (p.F * p.G) / p.N,
    bugs: [
      { value: (p) => p.G / p.N, errorType: "partial_solution", why: { kk: "Бұл — неше есе көп екені. Енді ұнды есепте.", ru: "Это во сколько раз больше. Теперь посчитай муку." } },
      { value: (p) => (p.F * p.N) / p.G, errorType: "wrong_operation", why: { kk: "Сен бөлдің, ал адам көбейсе, ұн да көбеюі керек.", ru: "Ты разделил, а если людей больше, муки тоже должно быть больше." } },
      { value: (p) => p.F + (p.G - p.N), errorType: "wrong_operation", why: { kk: "Айырманы қостың. Пропорция көбейту арқылы есептеледі.", ru: "Ты прибавил разницу. Пропорция считается умножением." } },
      { value: (p) => (p.F * p.G) / p.N / 1000, errorType: "unit_error", why: { kk: "Бұл — килограмм. Сұрақ граммен.", ru: "Это в килограммах. Спрашивают в граммах." } },
    ],
    hints: [
      { kk: "Адам рецепттегіден неше есе көп екенін тап.", ru: "Найди, во сколько раз людей больше, чем в рецепте." },
      { kk: "Рецепттегі ұнды сол санға көбейт.", ru: "Умножь муку из рецепта на это число." },
    ],
  },
  interpret: {
    prompt: { kk: "Үйдегі бір қап ұн жете ме?", ru: "Хватит ли одного пакета муки, который есть дома?" },
    choices: (p) => {
      const enough = (p.F * p.G) / p.N <= p.bag * 1000;
      const wrong = { kk: "Қапшықты граммға айналдырып, жауабыңмен салыстыр.", ru: "Переведи пакет в граммы и сравни со своим ответом." };
      return [
        { text: { kk: "Иә, жетеді", ru: "Да, хватит" }, correct: enough, errorType: enough ? undefined : "unit_error", why: enough ? { kk: "Дұрыс: керегі қаптағыдан аз.", ru: "Верно: нужно меньше, чем в пакете." } : wrong },
        { text: { kk: "Жоқ, тағы ұн сатып алу керек", ru: "Нет, нужно докупить муку" }, correct: !enough, errorType: enough ? "unit_error" : undefined, why: !enough ? { kk: "Дұрыс: керегі қаптағыдан көп.", ru: "Верно: нужно больше, чем в пакете." } : wrong },
        { text: { kk: "Рецепт бойынша пісіру керек, қонақ санына қарамай", ru: "Готовить по рецепту как есть, без пересчёта" }, correct: false, errorType: "no_interpretation", why: { kk: "Онда бәріне бауырсақ жетпейді.", ru: "Тогда баурсаков на всех не хватит." } },
      ];
    },
  },
};

