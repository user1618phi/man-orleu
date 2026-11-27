// Tiny arithmetic evaluator for model-written expressions: numbers, variables, + - * / ( ), ceil/floor/round/min/max.
type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),]))/y;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(i))) break;
      throw new Error("bad token");
    }
    if (m[1] !== undefined) out.push({ t: "num", v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: "id", v: m[2] });
    else out.push({ t: "op", v: m[3] });
    i = re.lastIndex;
  }
  return out;
}

const FN: Record<string, (...a: number[]) => number> = {
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  min: Math.min,
  max: Math.max,
};

export function evaluate(src: string, vars: Record<string, number>): number {
  if (src.length > 300) throw new Error("too long");
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => {
    const tk = toks[p++];
    if (!tk || (v !== undefined && tk.v !== v)) throw new Error("syntax");
    return tk;
  };
  const expr = (): number => {
    let x = term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) x = eat().v === "+" ? x + term() : x - term();
    return x;
  };
  const term = (): number => {
    let x = unary();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) x = eat().v === "*" ? x * unary() : x / unary();
    return x;
  };
  const unary = (): number => {
    if (peek()?.t === "op" && peek().v === "-") {
      eat();
      return -unary();
    }
    return atom();
  };
  const atom = (): number => {
    const tk = eat();
    if (tk.t === "num") return tk.v;
    if (tk.t === "op" && tk.v === "(") {
      const x = expr();
      eat(")");
      return x;
    }
    if (tk.t === "id") {
      if (FN[tk.v] && peek()?.v === "(") {
        eat("(");
        const args = [expr()];
        while (peek()?.v === ",") {
          eat(",");
          args.push(expr());
        }
        eat(")");
        return FN[tk.v](...args);
      }
      if (tk.v in vars) return vars[tk.v];
    }
    throw new Error("unknown");
  };
  const v = expr();
  if (p !== toks.length) throw new Error("trailing");
  return v;
}
