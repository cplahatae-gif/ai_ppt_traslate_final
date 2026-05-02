/**
 * AuthService - 사용자 인증 서비스
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * 이 서비스는 다음 기능을 담당합니다:
 * - 사용자 회원가입 (관리자 승인 필요)
 * - 로그인/로그아웃
 * - 세션 관리
 * - API 키 저장/로드
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type {
    User,
    UserRegistrationData,
    LoginCredentials,
    AuthResult
} from '../../types';

export class AuthService {
    /**
     * 새 사용자를 등록합니다
     * 등록 후 관리자 승인이 필요합니다
     */
    async register(userData: UserRegistrationData): Promise<AuthResult> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        try {
            const { data, error } = await supabase!.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                    },
                },
            });

            if (error) throw error;
            if (!data.user) throw new Error('User creation failed');

            return {
                success: true,
                requiresApproval: true,
                user: {
                    id: data.user.id,
                    email: data.user.email!,
                    name: userData.name,
                    isApproved: false,
                    isAdmin: false,
                    accessCount: 0,
                    createdAt: new Date(data.user.created_at),
                    lastLoginAt: new Date(data.user.created_at),
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown registration error',
            };
        }
    }

    /**
     * 사용자 로그인
     */
    async login(credentials: LoginCredentials): Promise<AuthResult> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        try {
            const { data, error } = await supabase!.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
            });

            if (error) throw error;
            if (!data.user) throw new Error('Login failed');

            const { data: profile, error: profileError } = await supabase!
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            if (!profile.is_approved) {
                return {
                    success: true,
                    requiresApproval: true,
                    user: this.mapProfileToUser(profile),
                };
            }

            await supabase!
                .from('profiles')
                .update({
                    last_login_at: new Date().toISOString(),
                    access_count: (profile.access_count || 0) + 1
                })
                .eq('id', data.user.id);

            return {
                success: true,
                user: this.mapProfileToUser({
                    ...profile,
                    access_count: (profile.access_count || 0) + 1,
                    last_login_at: new Date().toISOString()
                }),
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown login error',
            };
        }
    }

    /**
     * 현재 사용자 로그아웃
     */
    async logout(): Promise<void> {
        if (!isSupabaseConfigured()) return;
        await supabase!.auth.signOut();
    }

    /**
     * 구글 SSO 로그인 시작
     */
    async loginWithGoogle(): Promise<void> {
        if (!isSupabaseConfigured()) return;

        const { error } = await supabase!.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) throw error;
    }

    /**
     * 현재 로그인된 사용자 정보 조회
     */
    async getCurrentUser(): Promise<User | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data: { user } } = await supabase!.auth.getUser();
            if (!user) return null;

            const { data: profile } = await supabase!
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            return profile ? this.mapProfileToUser(profile) : null;
        } catch (error) {
            console.error('GetCurrentUser error:', error);
            return null;
        }
    }

    /**
     * 사용자의 API 키를 업데이트합니다
     */
    async updateApiKey(userId: string, apiKey: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase!
                .from('profiles')
                .update({ api_key: apiKey })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Update API Key error:', error);
            return false;
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
}

export const authService = new AuthService();
