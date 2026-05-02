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
