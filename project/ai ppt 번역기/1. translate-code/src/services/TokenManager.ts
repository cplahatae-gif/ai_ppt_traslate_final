import type { PageLimitSuggestion } from '../types';

export class TokenManager {
    private readonly PER_REQUEST_LIMIT = 100000;

    estimateTokens(texts: string[]): number {
        const totalChars = texts.join('').length;
        return Math.ceil(totalChars * 1.5) + (texts.length * 5);
    }

    calculateSuggestedRange(totalSlides: number, estimatedTotalTokens: number): PageLimitSuggestion {
        const perSlideTokens = estimatedTotalTokens / totalSlides;
        const recommendedCount = Math.floor(this.PER_REQUEST_LIMIT / perSlideTokens);

        return {
            recommendedPages: [1, Math.min(recommendedCount, totalSlides)],
            reason: `예상 토큰량이 단일 요청 한도(${this.PER_REQUEST_LIMIT.toLocaleString()})를 초과합니다.`,
            estimatedTokens: perSlideTokens * Math.min(recommendedCount, totalSlides)
        };
    }
}

export const tokenManager = new TokenManager();
