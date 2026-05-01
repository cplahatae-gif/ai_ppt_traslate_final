import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_BATCH_SIZE = 25;
const MAX_RETRIES = 3;

const extractJson = (text: string): string => {
    const trimmedText = text.trim();
    const match = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1];
    }
    return trimmedText;
};

export const estimateTokens = (texts: string[]): number => {
    const totalChars = texts.join('').length;
    return Math.ceil(totalChars * 1.5) + (texts.length * 5);
};

const translateBatch = async (batch: string[], promptInstruction?: string, glossary?: string, apiKey?: string): Promise<string[]> => {
    const finalApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!finalApiKey) {
        throw new Error("API Key is missing. Please enter your API Key or set VITE_GEMINI_API_KEY in the environment.");
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            let systemInstruction = `You are an expert translator for PowerPoint presentations. 
Translate an array of Korean text fragments into professional English while STRICTLY preserving HTML-like formatting tags (<b>, </b>, <i>, </i>, <br>).

# Critical Rules
1. **One-to-One Mapping**: The input array has ${batch.length} items. The output MUST have exactly ${batch.length} items.
2. **Order Preservation**: Do NOT reorder, merge, or split items.
3. **Tag Preservation - CRITICAL**: 
    - Preserve ALL tags EXACTLY as they appear: <b>, </b>, <i>, </i>, <u>, </u>, <br>, <color:XXXXXX>, </color>
    - The <color:XXXXXX> tag contains a hex color code (e.g., <color:0000FF> for blue). Keep the exact color code.
    - **CRITICAL SCOPING**: Color tags must wrap **ONLY** the corresponding words. Do not extend the tag to the entire sentence if the original was specific.
    - **TAG REORDERING**: If the word order changes during translation, you **MUST** move the tag to wrap the translated word in its *new* position. Do not leave the tag at the original position (e.g. at the start of the sentence) if the word moved.
    - **Example**: '<color:0000FF>사과</color>를 좋아해' -> 'I like <color:0000FF>apples</color>' (Tag moved to end).
    - Close tags immediately after the relevant text (e.g., <color:Red>Word</color> next word).
    - If the original text has NO tags, the translation MUST have NO tags.
    - If the original has <b>only part</b> bolded, keep ONLY that part bolded.
    - **CRITICAL: Do NOT add <br> or newline characters unless they exist in the original text.**
    - Do NOT split single sentences into multiple lines.
    - Do NOT add new tags that don't exist in the original.
    - Do NOT remove existing tags from the original.
    - Do NOT change the order or nesting of tags.
4. **Glossary & Style**: 
    - Use "Electric Shock" instead of "Electrical Shock".
    - Use "Accident Summary" instead of "Accident Overview".
    - Use "Anseong Plant" instead of "Anseong Site" for 안성 사업장/현장.
    - Use "Plant" instead of "Site" for 사업장/현장 in company context.
    - Use "Attendees" instead of "Participants" for 참석자.
    - Use **Title Case** for headers/titles (e.g., "Accident Summary").
    - Use **Sentence case** for body text.
5. **Conciseness**: Prefer concise translations where possible to fit in slides.
6. **Roman Numerals**: Convert full-width roman numerals to half-width (Ⅰ→I, Ⅱ→II, Ⅲ→III, Ⅳ→IV, Ⅴ→V).
`;

            if (promptInstruction?.trim()) {
                systemInstruction += `\n# Additional Context\n${promptInstruction.trim()}\n`;
            }

            if (glossary?.trim()) {
                systemInstruction += `\n# Terminology/Glossary\n${glossary.trim()}\n`;
            }

            const prompt = `Translate these ${batch.length} items to English:\n${JSON.stringify(batch)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
            });

            const jsonString = extractJson(response.text || "[]");
            const translatedArray = JSON.parse(jsonString);

            if (Array.isArray(translatedArray) && translatedArray.length === batch.length) {
                return translatedArray;
            }

            lastError = new Error(`Expected ${batch.length} items, but received ${translatedArray?.length}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }

    throw lastError || new Error("Translation failed.");
};

