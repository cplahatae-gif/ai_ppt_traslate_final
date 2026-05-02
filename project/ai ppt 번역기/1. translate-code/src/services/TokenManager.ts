/**
 * TokenManager - 토큰 사용량 관리 및 제한 서비스
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TokenEstimate, LimitStatus, PageLimitSuggestion } from '../types';

export interface UsageHistory {
    id: string;
    tokensUsed: number;
    endpoint: string;
    timestamp: Date;
    success: boolean;
}

export interface UsageStats {
    todayUsed: number;
    todayRequests: number;
    weekUsed: number;
    weekRequests: number;
    remainingTokens: number;
    remainingRequests: number;
    usagePercent: number;
}

export class TokenManager {
    // Gemini 3 Flash (사용자 지정 모델) Free Tier 기준 (15 RPM, 1M TPM, 1,500 RPD)
    // 인당 하루 권장 쿼터를 100만 토큰으로 설정 (TPM이 100만이므로 넉넉함)
    private readonly DAILY_TOKEN_LIMIT = 1000000;
    private readonly DAILY_REQUEST_LIMIT = 1500;
    private readonly PER_REQUEST_LIMIT = 100000;

    /**
     * 텍스트 배열로부터 예상 토큰 수를 계산합니다 (1.1)
     */
    estimateTokens(texts: string[]): number {
        const totalChars = texts.join('').length;
        // Gemini 모델 기준 대략적인 예측값 (1.5배 + 오버헤드)
        return Math.ceil(totalChars * 1.5) + (texts.length * 5);
    }

    /**
     * 현재 사용자의 토큰 사용 한도 상태를 조회합니다 (1.2)
     */
    async getLimitStatus(userId: string): Promise<LimitStatus> {
        if (!isSupabaseConfigured()) {
            return { dailyUsed: 0, dailyLimit: this.DAILY_TOKEN_LIMIT, minuteUsed: 0, minuteLimit: 10, canProceed: true };
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        try {
            const { data, error } = await supabase!
                .from('api_usage')
                .select('tokens_used, id')
                .eq('user_id', userId)
                .gte('request_timestamp', startOfDay.toISOString());

            if (error) throw error;

            const dailyUsed = data.reduce((sum, row) => sum + (row.tokens_used || 0), 0);
            const dailyRequests = data.length;

            return {
                dailyUsed,
                dailyLimit: this.DAILY_TOKEN_LIMIT,
                minuteUsed: 0,
                minuteLimit: 10,
                canProceed: dailyUsed < this.DAILY_TOKEN_LIMIT && dailyRequests < this.DAILY_REQUEST_LIMIT
            };
        } catch (error) {
            console.error('Error fetching limit status:', error);
            return { dailyUsed: 0, dailyLimit: this.DAILY_TOKEN_LIMIT, minuteUsed: 0, minuteLimit: 10, canProceed: true };
        }
    }

    /**
     * 실제 사용된 토큰량을 기록합니다 (1.3)
     */
    async logUsage(userId: string, tokensUsed: number, endpoint: string = 'gemini-2.5-flash'): Promise<void> {
        if (!isSupabaseConfigured()) return;

        try {
            await supabase!
                .from('api_usage')
                .insert({
                    user_id: userId,
                    tokens_used: tokensUsed,
                    endpoint,
                    success: true
                });
        } catch (error) {
            console.error('Error logging token usage:', error);
        }
    }

    /**
     * 한도 초과 시 권장 페이지 범위를 계산합니다 (1.5)
     */
    calculateSuggestedRange(totalSlides: number, estimatedTotalTokens: number): PageLimitSuggestion {
        const perSlideTokens = estimatedTotalTokens / totalSlides;
        const recommendedCount = Math.floor(this.PER_REQUEST_LIMIT / perSlideTokens);

        return {
            recommendedPages: [1, Math.min(recommendedCount, totalSlides)],
            reason: `예상 토큰량이 단일 요청 한도(${this.PER_REQUEST_LIMIT.toLocaleString()})를 초과합니다.`,
            estimatedTokens: perSlideTokens * Math.min(recommendedCount, totalSlides)
        };
    }

    /**
     * 상세 사용량 통계를 조회합니다
     */
    async getUsageStats(userId: string): Promise<UsageStats> {
        if (!isSupabaseConfigured()) {
            return {
                todayUsed: 0,
                todayRequests: 0,
                weekUsed: 0,
                weekRequests: 0,
                remainingTokens: this.DAILY_TOKEN_LIMIT,
                remainingRequests: this.DAILY_REQUEST_LIMIT,
                usagePercent: 0
            };
        }

        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);

        try {
            // 오늘 사용량
            const { data: todayData, error: todayError } = await supabase!
                .from('api_usage')
                .select('tokens_used')
                .eq('user_id', userId)
                .gte('request_timestamp', startOfDay.toISOString());

            if (todayError) throw todayError;

            // 주간 사용량
            const { data: weekData, error: weekError } = await supabase!
                .from('api_usage')
                .select('tokens_used')
                .eq('user_id', userId)
                .gte('request_timestamp', startOfWeek.toISOString());

            if (weekError) throw weekError;

            const todayUsed = todayData.reduce((sum, row) => sum + (row.tokens_used || 0), 0);
            const todayRequests = todayData.length;
            const weekUsed = weekData.reduce((sum, row) => sum + (row.tokens_used || 0), 0);
            const weekRequests = weekData.length;

            return {
                todayUsed,
                todayRequests,
                weekUsed,
                weekRequests,
                remainingTokens: Math.max(0, this.DAILY_TOKEN_LIMIT - todayUsed),
                remainingRequests: Math.max(0, this.DAILY_REQUEST_LIMIT - todayRequests),
                usagePercent: Math.round((todayUsed / this.DAILY_TOKEN_LIMIT) * 100)
            };
        } catch (error) {
            console.error('Error fetching usage stats:', error);
            return {
                todayUsed: 0,
                todayRequests: 0,
                weekUsed: 0,
                weekRequests: 0,
                remainingTokens: this.DAILY_TOKEN_LIMIT,
                remainingRequests: this.DAILY_REQUEST_LIMIT,
                usagePercent: 0
            };
        }
    }

    /**
     * 최근 사용 기록을 조회합니다
     */
    async getUsageHistory(userId: string, limit: number = 10): Promise<UsageHistory[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const { data, error } = await supabase!
                .from('api_usage')
                .select('id, tokens_used, endpoint, request_timestamp, success')
                .eq('user_id', userId)
                .order('request_timestamp', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data.map(row => ({
                id: row.id,
                tokensUsed: row.tokens_used,
                endpoint: row.endpoint,
                timestamp: new Date(row.request_timestamp),
                success: row.success
            }));
        } catch (error) {
            console.error('Error fetching usage history:', error);
            return [];
        }
    }

    /**
     * 일일 한도 정보를 반환합니다
     */
    getDailyLimits() {
        return {
            tokenLimit: this.DAILY_TOKEN_LIMIT,
            requestLimit: this.DAILY_REQUEST_LIMIT,
            perRequestLimit: this.PER_REQUEST_LIMIT
        };
    }
}

export const tokenManager = new TokenManager();

