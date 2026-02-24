// ─────────────────────────────────────────────────────────────
// Theoremis  ·  LLM-Assisted Hypothesis Parser
// Translates natural-language mathematical hypotheses into IR
// terms using a structured LLM prompt + JSON deserializer.
// Falls back to regex parsing when no LLM key is available.
// ─────────────────────────────────────────────────────────────

import { mk, type Term } from '../core/ir';
import type { HypothesisDecl } from './ast';
import type { MathDocument, ThmNode, LemmaNode } from './ast';
import { parseStatement } from './latex';

// ── IR JSON Schema ──────────────────────────────────────────

interface TermJSON {
    tag: string;
    [key: string]: unknown;
}

// ── JSON → IR Term Deserializer ─────────────────────────────

export function deserializeTerm(json: unknown): Term | null {
    if (json === null || typeof json !== 'object') return null;
    const obj = json as TermJSON;

    switch (obj.tag) {
        case 'Var':
            if (typeof obj.name !== 'string') return null;
            return mk.var(obj.name);

        case 'Literal': {
            if (typeof obj.kind !== 'string' || typeof obj.value !== 'string') return null;
            if (obj.kind === 'Nat') return mk.nat(parseInt(obj.value, 10));
            if (obj.kind === 'Int') return mk.int(parseInt(obj.value, 10));
            if (obj.kind === 'Bool') return mk.bool(obj.value === 'true');
            return { tag: 'Literal', kind: obj.kind as 'Nat', value: String(obj.value) };
        }

        case 'App': {
            const func = deserializeTerm(obj.func);
            const arg = deserializeTerm(obj.arg);
            if (!func || !arg) return null;
            return mk.app(func, arg);
        }

        case 'BinOp': {
            if (typeof obj.op !== 'string') return null;
            const left = deserializeTerm(obj.left);
            const right = deserializeTerm(obj.right);
            if (!left || !right) return null;
            return mk.binOp(obj.op as Parameters<typeof mk.binOp>[0], left, right);
        }

        case 'UnaryOp': {
            if (typeof obj.op !== 'string') return null;
            const operand = deserializeTerm(obj.operand);
            if (!operand) return null;
            return mk.unaryOp(obj.op as Parameters<typeof mk.unaryOp>[0], operand);
        }

        case 'ForAll': {
            if (typeof obj.param !== 'string') return null;
            const domain = deserializeTerm(obj.domain);
            const body = deserializeTerm(obj.body);
            if (!domain || !body) return null;
            return mk.forAll(obj.param, domain, body);
        }

        case 'Exists': {
            if (typeof obj.param !== 'string') return null;
            const domain = deserializeTerm(obj.domain);
            const body = deserializeTerm(obj.body);
            if (!domain || !body) return null;
            return mk.exists(obj.param, domain, body);
        }

        case 'Pi': {
            if (typeof obj.param !== 'string') return null;
            const paramType = deserializeTerm(obj.paramType);
            const piBody = deserializeTerm(obj.body);
            if (!paramType || !piBody) return null;
            return mk.pi(obj.param, paramType, piBody);
        }

        case 'Lam': {
            if (typeof obj.param !== 'string') return null;
            const lamPT = deserializeTerm(obj.paramType);
            const lamBody = deserializeTerm(obj.body);
            if (!lamPT || !lamBody) return null;
            return mk.lam(obj.param, lamPT, lamBody);
        }

        case 'Sigma': {
            if (typeof obj.param !== 'string') return null;
            const sigPT = deserializeTerm(obj.paramType);
            const sigBody = deserializeTerm(obj.body);
            if (!sigPT || !sigBody) return null;
            return mk.sigma(obj.param, sigPT, sigBody);
        }

        case 'Equiv': {
            const eqLeft = deserializeTerm(obj.left);
            const eqRight = deserializeTerm(obj.right);
            if (!eqLeft || !eqRight) return null;
            const modulus = obj.modulus ? deserializeTerm(obj.modulus) : null;
            return mk.equiv(eqLeft, eqRight, modulus === null ? undefined : modulus);
        }

        case 'Pair': {
            const fst = deserializeTerm(obj.fst);
            const snd = deserializeTerm(obj.snd);
            if (!fst || !snd) return null;
            return mk.pair(fst, snd);
        }

        case 'Proj': {
            const projTerm = deserializeTerm(obj.term);
            if (!projTerm || (obj.index !== 1 && obj.index !== 2)) return null;
            return mk.proj(projTerm, obj.index as 1 | 2);
        }

        case 'LetIn': {
            if (typeof obj.name !== 'string') return null;
            const letType = deserializeTerm(obj.type);
            const letValue = deserializeTerm(obj.value);
            const letBody = deserializeTerm(obj.body);
            if (!letType || !letValue || !letBody) return null;
            return mk.letIn(obj.name, letType, letValue, letBody);
        }

        case 'Sort': {
            const u = obj.universe as { tag: string; level?: number } | undefined;
            if (!u) return null;
            if (u.tag === 'Prop') return mk.sort({ tag: 'Prop' });
            if (u.tag === 'Type') return mk.sort({ tag: 'Type', level: u.level ?? 0 });
            return null;
        }

        case 'Hole':
            return mk.hole(typeof obj.id === 'string' ? obj.id : '?');

        default:
            return null;
    }
}

