import { GoogleGenAI, Type } from '@google/genai';
import { TranslateBatchFn } from '../aiProvider';

export const geminiTranslateBatch: TranslateBatchFn = async (
    batch,
    systemPrompt,
    model,
    apiKey
) => {
    if (!apiKey) throw new Error('Gemini API Key가 없습니다. 번역 설정에서 입력해주세요.');

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Translate these ${batch.length} items to English:\n${JSON.stringify(batch)}`;

    // lite 모델은 thinking 미지원, 나머지는 thinkingBudget:0으로 비활성화
    const supportsThinking = !model.includes('lite') && !model.includes('flash-8b');

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
            },
            ...(supportsThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
    });

    const raw = response.text || '[]';
    const cleaned = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
        throw new Error(`Expected ${batch.length} items, received ${parsed?.length}`);
    }
    return parsed;
};
