export type LLMProvider = 'openai' | 'anthropic' | 'github';

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey: string;
}

export interface LLMUsage {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    // $/1M tokens
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-3-5': { input: 0.8, output: 4 },
};

let cumulativeUsage: LLMUsage = { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 };

export function getCumulativeUsage(): LLMUsage { return { ...cumulativeUsage }; }
export function resetUsage(): void { cumulativeUsage = { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 }; }

export function detectProvider(apiKey: string): LLMProvider {
    if (apiKey.startsWith('ghp_') || apiKey.startsWith('github_pat_')) return 'github';
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    return 'openai';
}

export function defaultModelForProvider(provider: LLMProvider): string {
    switch (provider) {
        case 'github': return 'gpt-4o';
        case 'anthropic': return 'claude-sonnet-4-20250514';
        case 'openai': return 'gpt-4o-mini';
    }
}

export async function queryLLMForProofStep(
    apiKey: string,
    theoremName: string,
    statement: string,
    previousSteps: string[],
    config?: Partial<LLMConfig>,
): Promise<string> {
    if (!apiKey) {
        throw new Error('API key is missing.');
    }

    const provider = config?.provider ?? detectProvider(apiKey);
    const model = config?.model ?? defaultModelForProvider(provider);

    const prompt = `You are an expert in formal verification and Lean 4.
I am trying to prove the following theorem:
Theorem Name: ${theoremName}
Statement: ${statement}

Here are the tactics proven so far:
${previousSteps.length ? previousSteps.join('\n') : '(None)'}

Please suggest the next single tactic to advance or complete this proof.
Respond ONLY with the tactic. Do not include markdown formatting or explanations.`;

    try {
        let suggestion: string;
        let usage: { prompt: number; completion: number } | null = null;

        if (provider === 'anthropic') {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 150,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'Anthropic API error');
            }
            const data = await resp.json();
            suggestion = data.content?.[0]?.text?.trim() || '';
            if (data.usage) {
                usage = { prompt: data.usage.input_tokens || 0, completion: data.usage.output_tokens || 0 };
            }
        } else {
            const endpoint = provider === 'github'
                ? 'https://models.inference.ai.azure.com/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.2,
                    max_tokens: 150,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'LLM API error');
            }
            const data = await resp.json();
            suggestion = data.choices[0]?.message?.content?.trim() || '';
            if (data.usage) {
                usage = { prompt: data.usage.prompt_tokens || 0, completion: data.usage.completion_tokens || 0 };
            }
        }

        // Track usage
        if (usage) {
            const costs = MODEL_COSTS[model] || { input: 1, output: 3 };
            const cost = (usage.prompt * costs.input + usage.completion * costs.output) / 1_000_000;
            cumulativeUsage.promptTokens += usage.prompt;
            cumulativeUsage.completionTokens += usage.completion;
            cumulativeUsage.estimatedCostUsd += cost;
        }

        // Clean up potential markdown code blocks
        return suggestion.replace(/^```(\w+)?/g, '').replace(/```$/g, '').trim();
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('LLM API Error:', error);
        return `Error: ${msg}`;
    }
}

// ── Goal-Aware Tactic Engine (Phase 2) ──────────────────────

export interface ProofGoalState {
    goal: string;                  // Current proof goal, e.g. "n + 0 = n"
    hypotheses: string[];          // Available hypotheses, e.g. ["n : ℕ", "h : n > 0"]
    theoremName: string;           // Name of the theorem being proved
    statement: string;             // Full theorem statement
    previousTactics: string[];     // Tactics already applied
    mathlibHints?: string[];       // Relevant Mathlib lemma names
}

export interface TacticSuggestion {
    tactic: string;      // e.g. "simp [Nat.add_zero]"
    confidence: number;  // 0.0 - 1.0
    explanation: string; // Why this tactic might work
}

export async function queryGoalAwareTactics(
    apiKey: string,
    goalState: ProofGoalState,
    config?: Partial<LLMConfig>,
): Promise<TacticSuggestion[]> {
    if (!apiKey) throw new Error('API key is missing.');

    const provider = config?.provider ?? detectProvider(apiKey);
    const model = config?.model ?? defaultModelForProvider(provider);

    const hypothesesBlock = goalState.hypotheses.length
        ? goalState.hypotheses.map(h => `  ${h}`).join('\n')
        : '  (none)';

    const mathlibBlock = goalState.mathlibHints?.length
        ? `\nRelevant Mathlib lemmas that might help:\n${goalState.mathlibHints.map(h => `  - ${h}`).join('\n')}`
        : '';

    const previousBlock = goalState.previousTactics.length
        ? goalState.previousTactics.join('\n  ')
        : '(none yet)';

    const prompt = `You are an expert Lean 4 proof engineer. Given the current proof state, suggest exactly 3 tactics ranked by likelihood of success.

## Theorem
Name: ${goalState.theoremName}
Statement: ${goalState.statement}

## Current Proof State
Goal: ⊢ ${goalState.goal}
Hypotheses:
${hypothesesBlock}

## Previous Tactics Applied
  ${previousBlock}
${mathlibBlock}

## Instructions
Respond with exactly 3 JSON objects, one per line, each with fields: tactic, confidence (0-1), explanation.
Format: {"tactic": "...", "confidence": 0.9, "explanation": "..."}
No markdown, no extra text. Just 3 lines of JSON.`;

    try {
        let raw: string;
        let usage: { prompt: number; completion: number } | null = null;

        if (provider === 'anthropic') {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 400,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'Anthropic API error');
            }
            const data = await resp.json();
            raw = data.content?.[0]?.text?.trim() || '';
            if (data.usage) {
                usage = { prompt: data.usage.input_tokens || 0, completion: data.usage.output_tokens || 0 };
            }
        } else {
            const endpoint = provider === 'github'
                ? 'https://models.inference.ai.azure.com/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'LLM API error');
            }
            const data = await resp.json();
            raw = data.choices[0]?.message?.content?.trim() || '';
            if (data.usage) {
                usage = { prompt: data.usage.prompt_tokens || 0, completion: data.usage.completion_tokens || 0 };
            }
        }

        // Track usage
        if (usage) {
            const costs = MODEL_COSTS[model] || { input: 1, output: 3 };
            const cost = (usage.prompt * costs.input + usage.completion * costs.output) / 1_000_000;
            cumulativeUsage.promptTokens += usage.prompt;
            cumulativeUsage.completionTokens += usage.completion;
            cumulativeUsage.estimatedCostUsd += cost;
        }

        // Parse multiple JSON lines
        const suggestions: TacticSuggestion[] = [];
        const lines = raw.split('\n').filter(l => l.trim().startsWith('{'));
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line.trim());
                if (parsed.tactic) {
                    suggestions.push({
                        tactic: String(parsed.tactic).replace(/^```\w*\n?/, '').replace(/```$/, '').trim(),
                        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
                        explanation: String(parsed.explanation || ''),
                    });
                }
            } catch { /* skip malformed lines */ }
        }

        return suggestions.length > 0 ? suggestions : [{
            tactic: raw.replace(/^```\w*/g, '').replace(/```$/g, '').trim(),
            confidence: 0.5,
            explanation: 'Single suggestion (could not parse structured response)',
        }];
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('LLM API Error:', error);
        return [{ tactic: `Error: ${msg}`, confidence: 0, explanation: '' }];
    }
}