// ── Confidence scoring ──────────────────────────────────────
// Determines whether the regex parse is "good enough" or
// whether we should fall back to LLM.

export function regexConfidence(text: string, hypotheses: HypothesisDecl[], conclusionTag: string): number {
    let score = 0;
    const words = text.toLowerCase().split(/\s+/).length;

    // Did we extract any hypotheses?
    if (hypotheses.length > 0) score += 0.3;

    // Is the conclusion meaningful (not just a bare Var)?
    if (conclusionTag !== 'Var') score += 0.2;

    // Coverage: how much of the text did we capture?
    const captured = hypotheses.length + (conclusionTag !== 'Var' ? 1 : 0);
    const density = captured / Math.max(words / 4, 1);
    score += Math.min(density * 0.3, 0.3);

    // Penalty for complex sentences the regex likely mishandles
    if (text.includes('such that') && text.includes('for all')) score -= 0.1;
    if ((text.match(/\$/g) || []).length > 8) score -= 0.1;
    if (text.includes('if and only if')) score -= 0.1;
    if (text.includes('respectively')) score -= 0.2;
    if (/\b(whenever|provided|given that)\b/i.test(text)) score -= 0.05;
    if (/\bfor\s+(all|every|each)\s+.*\bfor\s+(all|every|each)/i.test(text)) score -= 0.15;

    // Bonus for simple, textbook-like patterns
    if (/^[Ll]et\s+\$/.test(text)) score += 0.1;
    if (/^[Ff]or\s+(all|every|each)/.test(text)) score += 0.1;

    return Math.max(0, Math.min(1, score));
}

// ── LLM Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a mathematical formalization assistant for the Theoremis system. You translate natural-language mathematical statements into a strict typed IR (Intermediate Representation) as JSON.

You MUST use System 2 Thinking. Before producing JSON, you MUST write a <thought_process> block where you explicitly reason through every detail. Skipping conditions is a critical failure.

## MANDATORY PROCEDURE

1. Output <thought_process> ... </thought_process> containing:
   a. VARIABLES: List every mathematical variable mentioned (explicitly or implicitly). For each variable, state its name and inferred domain. If a variable is called "prime", its domain is ℕ. If called "integer", its domain is ℤ. If called "real", its domain is ℝ. If no domain is stated, default to ℤ for letters like n,m,k and ℝ for x,y,z.
   b. CONDITIONS: List every condition or constraint, including:
      - Explicit predicates ("p is prime" → Prime(p))
      - Implicit domain constraints ("let k > 0 be an integer" → TWO conditions: k ∈ ℤ AND k > 0)
      - Inequalities ("k ≠ n" → BinOp ¬(k = n) or separate condition)
      - Relationships ("a and b are coprime" → Coprime(a, b))
      - "Respectively" clauses: if "a, b, c are elements of G, H, K respectively", this means a ∈ G AND b ∈ H AND c ∈ K — three SEPARATE hypotheses.
   c. CONCLUSION: Identify the main claim or statement to be proved. This is typically after "then", "prove that", "show that", "we have", or is the final mathematical expression.
   d. CROSS-CHECK: Count the conditions. Re-read the input sentence. Verify you have not dropped any condition. If the count does not match, re-analyze.