export const translateTexts = async (
    koreanTexts: string[],
    onProgress?: (completedBatches: number, totalBatches: number) => void,
    promptInstruction?: string,
    glossary?: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
    apiKey?: string
): Promise<string[]> => {
    if (!koreanTexts || koreanTexts.length === 0) return [];

    const batches: string[][] = [];
    for (let i = 0; i < koreanTexts.length; i += batchSize) {
        batches.push(koreanTexts.slice(i, i + batchSize));
    }

    const allTranslatedTexts: string[] = [];
    let completedBatches = 0;

    for (const batch of batches) {
        const translatedBatch = await translateBatch(batch, promptInstruction, glossary, apiKey);
        allTranslatedTexts.push(...translatedBatch);
        completedBatches++;
        if (onProgress) onProgress(completedBatches, batches.length);
    }

    return allTranslatedTexts;
};

/**
 * API 키 형식 유효성 검사
 */
export const validateApiKeyFormat = (apiKey: string): { valid: boolean; message: string } => {
    if (!apiKey || apiKey.trim() === '') {
        return { valid: false, message: 'API 키가 비어있습니다.' };
    }

    // Gemini API 키는 일반적으로 'AIza'로 시작하고 39자
    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 30) {
        return { valid: false, message: 'API 키가 너무 짧습니다.' };
    }

    if (!trimmedKey.startsWith('AIza')) {
        return { valid: false, message: 'Gemini API 키는 "AIza"로 시작해야 합니다.' };
    }

    return { valid: true, message: '형식이 올바릅니다.' };
};

/**
 * API 키 연결 테스트 - 실제 API 호출을 통해 검증
 */
export const testApiKey = async (apiKey: string): Promise<{
    valid: boolean;
    message: string;
    latency?: number;
}> => {
    const formatCheck = validateApiKeyFormat(apiKey);
    if (!formatCheck.valid) {
        return formatCheck;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const startTime = Date.now();

        // 간단한 테스트 요청
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Say "API key is valid" in one word: Valid',
            config: {
                maxOutputTokens: 10,
            },
        });

        const latency = Date.now() - startTime;

        if (response.text) {
            return {
                valid: true,
                message: '✓ API 키가 유효합니다.',
                latency
            };
        }

        return { valid: false, message: '응답이 비어있습니다.' };
    } catch (error: any) {
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('API_KEY_INVALID')) {
            return { valid: false, message: '유효하지 않은 API 키입니다.' };
        }
        if (errorMessage.includes('PERMISSION_DENIED')) {
            return { valid: false, message: 'API 키 권한이 부족합니다.' };
        }
        if (errorMessage.includes('QUOTA_EXCEEDED')) {
            return { valid: false, message: 'API 할당량이 초과되었습니다.' };
        }

        return { valid: false, message: `검증 실패: ${errorMessage}` };
    }
};

/**
 * 현재 사용 가능한 API 키 가져오기 (우선순위: 사용자 입력 > 환경변수)
 */
export const getAvailableApiKey = (userApiKey?: string): string | null => {
    if (userApiKey && userApiKey.trim()) {
        return userApiKey.trim();
    }

    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim()) {
        return envKey.trim();
    }

    return null;
};

/**
 * API 키 상태 확인
 */
export const getApiKeyStatus = (userApiKey?: string): {
    hasKey: boolean;
    source: 'user' | 'env' | 'none';
    keyPreview?: string;
} => {
    if (userApiKey && userApiKey.trim()) {
        const key = userApiKey.trim();
        return {
            hasKey: true,
            source: 'user',
            keyPreview: `${key.substring(0, 6)}...${key.substring(key.length - 4)}`
        };
    }

    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim()) {
        return {
            hasKey: true,
            source: 'env',
            keyPreview: '환경변수 (숨김)'
        };
    }

    return { hasKey: false, source: 'none' };
};
