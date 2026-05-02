import { TranslateBatchFn } from '../aiProvider';

interface ClaudeToolInput {
    translations: string[];
}

interface ClaudeContentBlock {
    type: string;
    name?: string;
    input?: ClaudeToolInput;
    text?: string;
}

interface ClaudeResponse {
    content: ClaudeContentBlock[];
    stop_reason?: string;
    error?: { message: string };
}

export const claudeTranslateBatch: TranslateBatchFn = async (
    batch,
    systemPrompt,
    model,
    apiKey
) => {
    if (!apiKey) throw new Error('Anthropic API Key가 없습니다. 번역 설정에서 입력해주세요.');

    const prompt = `Translate these ${batch.length} items to English:\n${JSON.stringify(batch)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
            tools: [{
                name: 'output_translations',
                description: 'Return the translated strings in the same order as input',
                input_schema: {
                    type: 'object',
                    properties: {
                        translations: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of translated strings, same length and order as input',
                        },
                    },
                    required: ['translations'],
                },
            }],
            tool_choice: { type: 'tool', name: 'output_translations' },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
    }

    const data: ClaudeResponse = await response.json();
    const toolUse = data.content?.find(c => c.type === 'tool_use');

    if (!toolUse?.input?.translations || !Array.isArray(toolUse.input.translations)) {
        throw new Error('Claude가 예상된 형식의 응답을 반환하지 않았습니다.');
    }

    if (toolUse.input.translations.length !== batch.length) {
        throw new Error(`Expected ${batch.length} items, received ${toolUse.input.translations.length}`);
    }

    return toolUse.input.translations;
};