2. After </thought_process>, output the JSON object. Nothing else after the JSON.

## IR Term Schema

Every term is a JSON object with a "tag" field:

- \`{"tag":"Var","name":"x"}\` — variable or type name
- \`{"tag":"Literal","kind":"Nat"|"Int"|"Bool","value":"42"}\` — literal
- \`{"tag":"App","func":<term>,"arg":<term>}\` — function application. Curried: Coprime(a,b) = App(App(Var("Coprime"), a), b)
- \`{"tag":"BinOp","op":"<op>","left":<term>,"right":<term>}\` — binary op. Allowed ops: "+", "-", "*", "/", "^", "=", "<", ">", "≤", "≥", "∧", "∨", "→", "↔", "mod", "∈", "∉", "⊆", "∪", "∩"
- \`{"tag":"UnaryOp","op":"¬"|"-","operand":<term>}\` — unary op
- \`{"tag":"ForAll","param":"x","domain":<term>,"body":<term>}\` — universal quantifier
- \`{"tag":"Exists","param":"x","domain":<term>,"body":<term>}\` — existential quantifier
- \`{"tag":"Equiv","left":<term>,"right":<term>,"modulus":<term>|null}\` — equivalence/congruence
- \`{"tag":"Pi","param":"x","paramType":<term>,"body":<term>}\` — dependent function type
- \`{"tag":"Lam","param":"x","paramType":<term>,"body":<term>}\` — lambda abstraction
- \`{"tag":"Pair","fst":<term>,"snd":<term>}\` — pair
- \`{"tag":"Proj","term":<term>,"index":1|2}\` — projection
- \`{"tag":"Sort","universe":{"tag":"Prop"}}\` — sort
- \`{"tag":"Hole","id":"?"}\` — unknown/placeholder

## Standard type names (Var):
"ℕ", "ℤ", "ℝ", "ℂ", "Bool", "String", "Set", "List", "Group", "Ring", "Field"

## Standard predicates (applied via App):
"Prime", "Even", "Odd", "Coprime" (curried), "Continuous", "Differentiable", "Injective", "Surjective", "Bijective", "Finite", "Infinite", "IsCompact", "IsOpen", "IsClosed", "Connected", "IsUnit"

## JSON output shape
\`\`\`
{
  "hypotheses": [{"name":"h_0","condition":<term>,"description":"..."},...],
  "conclusion": <term>
}
\`\`\`
- Each hypothesis has a unique name "h_0", "h_1", etc.
- "description" is a short English phrase for the condition.
- One hypothesis per atomic condition. Do NOT merge multiple conditions into one hypothesis.

---

## EXAMPLES

### Example 1 — Standard textbook notation

**Input:** "Let $p$ be an odd prime and $n \\geq 2$ a natural number. Then $p^n - 1$ is divisible by $p - 1$."

<thought_process>
VARIABLES:
- p: described as "odd prime" → domain ℕ (prime implies natural number)
- n: described as "natural number" with n ≥ 2 → domain ℕ

CONDITIONS:
1. p is prime → App(Var("Prime"), Var("p"))
2. p is odd → App(Var("Odd"), Var("p"))
3. n ∈ ℕ → BinOp("∈", Var("n"), Var("ℕ"))
4. n ≥ 2 → BinOp("≥", Var("n"), Literal(Nat, "2"))

CONCLUSION: p^n - 1 is divisible by p - 1 → (p - 1) | (p^n - 1) → App(App(Var("Divides"), BinOp("-", Var("p"), Literal(Nat,"1"))), BinOp("-", BinOp("^", Var("p"), Var("n")), Literal(Nat,"1")))

CROSS-CHECK: Input has 4 conditions (odd, prime, natural number, ≥ 2). I have 4 hypotheses. ✓
</thought_process>
{
  "hypotheses": [
    {"name":"h_0","condition":{"tag":"App","func":{"tag":"Var","name":"Prime"},"arg":{"tag":"Var","name":"p"}},"description":"p is prime"},
    {"name":"h_1","condition":{"tag":"App","func":{"tag":"Var","name":"Odd"},"arg":{"tag":"Var","name":"p"}},"description":"p is odd"},
    {"name":"h_2","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"n"},"right":{"tag":"Var","name":"ℕ"}},"description":"n is a natural number"},
    {"name":"h_3","condition":{"tag":"BinOp","op":"≥","left":{"tag":"Var","name":"n"},"right":{"tag":"Literal","kind":"Nat","value":"2"}},"description":"n is at least 2"}
  ],
  "conclusion":{"tag":"App","func":{"tag":"App","func":{"tag":"Var","name":"Divides"},"arg":{"tag":"BinOp","op":"-","left":{"tag":"Var","name":"p"},"right":{"tag":"Literal","kind":"Nat","value":"1"}}},"arg":{"tag":"BinOp","op":"-","left":{"tag":"BinOp","op":"^","left":{"tag":"Var","name":"p"},"right":{"tag":"Var","name":"n"}},"right":{"tag":"Literal","kind":"Nat","value":"1"}}}
}

### Example 2 — Conversational word problem with hidden domains

**Input:** "Suppose we pick some prime $p$ and an integer $k$ bigger than zero where $k$ isn't equal to $p$. Show that $p$ does not divide $k!$."

<thought_process>
VARIABLES:
- p: "some prime" → domain ℕ
- k: "an integer bigger than zero where k isn't equal to p" → domain ℤ, with TWO extra constraints: k > 0 AND k ≠ p

CONDITIONS:
1. p is prime → App(Var("Prime"), Var("p"))
2. k ∈ ℤ → BinOp("∈", Var("k"), Var("ℤ"))
3. k > 0 → BinOp(">", Var("k"), Literal(Nat, "0"))
4. k ≠ p → UnaryOp("¬", BinOp("=", Var("k"), Var("p")))

CONCLUSION: p does not divide k! → ¬(Divides(p, k!)) → UnaryOp("¬", App(App(Var("Divides"), Var("p")), App(Var("Factorial"), Var("k"))))

CROSS-CHECK: "prime" = 1 condition, "integer" = 1 domain, "bigger than zero" = 1 condition, "isn't equal to p" = 1 condition. Total = 4. I have 4 hypotheses. ✓
</thought_process>
{
  "hypotheses": [
    {"name":"h_0","condition":{"tag":"App","func":{"tag":"Var","name":"Prime"},"arg":{"tag":"Var","name":"p"}},"description":"p is prime"},
    {"name":"h_1","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"k"},"right":{"tag":"Var","name":"ℤ"}},"description":"k is an integer"},
    {"name":"h_2","condition":{"tag":"BinOp","op":">","left":{"tag":"Var","name":"k"},"right":{"tag":"Literal","kind":"Nat","value":"0"}},"description":"k is positive"},
    {"name":"h_3","condition":{"tag":"UnaryOp","op":"¬","operand":{"tag":"BinOp","op":"=","left":{"tag":"Var","name":"k"},"right":{"tag":"Var","name":"p"}}},"description":"k is not equal to p"}
  ],
  "conclusion":{"tag":"UnaryOp","op":"¬","operand":{"tag":"App","func":{"tag":"App","func":{"tag":"Var","name":"Divides"},"arg":{"tag":"Var","name":"p"}},"arg":{"tag":"App","func":{"tag":"Var","name":"Factorial"},"arg":{"tag":"Var","name":"k"}}}}
}

### Example 3 — "Respectively" clause

**Input:** "Let $a$, $b$, $c$ be elements of groups $G$, $H$, $K$ respectively, with $a$ of finite order. Then the order of $(a, b, c)$ in $G \\times H \\times K$ divides the order of $a$."

<thought_process>
VARIABLES:
- a: element of G (group) → domain G
- b: element of H (group) → domain H
- c: element of K (group) → domain K
- G, H, K: groups

"Respectively" means: a ∈ G, b ∈ H, c ∈ K — three separate conditions, NOT a ∈ G ∧ b ∈ G ∧ c ∈ G.

CONDITIONS:
1. G is a group → BinOp("∈", Var("G"), Var("Group"))
2. H is a group → BinOp("∈", Var("H"), Var("Group"))
3. K is a group → BinOp("∈", Var("K"), Var("Group"))
4. a ∈ G → BinOp("∈", Var("a"), Var("G"))
5. b ∈ H → BinOp("∈", Var("b"), Var("H"))
6. c ∈ K → BinOp("∈", Var("c"), Var("K"))
7. a has finite order → App(Var("Finite"), App(Var("Order"), Var("a")))

CONCLUSION: order of (a,b,c) in G×H×K divides order of a → Divides(Order(a), Order((a,b,c)))

CROSS-CHECK: 3 group declarations, 3 membership (respectively), 1 finite order = 7 conditions. I have 7 hypotheses. ✓
</thought_process>
{
  "hypotheses": [
    {"name":"h_0","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"G"},"right":{"tag":"Var","name":"Group"}},"description":"G is a group"},
    {"name":"h_1","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"H"},"right":{"tag":"Var","name":"Group"}},"description":"H is a group"},
    {"name":"h_2","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"K"},"right":{"tag":"Var","name":"Group"}},"description":"K is a group"},
    {"name":"h_3","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"a"},"right":{"tag":"Var","name":"G"}},"description":"a is in G"},
    {"name":"h_4","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"b"},"right":{"tag":"Var","name":"H"}},"description":"b is in H"},
    {"name":"h_5","condition":{"tag":"BinOp","op":"∈","left":{"tag":"Var","name":"c"},"right":{"tag":"Var","name":"K"}},"description":"c is in K"},
    {"name":"h_6","condition":{"tag":"App","func":{"tag":"Var","name":"Finite"},"arg":{"tag":"App","func":{"tag":"Var","name":"Order"},"arg":{"tag":"Var","name":"a"}}},"description":"a has finite order"}
  ],
  "conclusion":{"tag":"App","func":{"tag":"App","func":{"tag":"Var","name":"Divides"},"arg":{"tag":"App","func":{"tag":"Var","name":"Order"},"arg":{"tag":"Var","name":"a"}}},"arg":{"tag":"App","func":{"tag":"Var","name":"Order"},"arg":{"tag":"Pair","fst":{"tag":"Var","name":"a"},"snd":{"tag":"Pair","fst":{"tag":"Var","name":"b"},"snd":{"tag":"Var","name":"c"}}}}}
}

---

## FINAL RULES
- ALWAYS output <thought_process>...</thought_process> FIRST, then the JSON object. Nothing else.
- One hypothesis per atomic condition. Never merge conditions.
- "Respectively" ALWAYS means a 1-to-1 pairing. Expand it fully.
- If a variable is called "prime", it implicitly lives in ℕ. Add BOTH the domain AND the Prime predicate.
- The CROSS-CHECK step is mandatory. If your count is wrong, redo the analysis inside the thought block.
- Do NOT wrap the JSON in markdown code fences.`;

