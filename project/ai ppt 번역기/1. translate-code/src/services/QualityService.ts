/**
 * QualityService - 번역 품질 검증 서비스
 * 
 * Requirement: 5.1~5.14
 */

import { GoogleGenAI, Type } from "@google/genai";
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { QualityResult, QualityIssue, QualityCriteria } from '../types';

export class QualityService {
    /**
     * 번역된 텍스트들의 품질을 검증합니다.
     */
    async verify(
        jobId: string,
        originalTexts: string[],
        translatedTexts: string[],
        apiKey: string
    ): Promise<{ result: QualityResult, tokens: number } | null> {
        if (!apiKey) return null;

        const ai = new GoogleGenAI({ apiKey });

        // 전수 검사: 모든 텍스트를 검증합니다.
        // 데이터가 많을 경우를 대비하여 index 정보를 포함한 객체 배열로 변환
        const targetData = originalTexts.map((text, index) => ({
            index,
            original: text,
            translated: translatedTexts[index]
        }));

        try {
            const systemInstruction = `You are an expert quality assurance linguist specializing in Korean to English PPT translations.
Evaluate the translation quality based on the provided original and translated text pairs.
Provide a score from 0.0 to 1.0 (1.0 being perfect) and identify specific issues.

# Evaluation Criteria (0.0 - 1.0 for each):
1. terminologyConsistent: Are specialized terms translated consistently?
2. formattingPreserved: Are HTML tags (<b>, <color>, etc.) correctly preserved and wrapping the right words?
3. englishConsistent: Is the English natural and professional?
4. numbersPreserved: Are all numbers, dates, and units identical?
5. terminologyAppropriate: Is the tone suitable for a professional PPT?

# Output Rules:
- overallScore: Average of criteria.
- passed: true if overallScore >= 0.8.
- issues: List all critical issues found. IMPORTANT: You MUST include the 'index' of the sentence where the issue lies.
  - severity: 'low', 'medium', 'high'
  - index: The integer index from the input array.
  - description: Explain the issue in **Korean**.
  - suggestion: Provide the corrected text in **English** (for the translation) but explain why in **Korean**.
  - type: Issue type in **English** (e.g. terminology, formatting).

IMPORTANT: All 'description' and 'reason' fields in the output JSON MUST be written in **Korean**.`;

            const prompt = `Evaluate these translation pairs and identify issues:
${JSON.stringify(targetData)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            overallScore: { type: Type.NUMBER },
                            criteriaScores: {
                                type: Type.OBJECT,
                                properties: {
                                    terminology: { type: Type.NUMBER },
                                    formatting: { type: Type.NUMBER },
                                    grammar: { type: Type.NUMBER },
                                    consistency: { type: Type.NUMBER }
                                }
                            },
                            passed: { type: Type.BOOLEAN },
                            issues: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        index: { type: Type.INTEGER },
                                        type: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        severity: { type: Type.STRING },
                                        location: { type: Type.STRING },
                                        suggestion: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    },
                },
            });

            const result = JSON.parse(response.text || "{}");

            // 토큰 계산 (입력 프롬프트 + 출력 응답)
            const inputTokens = Math.ceil(prompt.length / 4); // 대략적인 문자 수 기반 계산
            const outputTokens = Math.ceil((response.text?.length || 0) / 4);
            const totalTokens = inputTokens + outputTokens;

            // Supabase에 결과 저장
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
