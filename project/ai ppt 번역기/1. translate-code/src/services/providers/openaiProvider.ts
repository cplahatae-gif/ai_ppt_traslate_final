import { TranslateBatchFn } from '../aiProvider';

interface OpenAIResponse {
    choices?: Array<{
        message?: { content?: string };
    }>;
    error?: { message: string };
}

export const openaiTranslateBatch: TranslateBatchFn = async (
    batch,
    systemPrompt,
    model,
    apiKey
) => {
    if (!apiKey) throw new Error('OpenAI API Key가 없습니다. 번역 설정에서 입력해주세요.');

    const prompt = `Translate these ${batch.length} items to English. Output JSON with key "translations" containing an array of strings:\n${JSON.stringify(batch)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const translations: unknown = parsed.translations ?? parsed.result ?? parsed.items ?? Object.values(parsed)[0];

    if (!Array.isArray(translations) || translations.length !== batch.length) {
        throw new Error(`Expected ${batch.length} items, received ${Array.isArray(translations) ? translations.length : 'non-array'}`);
    }

    return translations as string[];
};