function buildUserPrompt(text: string): string {
    return `Translate this mathematical statement into the IR JSON format. Remember: output <thought_process>...</thought_process> first with your full variable/condition/conclusion analysis and cross-check, then output ONLY the JSON object.

"${text}"`;
}

// ── CoT Response Extraction ─────────────────────────────────
// Strips <thought_process>...</thought_process> and markdown
// code fences, then returns the raw JSON string.

export function extractJsonFromCoTResponse(content: string): string | null {
    let text = content;

    // 1. Strip <thought_process>...</thought_process> block(s)
    //    Use a greedy match to handle nested content. The thought
    //    block may contain anything including line breaks.
    text = text.replace(/<thought_process>[\s\S]*?<\/thought_process>/g, '');

    // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '');

    // 3. Trim whitespace
    text = text.trim();

    // 4. If nothing remains, bail
    if (!text) return null;

    // 5. Find the first '{' and last '}' to extract the JSON object
    //    This handles any stray text the LLM might emit before/after.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    return text.slice(firstBrace, lastBrace + 1);
}

// ── LLM-based parser ────────────────────────────────────────

export interface LLMParseResult {
    hypotheses: HypothesisDecl[];
    conclusion: Term;
    source: 'llm';
    raw?: string;
}

export async function parseStatementLLM(
    text: string,
    apiKey: string,
    endpoint?: string,
): Promise<LLMParseResult | null> {
    const isGitHubToken = apiKey.startsWith('github_pat_') || apiKey.startsWith('ghp_');
    const url = endpoint ?? (
        isGitHubToken
            ? 'https://models.inference.ai.azure.com/chat/completions'
            : 'https://api.openai.com/v1/chat/completions'
    );

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: isGitHubToken ? 'gpt-4o' : 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: buildUserPrompt(text) },
                ],
                temperature: 0,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        // ── Extract JSON from LLM response ──────────────────
        // The CoT prompt instructs the LLM to emit:
        //   <thought_process>...</thought_process>
        //   { "hypotheses": [...], "conclusion": ... }
        //
        // We strip the thought block, then strip any markdown
        // code fences, then parse the remaining JSON.
        // Also handles plain JSON responses (no thought block)
        // for backward compatibility with simpler models.

        const jsonStr = extractJsonFromCoTResponse(content);
        if (!jsonStr) return null;

        const parsed = JSON.parse(jsonStr) as {
            hypotheses?: Array<{ name: string; condition: unknown; description: string }>;
            conclusion?: unknown;
        };

        // Deserialize hypotheses
        const hypotheses: HypothesisDecl[] = [];
        if (Array.isArray(parsed.hypotheses)) {
            for (const h of parsed.hypotheses) {
                if (typeof h.name === 'string') {
                    const condition = deserializeTerm(h.condition);
                    if (condition) {
                        hypotheses.push({
                            name: h.name,
                            condition,
                            description: typeof h.description === 'string' ? h.description : '',
                        });
                    }
                }
            }
        }

        // Deserialize conclusion
        const conclusion = parsed.conclusion ? deserializeTerm(parsed.conclusion) : null;
        if (!conclusion) return null;

        return { hypotheses, conclusion, source: 'llm', raw: content };
    } catch {
        return null;
    }
}

