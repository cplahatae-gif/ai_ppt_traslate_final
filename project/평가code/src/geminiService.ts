/**
 * Gemini AI 품질 평가 서비스
 * AI를 활용하여 번역 품질을 의미적으로 분석합니다.
 */

import { GoogleGenAI } from "@google/genai";

const MAX_RETRIES = 3;

export interface AIEvaluationResult {
    overallScore: number;          // 0-100
    semanticAccuracy: number;      // 의미 정확도 0-25
    naturalness: number;           // 자연스러움 0-25
    terminologyAccuracy: number;   // 용어 정확도 0-25
    contextConsistency: number;    // 문맥 일관성 0-25
    feedback: string[];            // AI가 제공하는 구체적 피드백
    issues: AIIssue[];             // AI가 발견한 이슈들
}

export interface AIIssue {
    slideNumber: number;
    severity: 'high' | 'medium' | 'low';
    type: 'semantic' | 'naturalness' | 'terminology' | 'context';
    korean: string;
    english: string;
    issue: string;
    suggestion: string;
}

export interface TextPairForEvaluation {
    slideNumber: number;
    korean: string;
    english: string;
}

/**
 * Gemini API를 사용하여 번역 품질을 AI로 평가합니다.
 */
export async function evaluateWithAI(
    textPairs: TextPairForEvaluation[],
    apiKey: string,
    glossary?: string,
    onProgress?: (step: string, progress: number) => void
): Promise<AIEvaluationResult> {
    if (!apiKey) {
        throw new Error("API Key가 필요합니다. Gemini API Key를 입력해주세요.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // 샘플링: 너무 많은 텍스트는 비용/시간 문제가 있으므로 샘플링
    const sampleSize = Math.min(textPairs.length, 50);
    const sampledPairs = samplePairs(textPairs, sampleSize);

    onProgress?.('AI 품질 분석 준비 중...', 10);

    // 배치로 나누어 평가 (한 번에 10개씩)
    const batchSize = 10;
    const batches: TextPairForEvaluation[][] = [];
    for (let i = 0; i < sampledPairs.length; i += batchSize) {
        batches.push(sampledPairs.slice(i, i + batchSize));
    }

    const allIssues: AIIssue[] = [];
    const batchScores: { semantic: number; natural: number; term: number; context: number }[] = [];

    let completedBatches = 0;

    for (const batch of batches) {
        onProgress?.(`AI 분석 중... (${completedBatches + 1}/${batches.length})`,
            10 + Math.round((completedBatches / batches.length) * 80));

        try {
            const result = await evaluateBatchWithAI(ai, batch, glossary);
            allIssues.push(...result.issues);
            batchScores.push({
                semantic: result.semanticScore,
                natural: result.naturalnessScore,
                term: result.terminologyScore,
                context: result.contextScore,
            });
        } catch (error) {
            console.error('AI 평가 배치 실패:', error);
            // 실패한 배치는 기본 점수로 처리
            batchScores.push({ semantic: 20, natural: 20, term: 20, context: 20 });
        }

        completedBatches++;
    }

    onProgress?.('AI 분석 완료!', 100);

    // 평균 점수 계산
    const avgScores = {
        semantic: average(batchScores.map(s => s.semantic)),
        natural: average(batchScores.map(s => s.natural)),
        term: average(batchScores.map(s => s.term)),
        context: average(batchScores.map(s => s.context)),
    };

    const overallScore = Math.round(avgScores.semantic + avgScores.natural + avgScores.term + avgScores.context);

    // AI 피드백 생성
    const feedback = generateFeedback(avgScores, allIssues);

    return {
        overallScore,
        semanticAccuracy: Math.round(avgScores.semantic),
        naturalness: Math.round(avgScores.natural),
        terminologyAccuracy: Math.round(avgScores.term),
        contextConsistency: Math.round(avgScores.context),
        feedback,
        issues: allIssues.slice(0, 20), // 상위 20개 이슈만 반환
    };
}

/**
 * 단일 배치를 AI로 평가합니다.
 */
async function evaluateBatchWithAI(
    ai: GoogleGenAI,
    batch: TextPairForEvaluation[],
    glossary?: string
): Promise<{
    semanticScore: number;
    naturalnessScore: number;
    terminologyScore: number;
    contextScore: number;
    issues: AIIssue[];
}> {
    const systemInstruction = `You are an expert translation quality evaluator for Korean to English translations.
Evaluate the following translations and provide:
1. Scores (0-25 each) for: semantic accuracy, naturalness, terminology, context consistency
2. List of issues found with specific feedback

${glossary ? `Reference Glossary:\n${glossary}\n` : ''}

Evaluation Criteria:
- Semantic Accuracy (0-25): Does the English accurately convey the Korean meaning?
- Naturalness (0-25): Does the English sound natural and professional?
- Terminology (0-25): Are technical/domain terms translated correctly?
- Context Consistency (0-25): Is the translation consistent with the overall context?

For each issue found, provide:
- slideNumber: which slide it's from
- severity: "high", "medium", or "low"
- type: "semantic", "naturalness", "terminology", or "context"
- korean: the original text
- english: the translated text
- issue: what's wrong
- suggestion: how to fix it`;

    const prompt = `Evaluate these ${batch.length} Korean→English translation pairs:

${JSON.stringify(batch.map(p => ({
        slide: p.slideNumber,
        korean: p.korean.substring(0, 200),
        english: p.english.substring(0, 200)
    })), null, 2)}

Respond in JSON format:
{
  "semanticScore": number,
  "naturalnessScore": number,
  "terminologyScore": number,
  "contextScore": number,
  "issues": [
    {
      "slideNumber": number,
      "severity": "high" | "medium" | "low",
      "type": "semantic" | "naturalness" | "terminology" | "context",
      "korean": "original text",
      "english": "translated text",
      "issue": "description of the problem",
      "suggestion": "how to improve"
    }
  ]
}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                },
            });

            const jsonString = extractJson(response.text || "{}");
            const result = JSON.parse(jsonString);

            return {
                semanticScore: clamp(result.semanticScore || 20, 0, 25),
                naturalnessScore: clamp(result.naturalnessScore || 20, 0, 25),
                terminologyScore: clamp(result.terminologyScore || 20, 0, 25),
                contextScore: clamp(result.contextScore || 20, 0, 25),
                issues: (result.issues || []).map((issue: any) => ({
                    slideNumber: issue.slideNumber || 0,
                    severity: issue.severity || 'medium',
                    type: issue.type || 'semantic',
                    korean: issue.korean || '',
                    english: issue.english || '',
                    issue: issue.issue || '',
                    suggestion: issue.suggestion || '',
                })),
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
            }
        }
    }

    throw lastError || new Error("AI 평가 실패");
}

/**
 * JSON 추출 헬퍼
 */
function extractJson(text: string): string {
    const trimmedText = text.trim();
    const match = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1];
    }
    return trimmedText;
}

/**
 * 텍스트 쌍 샘플링 (균등하게 분포)
 */
function samplePairs(pairs: TextPairForEvaluation[], sampleSize: number): TextPairForEvaluation[] {
    if (pairs.length <= sampleSize) return pairs;

    const step = pairs.length / sampleSize;
    const sampled: TextPairForEvaluation[] = [];

    for (let i = 0; i < sampleSize; i++) {
        const index = Math.floor(i * step);
        sampled.push(pairs[index]);
    }

    return sampled;
}

/**
 * 평균 계산
 */
function average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * 값 클램프
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * AI 피드백 생성
 */
function generateFeedback(
    scores: { semantic: number; natural: number; term: number; context: number },
    issues: AIIssue[]
): string[] {
    const feedback: string[] = [];

    // 점수 기반 피드백
    if (scores.semantic < 20) {
        feedback.push("⚠️ 일부 번역에서 원문의 의미가 정확하게 전달되지 않았습니다.");
    } else if (scores.semantic >= 23) {
        feedback.push("✅ 번역의 의미 정확도가 우수합니다.");
    }

    if (scores.natural < 20) {
        feedback.push("⚠️ 영어 표현이 다소 어색한 부분이 있습니다. 원어민 검토를 권장합니다.");
    } else if (scores.natural >= 23) {
        feedback.push("✅ 영어 표현이 자연스럽고 전문적입니다.");
    }

    if (scores.term < 20) {
        feedback.push("⚠️ 전문 용어 번역에 일관성이 부족합니다. 단어장 참조를 권장합니다.");
    } else if (scores.term >= 23) {
        feedback.push("✅ 전문 용어가 일관되게 번역되었습니다.");
    }

    if (scores.context < 20) {
        feedback.push("⚠️ 문맥상 어울리지 않는 번역이 일부 있습니다.");
    } else if (scores.context >= 23) {
        feedback.push("✅ 전체적인 문맥 일관성이 좋습니다.");
    }

    // 이슈 기반 피드백
    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length > 0) {
        feedback.push(`🔴 ${highIssues.length}개의 중요한 번역 이슈가 발견되었습니다.`);
    }

    const termIssues = issues.filter(i => i.type === 'terminology');
    if (termIssues.length > 3) {
        feedback.push(`📖 ${termIssues.length}개의 용어 번역 이슈가 있습니다. 단어장 업데이트를 고려해주세요.`);
    }

    return feedback;
}

/**
 * API 키 유효성 확인
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.trim().length < 10) return false;

    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });
        return true;
    } catch {
        return false;
    }
}
