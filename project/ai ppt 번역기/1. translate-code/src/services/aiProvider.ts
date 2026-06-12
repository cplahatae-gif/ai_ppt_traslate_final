import { ProviderId } from './modelCatalog';

export type TranslateBatchFn = (
    batch: string[],
    systemPrompt: string,
    model: string,
    apiKey: string
) => Promise<string[]>;

export const buildSystemPrompt = (
    batchLength: number,
    promptInstruction?: string,
    glossary?: string
): string => {
    let prompt = `You are an expert translator for PowerPoint presentations.
Translate an array of Korean text fragments into professional English while STRICTLY preserving HTML-like formatting tags (<b>, </b>, <i>, </i>, <br>).

# Critical Rules
1. **One-to-One Mapping**: The input array has ${batchLength} items. The output MUST have exactly ${batchLength} items.
2. **Order Preservation**: Do NOT reorder, merge, or split items.
3. **Tag Preservation - CRITICAL**:
    - Preserve ALL tags EXACTLY as they appear: <b>, </b>, <i>, </i>, <u>, </u>, <br>, <color:XXXXXX>, </color>
    - The <color:...> tag contains either a hex code (e.g., <color:0000FF>) or a theme token (e.g., <color:bg1>, <color:tx1.lm50000>). Treat the value as an OPAQUE ID — copy it character-for-character into the translation. NEVER translate, alter, or drop it.
    - **CRITICAL SCOPING**: Color tags must wrap **ONLY** the corresponding words. Do not extend the tag to the entire sentence if the original was specific.
    - **TAG REORDERING**: If the word order changes during translation, you **MUST** move the tag to wrap the translated word in its *new* position.
    - **Example**: '<color:0000FF>사과</color>를 좋아해' -> 'I like <color:0000FF>apples</color>' (Tag moved to end).
    - If the original text has NO tags, the translation MUST have NO tags.
    - If the original has <b>only part</b> bolded, keep ONLY that part bolded.
    - **CRITICAL: Do NOT add <br> or newline characters unless they exist in the original text.**
    - Do NOT split single sentences into multiple lines.
    - Do NOT add new tags that don't exist in the original.
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
        prompt += `\n# Additional Context\n${promptInstruction.trim()}\n`;
    }
    if (glossary?.trim()) {
        prompt += `\n# Terminology/Glossary\n${glossary.trim()}\n`;
    }
    return prompt;
};

/**
 * 텍스트에서 색상 토큰 목록을 추출합니다. (<color:0000FF>, <color:tx1.lm50000> 등)
 */
export const extractColorTokens = (text: string): string[] =>
    Array.from(text.matchAll(/<color:([^>]+)>/gi), m => m[1].trim().toLowerCase());

/**
 * 번역 결과가 원본의 색상 태그를 보존했는지 검사합니다.
 * 같은 색 조각이 병합될 수 있으므로 개수가 아닌 "고유 토큰 집합"으로 비교합니다.
 * (색상 토큰 소실 = 글자색 깨짐으로 직결되는 치명적 결함)
 */
export const validateTagPreservation = (originals: string[], translations: string[]): boolean => {
    if (originals.length !== translations.length) return false;
    for (let i = 0; i < originals.length; i++) {
        const origSet = new Set(extractColorTokens(originals[i]));
        const transSet = new Set(extractColorTokens(translations[i] ?? ''));
        for (const token of origSet) {
            if (!transSet.has(token)) return false;
        }
    }
    return true;
};

export const categorizeError = (error: unknown): Error => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('authentication')) {
        return new Error('API 키가 잘못되었습니다. 설정에서 확인해주세요.');
    }
    if (msg.includes('404') || msg.includes('not_found') || msg.includes('model_not_found')) {
        return new Error('선택된 모델을 사용할 수 없습니다. 다른 모델을 시도해주세요.');
    }
    if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        return new Error('요청이 많아 일시적으로 제한됩니다. 잠시 후 다시 시도해주세요.');
    }
    return error instanceof Error ? error : new Error(msg);
};

// Dynamic import to avoid loading all SDKs upfront
export const getTranslateBatch = async (provider: ProviderId): Promise<TranslateBatchFn> => {
    switch (provider) {
        case 'gemini': {
            const { geminiTranslateBatch } = await import('./providers/geminiProvider');
            return geminiTranslateBatch;
        }
        case 'claude': {
            const { claudeTranslateBatch } = await import('./providers/claudeProvider');
            return claudeTranslateBatch;
        }
        case 'openai': {
            const { openaiTranslateBatch } = await import('./providers/openaiProvider');
            return openaiTranslateBatch;
        }
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
};
