/**
 * Module 4: Quality Scorer
 * 비교 분석 결과를 바탕으로 품질 점수를 계산합니다.
 */

import type {
    ComparisonResult,
    ScoreResult,
    VisualScore,
    TranslationScore,
    Grade,
    GlossaryMatchResult,
    EvaluationOptions,
    DEFAULT_OPTIONS,
} from './types';

/**
 * 종합 점수를 계산합니다.
 */
export function calculateScore(
    comparison: ComparisonResult,
    glossaryResults: GlossaryMatchResult[],
    totalTextItems: number,
    options?: Partial<EvaluationOptions>
): ScoreResult {
    const visualScore = calculateVisualScore(comparison, totalTextItems);
    const translationScore = calculateTranslationScore(comparison, glossaryResults);

    const total = visualScore.total + translationScore.total;
    const grade = calculateGrade(total);

    return {
        total,
        grade,
        visual: visualScore,
        translation: translationScore,
    };
}

/**
 * 시각적 품질 점수를 계산합니다. (80점 만점)
 */
function calculateVisualScore(
    comparison: ComparisonResult,
    totalTextItems: number
): VisualScore {
    const fontSize = calculateFontSizeScore(comparison.visual.fontSizeChanges, totalTextItems);
    const layout = calculateLayoutScore(comparison.visual.layoutChanges);
    const table = calculateTableScore(comparison.visual.tableOverflows);
    const style = calculateStyleScore(comparison.visual.styleChanges, totalTextItems);
    const spacing = calculateSpacingScore(comparison.visual.spacingChanges, totalTextItems);
    const specialChar = calculateSpecialCharScore(comparison.visual.specialCharIssues, totalTextItems);
    const langAttribute = calculateLangAttributeScore(comparison.visual.langAttributeIssues, totalTextItems);

    return {
        total: fontSize + layout + table + style + spacing + specialChar + langAttribute,
        fontSize,
        layout,
        table,
        style,
        spacing,
        specialChar,
        langAttribute,
    };
}

/**
 * 번역 품질 점수를 계산합니다. (20점 만점)
 */
function calculateTranslationScore(
    comparison: ComparisonResult,
    glossaryResults: GlossaryMatchResult[]
): TranslationScore {
    const glossaryCompliance = calculateGlossaryScore(glossaryResults);
    const consistency = calculateConsistencyScore(comparison.translation.termInconsistencies);
    const casing = calculateCasingScore(comparison.translation.caseViolations);
    const numbers = 2; // 기본 만점 (숫자/단위 보존은 별도 분석 필요)
    const romanNumerals = calculateRomanNumeralScore(comparison.translation.romanNumeralIssues);

    return {
        total: glossaryCompliance + consistency + casing + numbers + romanNumerals,
        glossaryCompliance,
        consistency,
        casing,
        numbers,
        romanNumerals,
    };
}

/**
 * 폰트 크기 점수 계산 (20점 만점)
 * 의도적 85% 축소는 허용
 */
function calculateFontSizeScore(
    changes: ComparisonResult['visual']['fontSizeChanges'],
    totalTextItems: number
): number {
    if (changes.length === 0) return 20;

    // 비의도적 변경의 비율에 따라 감점
    const unintentionalChanges = changes.filter(c => !c.isIntentional);
    const errorRate = unintentionalChanges.length / Math.max(totalTextItems, 1);

    // 오류율 10% 이상이면 0점
    const score = Math.max(0, 20 - Math.floor(errorRate * 200));
    return score;
}

/**
 * 레이아웃 점수 계산 (20점 만점)
 */
function calculateLayoutScore(
    changes: ComparisonResult['visual']['layoutChanges']
): number {
    let score = 20;

    for (const change of changes) {
        switch (change.type) {
            case 'normAutofit_added':
                score -= 3;
                break;
            case 'position_changed':
                score -= 2;
                break;
            case 'size_changed':
                score -= 1;
                break;
        }
    }

    return Math.max(0, score);
}

/**
 * 테이블 점수 계산 (15점 만점)
 */
function calculateTableScore(
    overflows: ComparisonResult['visual']['tableOverflows']
): number {
    // 오버플로우 셀 개수에 따라 감점
    const deduction = overflows.length * 3;
    return Math.max(0, 15 - deduction);
}

/**
 * 스타일 점수 계산 (10점 만점)
 */
function calculateStyleScore(
    changes: ComparisonResult['visual']['styleChanges'],
    totalTextItems: number
): number {
    if (changes.length === 0) return 10;

    // 스타일 변경 비율에 따라 감점
    const changeRate = changes.length / Math.max(totalTextItems, 1);
    const score = Math.max(0, 10 - Math.floor(changeRate * 100));
    return score;
}

/**
 * 텍스트 간격 점수 계산 (5점 만점)
 */
function calculateSpacingScore(
    changes: ComparisonResult['visual']['spacingChanges'],
    totalTextItems: number
): number {
    const unintentionalChanges = changes.filter(c => !c.isIntentional);
    if (unintentionalChanges.length === 0) return 5;

    // 비의도적 변경 비율에 따라 감점
    const changeRate = unintentionalChanges.length / Math.max(totalTextItems, 1);
    return Math.max(0, 5 - Math.floor(changeRate * 50));
}

