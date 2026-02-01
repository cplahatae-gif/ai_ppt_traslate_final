/**
 * JobService - 번역 작업(Job) 관리 서비스
 * 
 * 이 서비스는 번역 작업의 상태를 Supabase에 기록하고 관리합니다. (Requirement 1.1)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TranslationJob } from '../types';

export class JobService {
    /**
     * 새로운 번역 작업을 생성합니다
     */
    async createJob(userId: string, fileName: string): Promise<string | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data, error } = await supabase!
                .from('translation_jobs')
                .insert({
                    user_id: userId,
                    file_name: fileName,
                    status: 'pending'
                })
                .select('id')
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error creating job:', error);
            return null;
        }
    }

    /**
     * 작업의 상태와 사용된 토큰량을 업데이트합니다
     */
    async updateJob(jobId: string, status: TranslationJob['status'], tokensUsed?: number, downloadUrl?: string): Promise<void> {
        if (!isSupabaseConfigured()) return;

        try {
            const updateData: any = {
                status,
                updated_at: new Date().toISOString()
            };
            if (tokensUsed !== undefined) updateData.tokens_used = tokensUsed;
            if (downloadUrl) updateData.download_url = downloadUrl;
            if (status === 'completed') updateData.completed_at = new Date().toISOString();

            await supabase!
                .from('translation_jobs')
                .update(updateData)
                .eq('id', jobId);
        } catch (error) {
            console.error('Error updating job:', error);
        }
    }
}

export const jobService = new JobService();
