import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase credentials not found. Authentication features will be disabled. ' +
        'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};

/**
 * Supabase 연결 상태를 테스트합니다.
 * @returns 연결 상태 객체
 */
export const testSupabaseConnection = async (): Promise<{
    connected: boolean;
    error?: string;
    latency?: number;
}> => {
    if (!supabase) {
        return { connected: false, error: 'Supabase가 설정되지 않았습니다.' };
    }

    try {
        const startTime = Date.now();
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        const latency = Date.now() - startTime;

        if (error) {
            return { connected: false, error: error.message };
        }

        return { connected: true, latency };
    } catch (err: any) {
        return { connected: false, error: err.message || '연결 테스트 실패' };
    }
};
