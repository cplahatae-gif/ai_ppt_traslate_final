import { GoogleGenAI } from "@google/genai";
import { ProviderId, getApiKeyFromStorage } from './modelCatalog';
import { buildSystemPrompt, getTranslateBatch, categorizeError, validateTagPreservation } from './aiProvider';

const DEFAULT_BATCH_SIZE = 25;
const MAX_RETRIES = 5;
const CONCURRENCY = 2; // Gemini 15 RPM 안전선; Claude/OpenAI도 무리 없음

const isRateLimitError = (error: unknown): boolean => {
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('429') || msg.includes('rate_limit') || msg.includes('RESOURCE_EXHAUSTED');
};

// 재시도해도 해결되지 않는 오류 (잘못된 키, 없는 모델) — 즉시 실패
const isNonRetryableError = (error: unknown): boolean => {
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('401') || msg.includes('403') || msg.includes('404')
        || msg.includes('API_KEY_INVALID') || msg.includes('model_not_found');
};

export const estimateTokens = (texts: string[]): number => {
    const totalChars = texts.join('').length;
    return Math.ceil(totalChars * 1.5) + (texts.length * 5);
};

export const translateTexts = async (
    koreanTexts: string[],
    onProgress?: (completedBatches: number, totalBatches: number) => void,
    promptInstruction?: string,
    glossary?: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
    apiKey?: string,
    provider: ProviderId = 'gemini',
    model: string = 'gemini-2.5-flash'
): Promise<string[]> => {
    if (!koreanTexts || koreanTexts.length === 0) return [];

    const finalApiKey = apiKey || getApiKeyFromStorage(provider) || import.meta.env.VITE_GEMINI_API_KEY || '';
    const translateBatch = await getTranslateBatch(provider);

    const batches: string[][] = [];
    for (let i = 0; i < koreanTexts.length; i += batchSize) {
        batches.push(koreanTexts.slice(i, i + batchSize));
    }

    const results: string[][] = new Array(batches.length);
    let nextBatchIdx = 0;
    let completedBatches = 0;

    const runBatchWithRetry = async (batch: string[]): Promise<string[]> => {
        let lastError: Error | null = null;
        let tagLossFallback: string[] | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const systemPrompt = buildSystemPrompt(batch.length, promptInstruction, glossary);
                const result = await translateBatch(batch, systemPrompt, model, finalApiKey);

                // 색상 태그 소실 검사 — 소실 시 1회만 재번역 시도
                if (validateTagPreservation(batch, result)) {
                    return result;
                }
                if (tagLossFallback) return tagLossFallback; // 이미 1회 재시도함 → 수용
                tagLossFallback = result;
                if (attempt < MAX_RETRIES) {
                    console.warn('[translate] 색상 태그 소실 감지, 배치 재번역 1회 시도');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
            } catch (error) {
                lastError = categorizeError(error);
                if (isNonRetryableError(error)) throw lastError;
                if (attempt < MAX_RETRIES) {
                    const delay = isRateLimitError(error) ? 65000 : 2000 * attempt;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // 태그가 일부 소실됐더라도 번역 자체는 성공했으면 결과를 사용 (전체 실패보다 낫다)
        if (tagLossFallback) return tagLossFallback;
        throw lastError;
    };

    const workerCount = Math.min(CONCURRENCY, batches.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const idx = nextBatchIdx++;
            if (idx >= batches.length) break;
            results[idx] = await runBatchWithRetry(batches[idx]);
            completedBatches++;
            if (onProgress) onProgress(completedBatches, batches.length);
        }
    });

    await Promise.all(workers);

    return results.flat();
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
            model: 'gemini-2.5-flash',
            contents: 'Say "API key is valid" in one word: Valid',
            config: {
                maxOutputTokens: 10,
                thinkingConfig: { thinkingBudget: 0 },
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
