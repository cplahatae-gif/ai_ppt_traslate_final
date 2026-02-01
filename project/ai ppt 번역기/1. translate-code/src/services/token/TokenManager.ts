/**
 * TokenManager - 토큰 사용량 관리 서비스
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * 이 서비스는 다음 기능을 담당합니다:
 * - 토큰 사용량 예측
 * - API 한도 체크
 * - 페이지 제한 제안
 * - 일일 사용량 추적
 */

import type {
    TokenEstimate,
    LimitStatus,
    PageLimitSuggestion
} from '../../types';

// Gemini 3.0 Flash 무료 티어 한도
const DAILY_REQUEST_LIMIT = 1500;
const MINUTE_REQUEST_LIMIT = 15;

export class TokenManager {
    /**
     * 텍스트의 예상 토큰 수를 계산합니다
     */
    estimateTokenUsage(text: string): TokenEstimate {
        // 기본 토큰 추정: 한글은 글자당 약 1.5토큰
        const estimatedTokens = Math.ceil(text.length * 1.5);

        return {
            estimatedTokens,
            estimatedCost: 0, // 무료 티어
            withinLimits: estimatedTokens < 100000, // 임시 한도
            suggestedPageLimit: undefined,
        };
    }

    /**
     * 현재 사용자의 API 한도 상태를 확인합니다
     */
    async checkDailyLimits(userId: string): Promise<LimitStatus> {
        // TODO: Supabase에서 실제 사용량 조회
        return {
            dailyUsed: 0,
            dailyLimit: DAILY_REQUEST_LIMIT,
            minuteUsed: 0,
            minuteLimit: MINUTE_REQUEST_LIMIT,
            canProceed: true,
        };
    }

    /**
     * API 사용량을 기록합니다
     */
    async trackApiUsage(userId: string, tokensUsed: number): Promise<void> {
        // TODO: Supabase에 사용량 기록
        throw new Error('Not implemented');
    }

    /**
     * 토큰 한도에 맞는 페이지 제한을 제안합니다
     */
    suggestPageLimitation(
        totalPages: number,
        estimatedTokensPerPage: number,
        maxTokens: number
    ): PageLimitSuggestion {
        const maxPages = Math.floor(maxTokens / estimatedTokensPerPage);
        const recommendedPages: number[] = [];

        for (let i = 1; i <= Math.min(maxPages, totalPages); i++) {
            recommendedPages.push(i);
        }

        return {
            recommendedPages,
            reason: `토큰 한도(${maxTokens.toLocaleString()})에 맞춰 최대 ${maxPages}페이지까지 번역 가능합니다.`,
            estimatedTokens: maxPages * estimatedTokensPerPage,
        };
    }
}

export const tokenManager = new TokenManager();