/**
 * 특수문자 점수 계산 (5점 만점)
 */
function calculateSpecialCharScore(
    issues: ComparisonResult['visual']['specialCharIssues'],
    totalTextItems: number
): number {
    if (issues.length === 0) return 5;

    // 누락된 특수문자 개수에 따라 감점
    const totalMissing = issues.reduce((sum, issue) => sum + issue.missingChars.length, 0);
    return Math.max(0, 5 - totalMissing);
}

/**
 * 언어 속성 점수 계산 (5점 만점)
 */
function calculateLangAttributeScore(
    issues: ComparisonResult['visual']['langAttributeIssues'],
    totalTextItems: number
): number {
    if (issues.length === 0) return 5;

    // 미적용 비율에 따라 감점
    const issueRate = issues.length / Math.max(totalTextItems, 1);
    return Math.max(0, 5 - Math.floor(issueRate * 50));
}

/**
 * 단어장 준수율 점수 계산 (8점 만점)
 */
function calculateGlossaryScore(results: GlossaryMatchResult[]): number {
    if (results.length === 0) return 8; // 단어장이 없으면 만점

    const matchedCount = results.filter(r => r.isMatch).length;
    const complianceRate = matchedCount / results.length;

    return Math.round(complianceRate * 8);
}

/**
 * 용어 일관성 점수 계산 (5점 만점)
 */
function calculateConsistencyScore(
    inconsistencies: ComparisonResult['translation']['termInconsistencies']
): number {
    // 불일치 항목당 1점씩 감점
    return Math.max(0, 5 - inconsistencies.length);
}

/**
 * 대소문자 규칙 점수 계산 (3점 만점)
 */
function calculateCasingScore(
    violations: ComparisonResult['translation']['caseViolations']
): number {
    return Math.max(0, 3 - violations.length);
}

/**
 * 로마자 변환 점수 계산 (2점 만점)
 */
function calculateRomanNumeralScore(
    issues: ComparisonResult['translation']['romanNumeralIssues']
): number {
    return issues.length === 0 ? 2 : Math.max(0, 2 - issues.length);
}

/**
 * 점수에 따른 등급 계산
 */
function calculateGrade(total: number): Grade {
    if (total >= 95) return 'A+';
    if (total >= 90) return 'A';
    if (total >= 85) return 'B+';
    if (total >= 80) return 'B';
    if (total >= 75) return 'C+';
    if (total >= 70) return 'C';
    if (total >= 60) return 'D';
    return 'F';
}

/**
 * 점수 요약 문자열을 생성합니다.
 */
export function getScoreSummary(score: ScoreResult): string {
    return `${score.total}/100 (${score.grade}) - 시각적: ${score.visual.total}/80, 번역: ${score.translation.total}/20`;
}

/**
 * 점수 상세 내역을 생성합니다.
 */
export function getScoreBreakdown(score: ScoreResult): {
    category: string;
    item: string;
    score: number;
    maxScore: number;
    percentage: number;
}[] {
    return [
        { category: '시각적', item: '폰트 크기', score: score.visual.fontSize, maxScore: 20, percentage: (score.visual.fontSize / 20) * 100 },
        { category: '시각적', item: '레이아웃', score: score.visual.layout, maxScore: 20, percentage: (score.visual.layout / 20) * 100 },
        { category: '시각적', item: '테이블', score: score.visual.table, maxScore: 15, percentage: (score.visual.table / 15) * 100 },
        { category: '시각적', item: '스타일', score: score.visual.style, maxScore: 10, percentage: (score.visual.style / 10) * 100 },
        { category: '시각적', item: '텍스트 간격', score: score.visual.spacing, maxScore: 5, percentage: (score.visual.spacing / 5) * 100 },
        { category: '시각적', item: '특수문자', score: score.visual.specialChar, maxScore: 5, percentage: (score.visual.specialChar / 5) * 100 },
        { category: '시각적', item: '언어 속성', score: score.visual.langAttribute, maxScore: 5, percentage: (score.visual.langAttribute / 5) * 100 },
        { category: '번역', item: '단어장 준수', score: score.translation.glossaryCompliance, maxScore: 8, percentage: (score.translation.glossaryCompliance / 8) * 100 },
        { category: '번역', item: '용어 일관성', score: score.translation.consistency, maxScore: 5, percentage: (score.translation.consistency / 5) * 100 },
        { category: '번역', item: '대소문자', score: score.translation.casing, maxScore: 3, percentage: (score.translation.casing / 3) * 100 },
        { category: '번역', item: '숫자/단위', score: score.translation.numbers, maxScore: 2, percentage: (score.translation.numbers / 2) * 100 },
        { category: '번역', item: '로마자 변환', score: score.translation.romanNumerals, maxScore: 2, percentage: (score.translation.romanNumerals / 2) * 100 },
    ];
}
