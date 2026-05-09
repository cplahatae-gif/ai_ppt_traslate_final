/**
 * Main Evaluator
 * 모든 모듈을 통합하여 평가를 수행합니다.
 */

import type {
    EvaluationInput,
    EvaluationOutput,
    EvaluationOptions,
    DEFAULT_OPTIONS,
    GlossaryEntry,
} from './types';
import { parsePPTX } from './pptxParser';
import { loadGlossaryFromFile, matchGlossaryTerms, getGlossaryStats } from './glossaryParser';
import { analyzeComparison } from './comparisonAnalyzer';
import { calculateScore } from './qualityScorer';
import { generateReport, generateMarkdownReport, exportAsJSON } from './reportGenerator';

/**
 * 번역 품질 평가를 수행합니다.
 * 
 * @param input 평가 입력 (파일들과 옵션)
 * @param onProgress 진행률 콜백
 * @returns 평가 결과
 */
export async function evaluateTranslation(
    input: EvaluationInput,
    onProgress?: (step: string, progress: number) => void
): Promise<EvaluationOutput> {
    const startTime = Date.now();

    // 1. 파일 파싱
    onProgress?.('한글 PPTX 파싱 중...', 10);
    const koreanPPTX = await parsePPTX(input.koreanFile);

    onProgress?.('영어 PPTX 파싱 중...', 25);
    const englishPPTX = await parsePPTX(input.translatedFile);

    // 2. 단어장 로드 (선택)
    let glossary: GlossaryEntry[] = [];
    let glossaryStats = { totalEntries: 0 };

    if (input.glossaryFile && input.options.enableGlossaryCheck) {
        onProgress?.('단어장 로드 중...', 35);
        glossary = await loadGlossaryFromFile(input.glossaryFile);
        glossaryStats = getGlossaryStats(glossary);
    }

    // 3. 비교 분석
    onProgress?.('비교 분석 중...', 50);
    const comparison = await analyzeComparison(
        koreanPPTX,
        englishPPTX,
        input.koreanFile,
        input.translatedFile,
        glossary.length > 0 ? glossary : undefined,
        {
            // 과도한 축소 기준: 50% 이하로 줄어들면 문제
            minAllowedFontRatio: 0.50,
            // 과도한 확대 기준: 120% 이상으로 커지면 문제
            maxAllowedFontRatio: 1.20,
        }
    );

    // 4. 단어장 매칭
    onProgress?.('단어장 매칭 중...', 65);
    const glossaryResults = glossary.length > 0
        ? matchGlossaryTerms(koreanPPTX.allTextItems, englishPPTX.allTextItems, glossary)
        : [];

    // 5. 점수 계산
    onProgress?.('점수 계산 중...', 80);
    const score = calculateScore(
        comparison,
        glossaryResults,
        koreanPPTX.allTextItems.length,
        input.options
    );

    // 6. 리포트 생성
    onProgress?.('리포트 생성 중...', 90);
    const metadata = {
        evaluatedAt: new Date().toISOString(),
        koreanFileName: input.koreanFile.name,
        translatedFileName: input.translatedFile.name,
        referenceFileName: input.referenceFile?.name,
        glossaryTermCount: glossaryStats.totalEntries,
        slideCount: koreanPPTX.slideCount,
        totalTextItems: koreanPPTX.allTextItems.length,
    };

    const report = generateReport(
        score,
        comparison,
        glossaryResults,
        metadata
    );

    onProgress?.('완료!', 100);

    const endTime = Date.now();
    console.log(`평가 완료: ${(endTime - startTime) / 1000}초`);

    return {
        score,
        report,
        comparison,
        glossaryResults,
        issues: report.issues,
        metadata,
    };
}

/**
 * 기본 옵션을 가져옵니다.
 */
export function getDefaultOptions(): EvaluationOptions {
    return {
        enableVisualScore: true,
        enableTranslationScore: true,
        enableGlossaryCheck: true,
        enableReferenceComparison: false,
        fontSizeTolerancePercent: 2,
        expectedFontSizeRatio: 0.85,
    };
}

// 모듈 재내보내기
export { parsePPTX } from './pptxParser';
export { loadGlossaryFromFile, parseGlossaryFile, getGlossaryStats } from './glossaryParser';
export { analyzeComparison } from './comparisonAnalyzer';
export { calculateScore, getScoreSummary, getScoreBreakdown } from './qualityScorer';
export { generateReport, generateMarkdownReport, exportAsJSON, generateRetranslationInstructions } from './reportGenerator';
export { evaluateWithAI, validateApiKey } from './geminiService';
export type { AIEvaluationResult, AIIssue, TextPairForEvaluation } from './geminiService';
export * from './types';