// ── Hybrid parser: regex-first, LLM-fallback ────────────────

const CONFIDENCE_THRESHOLD = 0.5;

export async function parseStatementHybrid(
    rawLatex: string,
    regexResult: { hypotheses: HypothesisDecl[]; conclusion: Term },
    apiKey: string | null,
): Promise<{ hypotheses: HypothesisDecl[]; conclusion: Term; source: 'regex' | 'llm' }> {
    const confidence = regexConfidence(rawLatex, regexResult.hypotheses, regexResult.conclusion.tag);

    // If regex is confident enough, or no API key, use regex result
    if (confidence >= CONFIDENCE_THRESHOLD || !apiKey) {
        return { ...regexResult, source: 'regex' };
    }

    // Try LLM
    const llmResult = await parseStatementLLM(rawLatex, apiKey);

    // If LLM succeeded and produced something meaningful, use it
    if (llmResult && (llmResult.hypotheses.length > 0 || llmResult.conclusion.tag !== 'Var')) {
        return llmResult;
    }

    // Fall back to regex
    return { ...regexResult, source: 'regex' };
}

// ── Document-level refinement ───────────────────────────────
// Walks a MathDocument, identifies theorems/lemmas whose regex
// parse has low confidence, and refines them with the LLM.

export interface RefineResult {
    doc: MathDocument;
    refined: number;
    total: number;
}

