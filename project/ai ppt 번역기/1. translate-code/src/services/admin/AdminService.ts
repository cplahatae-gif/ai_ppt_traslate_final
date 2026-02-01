/**
 * AdminService - 관리자 서비스
 * 
 * Requirements: 3.1 ~ 3.6
 * 
 * 이 서비스는 다음 기능을 담당합니다:
 * - 사용자 승인/비활성화
 * - 사용자 통계 조회
 * - 접근 로그 관리
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User, UserStats, AccessLog, LimitStatus } from '../../types';

// 최대 사용자 수 제한
const MAX_USERS = 20;

export interface AdminStats {
    totalUsers: number;
    pendingUsers: number;
    todayTokens: number;
    totalErrors: number;
}

export class AdminService {
    /**
     * 승인 대기 중인 사용자 목록을 조회합니다
     */
    async getPendingUsers(): Promise<User[]> {
        if (!isSupabaseConfigured()) {
            return [];
        }

        try {
            const { data, error } = await supabase!
                .from('profiles')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map(this.mapProfileToUser);
        } catch (error) {
            console.error('Error fetching pending users:', error);
            throw error;
        }
    }

    /**
     * 모든 사용자 목록을 조회합니다
     */
    async getAllUsers(): Promise<User[]> {
        if (!isSupabaseConfigured()) {
            return [];
        }

        try {
            const { data, error } = await supabase!
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map(this.mapProfileToUser);
        } catch (error) {
            console.error('Error fetching all users:', error);
            throw error;
        }
    }

    /**
     * 사용자를 승인합니다
     */
    async approveUser(userId: string): Promise<void> {
        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured');
        }

        try {
            const { error } = await supabase!
                .from('profiles')
                .update({ is_approved: true })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Error approving user:', error);
            throw error;
        }
    }

    /**
     * 시스템 전체 통계를 조회합니다.
     */
    async getSystemStats(): Promise<AdminStats> {
        if (!isSupabaseConfigured()) {
            return { totalUsers: 0, pendingUsers: 0, todayTokens: 0, totalErrors: 0 };
        }

        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // 1. 총 사용자 수
            const { count: totalUsers, error: userError } = await supabase!
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (userError) throw userError;

            // 2. 대기 사용자 수
            const { count: pendingUsers, error: pendingError } = await supabase!
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', false);

            if (pendingError) throw pendingError;

            // 3. 금일 토큰 사용량
            const { data: tokenData, error: tokenError } = await supabase!
                .from('api_usage')
                .select('tokens_used')
                .gte('request_timestamp', startOfDay.toISOString());

            if (tokenError) throw tokenError;

            const todayTokens = tokenData.reduce((sum, row) => sum + (row.tokens_used || 0), 0);

            // 4. 오류 발생 건수
            const { count: totalErrors, error: errorError } = await supabase!
                .from('translation_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'failed');

            if (errorError) throw errorError;

            return {
                totalUsers: totalUsers || 0,
                pendingUsers: pendingUsers || 0,
                todayTokens: todayTokens,
                totalErrors: totalErrors || 0
            };
        } catch (error) {
            console.error('Error fetching system stats:', error);
            return { totalUsers: 0, pendingUsers: 0, todayTokens: 0, totalErrors: 0 };
        }
    }

    private mapProfileToUser(profile: any): User {
        return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            isApproved: profile.is_approved,
            isAdmin: profile.is_admin,
            apiKey: profile.api_key,
            accessCount: profile.access_count,
            createdAt: new Date(profile.created_at),
            lastLoginAt: profile.last_login_at ? new Date(profile.last_login_at) : new Date(profile.created_at),
        };
    }

    // 미사용 메서드들은 에러 방지를 위해 간단히 처리
    async getUserStats(): Promise<UserStats[]> { return []; }
    async deactivateUser(userId: string): Promise<void> {
        if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
        await supabase!.from('profiles').update({ is_approved: false }).eq('id', userId);
    }
    async getUserAccessHistory(userId: string): Promise<AccessLog[]> { return []; }
    async canAddNewUser(): Promise<boolean> {
        const stats = await this.getSystemStats();
        return stats.totalUsers < MAX_USERS;
    }
}

export const adminService = new AdminService();
