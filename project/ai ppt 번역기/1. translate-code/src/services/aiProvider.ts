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
    - **NEVER invent a color tag.** Do NOT colorize warnings, notes, or emphasis (※, ①, ②...) unless the source item already has that exact color tag.
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
7. **Consistency**: Identical source items MUST get identical translations (same string in → same string out).
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
 * 같은 색 조각이 병합될 수 있으므로 개수가 아닌 "고유 토큰 집합"으로 비교하되,
 * 소실(원본 색 누락)과 무단 추가(LLM이 발명한 색) 모두 실패 처리합니다.
 */
export const validateTagPreservation = (originals: string[], translations: string[]): boolean => {
    if (originals.length !== translations.length) return false;
    for (let i = 0; i < originals.length; i++) {
        const origSet = new Set(extractColorTokens(originals[i]));
        const transSet = new Set(extractColorTokens(translations[i] ?? ''));
        if (origSet.size !== transSet.size) return false;
        for (const token of origSet) {
            if (!transSet.has(token)) return false;
        }
    }
    return true;
};

/**
 * 색상 태그를 결정적으로 복원합니다. (재번역으로도 못 고친 경우의 최종 방어선)
 * - 원본에 색이 없으면: 번역의 모든 색 태그 제거 (LLM이 발명한 색 차단)
 * - 원본 문단 전체가 단일 색이면: 번역 전체를 그 색으로 재래핑
 * - 다색 문단이면: 원본에 없는 색 태그만 제거 (위치는 LLM 결과 존중)
 */
export const repairColorTags = (original: string, translated: string): string => {
    const origTokens = [...new Set(extractColorTokens(original))];
    const transTokens = [...new Set(extractColorTokens(translated))];
    const sameSet = origTokens.length === transTokens.length
        && origTokens.every(t => transTokens.includes(t));
    if (sameSet) return translated;

    const stripAllColors = (s: string) => s.replace(/<\/?color[^>]*>/gi, '');

    if (origTokens.length === 0) {
        return stripAllColors(translated);
    }

    // 원본에서 색 래퍼 밖에 실제 텍스트가 없으면 = 문단 전체가 색칠된 상태
    const outsideColor = original
        .replace(/<color:[^>]+>[\s\S]*?<\/color>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    if (origTokens.length === 1 && outsideColor === '') {
        return `<color:${origTokens[0]}>${stripAllColors(translated)}</color>`;
    }

    // 다색/부분색: 원본에 없는 색의 여는 태그만 제거 (짝 잃은 닫는 태그는 무해)
    return translated.replace(/<color:([^>]+)>/gi, (m, tok) =>
        origTokens.includes(tok.trim().toLowerCase()) ? m : '');
};

/**
 * 동일 원문은 동일 번역으로 통일합니다. (번역 메모리 일관성)
 * 표에 반복되는 라벨('지참' 등)이 배치에 따라 다르게 번역되는 문제 방지.
 * 첫 번째 등장한 번역을 기준으로 통일.
 */
export const unifyTranslations = (originals: string[], translations: string[]): string[] => {
    const firstSeen = new Map<string, string>();
    return translations.map((trans, i) => {
        const key = (originals[i] ?? '').trim();
        if (!key) return trans;
        const existing = firstSeen.get(key);
        if (existing !== undefined) return existing;
        firstSeen.set(key, trans);
        return trans;
    });
};

/**
 * 박스 넘침 항목용 표준 약어 치환 (결정적 — 오역 리스크 0).
 * LLM 축약 재번역 전에 먼저 시도하는 가장 약한 개입.
 */
const ABBREVIATIONS: [RegExp, string][] = [
    [/\bManagement\b/g, 'Mgmt'],
    [/\bDepartment\b/g, 'Dept.'],
    [/\bInformation\b/g, 'Info'],
    [/\bApproximately\b/g, 'Approx.'],
    [/\bAverage\b/g, 'Avg.'],
    [/\bMaximum\b/g, 'Max.'],
    [/\bMinimum\b/g, 'Min.'],
    [/\bNumber\b/g, 'No.'],
    [/\bEquipment\b/g, 'Eqpt.'],
    [/\bRequirements?\b/g, 'Req.'],
    [/ and /g, ' & '],
];

export const abbreviateForFit = (text: string): string =>
    ABBREVIATIONS.reduce((t, [re, rep]) => t.replace(re, rep), text);

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