export async function refineDocWithLLM(
    doc: MathDocument,
    apiKey: string | null,
): Promise<RefineResult> {
    if (!apiKey) return { doc, refined: 0, total: 0 };

    let refined = 0;
    let total = 0;

    const processNodes = async (nodes: MathDocument['nodes']): Promise<void> => {
        for (const node of nodes) {
            if (node.tag === 'SectionNode') {
                await processNodes(node.children);
                continue;
            }

            if (node.tag !== 'ThmNode' && node.tag !== 'LemmaNode') continue;
            total++;

            const thmOrLem = node as ThmNode | LemmaNode;
            const rawLatex = thmOrLem.rawLatex;
            if (!rawLatex) continue;

            // Re-parse with regex to get confidence score
            const regexResult = parseStatement(rawLatex);
            const confidence = regexConfidence(rawLatex, regexResult.hypotheses, regexResult.conclusion.tag);

            if (confidence >= CONFIDENCE_THRESHOLD) continue;

            // Attempt LLM refinement
            const llmResult = await parseStatementLLM(rawLatex, apiKey);
            if (llmResult && (llmResult.hypotheses.length > 0 || llmResult.conclusion.tag !== 'Var')) {
                thmOrLem.hypotheses = llmResult.hypotheses;
                thmOrLem.conclusion = llmResult.conclusion;
                refined++;
            }
        }
    };

    await processNodes(doc.nodes);
    return { doc, refined, total };
}