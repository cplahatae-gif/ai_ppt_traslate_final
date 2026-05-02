/**
 * useAuth Hook - 인증 상태 관리 훅
 * 
 * 이 훅은 컴포넌트에서 인증 상태를 쉽게 사용할 수 있게 합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth/AuthService';
import type { User, LoginCredentials, UserRegistrationData, AuthResult } from '../types';

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (credentials: LoginCredentials) => Promise<AuthResult>;
    register: (data: UserRegistrationData) => Promise<AuthResult>;
    logout: () => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    checkUser: () => Promise<void>;
    updateApiKey: (apiKey: string) => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkUser = useCallback(async () => {
        setLoading(true);
        try {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateApiKey = useCallback(async (apiKey: string): Promise<boolean> => {
        if (!user) return false;
        const success = await authService.updateApiKey(user.id, apiKey);
        if (success) {
            setUser(prev => prev ? { ...prev, apiKey } : null);
        }
        return success;
    }, [user]);

    useEffect(() => {
        checkUser();
    }, [checkUser]);

    const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResult> => {
        setLoading(true);
        try {
            const result = await authService.login(credentials);
            if (result.success && result.user) {
                setUser(result.user);
            }
            return result;
        } finally {
            setLoading(false);
        }
    }, []);

    const register = useCallback(async (data: UserRegistrationData): Promise<AuthResult> => {
        setLoading(true);
        try {
            const result = await authService.register(data);
            return result;
        } finally {
            setLoading(false);
        }
    }, []);

    const loginWithGoogle = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            await authService.loginWithGoogle();
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        user,
        loading,
        isAuthenticated: user !== null && user.isApproved,
        login,
        register,
        logout,
        loginWithGoogle,
        checkUser,
        updateApiKey
    };
}
