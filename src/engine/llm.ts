export async function queryLLMForProofStep(
    apiKey: string,
    theoremName: string,
    statement: string,
    previousSteps: string[]
): Promise<string> {
    if (!apiKey) {
        throw new Error('API key is missing.');
    }

    const prompt = `You are an expert in formal verification and Lean 4.
I am trying to prove the following theorem:
Theorem Name: ${theoremName}
Statement: ${statement}

Here are the tactics proven so far:
${previousSteps.length ? previousSteps.join('\n') : '(None)'}

Please suggest the next single tactic to advance or complete this proof.
Respond ONLY with the tactic. Do not include markdown formatting or explanations.`;

    // If using a GitHub Personal Access Token (starts with ghp_), use the free GitHub Models endpoint
    // Otherwise, default to OpenAI
    const isGitHubToken = apiKey.startsWith('ghp_') || apiKey.startsWith('github_pat_');
    const endpoint = isGitHubToken
        ? 'https://models.inference.ai.azure.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: isGitHubToken ? 'gpt-4o' : 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch from LLM');
        }

        const data = await response.json();
        const suggestion = data.choices[0]?.message?.content?.trim() || '';

        // Clean up potential markdown code blocks
        return suggestion.replace(/^```(\w+)?/g, '').replace(/```$/g, '').trim();
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('LLM API Error:', error);
        return `Error: ${msg}`;
    }
}
