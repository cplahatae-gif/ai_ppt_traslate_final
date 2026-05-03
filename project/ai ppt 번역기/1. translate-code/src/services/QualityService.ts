/**
 * QualityService - 번역 품질 검증 서비스
 */

import { GoogleGenAI } from "@google/genai";
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { QualityResult } from '../types';

export class QualityService {
    async verify(
        jobId: string,
        originalTexts: string[],
        translatedTexts: string[],
    ): Promise<{ result: QualityResult, tokens: number } | null> {
        // Quality verification always uses Gemini regardless of translation provider
        const apiKey = localStorage.getItem('gemini_api_key') || '';
        if (!apiKey) return null;

        const ai = new GoogleGenAI({ apiKey });

        // 최대 10개 항목, 1500자로 제한 (응답 크기 초과 방지)
        const MAX_ITEMS = 10;
        const MAX_CHARS = 1500;
        let charCount = 0;
        const targetData = originalTexts
            .map((text, index) => ({ index, original: text, translated: translatedTexts[index] }))
            .slice(0, MAX_ITEMS)
            .filter(item => {
                charCount += (item.original.length + item.translated.length);
                return charCount <= MAX_CHARS;
            });

        try {
            const prompt = `You are a Korean-to-English translation quality reviewer for PPT documents.
Review these ${targetData.length} translation pairs and return ONLY a JSON object (no markdown, no explanation).

Pairs:
${JSON.stringify(targetData)}

Return this exact JSON structure:
{
  "overallScore": <0.0-1.0>,
  "criteriaScores": {
    "terminology": <0.0-1.0>,
    "formatting": <0.0-1.0>,
    "grammar": <0.0-1.0>,
    "consistency": <0.0-1.0>
  },
  "passed": <true if overallScore >= 0.8>,
  "issues": [
    {
      "index": <integer>,
      "type": "terminology|grammar|formatting|consistency",
      "severity": "low|medium|high",
      "description": "<Korean: what's wrong>",
      "suggestion": "<English: corrected text>"
    }
  ]
}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { maxOutputTokens: 4096 },
            });

            const raw = response.text || '{}';
            // JSON 블록 추출 (```json ... ``` 형태도 처리)
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found in response');
            const result = JSON.parse(jsonMatch[0]);

            const inputTokens = Math.ceil(prompt.length / 4);
            const outputTokens = Math.ceil(raw.length / 4);
            const totalTokens = inputTokens + outputTokens;

            if (isSupabaseConfigured() && jobId) {
                await supabase!
                    .from('quality_results')
                    .insert({
                        translation_job_id: jobId,
                        overall_score: result.overallScore,
                        criteria_scores: result.criteriaScores,
                        issues: result.issues
                    });
            }

            return { result, tokens: totalTokens };
        } catch (error) {
            console.error('Quality verification error:', error);
            return null;
        }
    }
}

export const qualityService = new QualityService();
