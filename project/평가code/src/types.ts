/**
 * PPTX 번역 품질 평가 시스템 - 타입 정의
 */

// ============================================
// 파싱 관련 타입
// ============================================

export interface TextItem {
    slidePath: string;
    slideNumber: number;
    paragraphIndex: number;
    text: string;
    runs: RunData[];
}

export interface RunData {
    text: string;
    properties: RunProperties;
}

export interface RunProperties {
    fontSize: number | null;      // sz (1/100 pt 단위)
    bold: boolean;                // b
    italic: boolean;              // i
    fontFamily: string | null;    // latin/ea typeface
    color: string | null;         // solidFill
    lang: string | null;          // lang 속성
    spacing: number | null;       // spc (텍스트 간격)
}

export interface ParsedSlide {
    slideNumber: number;
    slidePath: string;
    textItems: TextItem[];
    hasTable: boolean;
    tableData?: TableData[];
}

export interface TableData {
    slideNumber: number;
    rows: TableRow[];
}

export interface TableRow {
    cells: TableCell[];
}

export interface TableCell {
    text: string;
    width: number;
    height: number;
}

export interface ParsedPPTX {
    fileName: string;
    slideCount: number;
    slides: ParsedSlide[];
    allTextItems: TextItem[];
}

// ============================================
// 단어장 관련 타입
// ============================================

export interface GlossaryEntry {
    korean: string;
    english: string[];  // 여러 영어 표현 가능
    category?: string;
}

export interface GlossaryMatchResult {
    korean: string;
    expectedEnglish: string[];
    actualEnglish: string;
    isMatch: boolean;
    slideNumber: number;
    position: string;
}

// ============================================
// 분석 관련 타입
// ============================================

export interface FontSizeChange {
    slideNumber: number;
    paragraphIndex: number;
    original: number;
    translated: number;
    ratio: number;
    isIntentional: boolean;  // 0.85 비율은 의도적
}

export interface LayoutChange {
    slideNumber: number;
    type: 'normAutofit_added' | 'position_changed' | 'size_changed';
    description: string;
}

export interface SpacingChange {
    slideNumber: number;
    paragraphIndex: number;
    original: number;
    translated: number;
    isIntentional: boolean;  // 음수→0 변환은 의도적
}

export interface StyleChange {
    slideNumber: number;
    paragraphIndex: number;
    type: 'bold' | 'italic' | 'color' | 'fontFamily';
    original: string;
    translated: string;
}

export interface LangAttributeIssue {
    slideNumber: number;
    paragraphIndex: number;
    expected: string;
    actual: string | null;
}

export interface TermInconsistency {
    korean: string;
    translations: { english: string; slideNumber: number; count: number }[];
}

export interface CaseViolation {
    slideNumber: number;
    paragraphIndex: number;
    text: string;
    expectedCase: 'title' | 'sentence';
    description: string;
}

export interface RomanNumeralIssue {
    slideNumber: number;
    paragraphIndex: number;
    original: string;
    expected: string;
    actual: string;
}

export interface SpecialCharIssue {
    slideNumber: number;
    paragraphIndex: number;
    missingChars: string[];
}

/**
 * 부분 스타일 문제 - 일부만 볼드/색상이어야 하는데 전체가 적용된 경우
 */
export interface PartialStyleIssue {
    slideNumber: number;
    paragraphIndex: number;
    type: 'partial_bold' | 'partial_color' | 'partial_italic';
    originalText: string;
    translatedText: string;
    originalStyleDistribution: {
        styled: number;  // 스타일이 적용된 Run 개수
        total: number;   // 전체 Run 개수
    };
    translatedStyleDistribution: {
        styled: number;
        total: number;
    };
    description: string;
}

/**
 * 단어 중간 줄바꿈 문제 - 단어가 중간에 잘려서 줄바꿈된 경우
 */
export interface WordBreakIssue {
    slideNumber: number;
    paragraphIndex: number;
    brokenWord: string;       // 잘린 단어 (예: "leadership")
    beforeBreak: string;      // 줄바꿈 전 부분 (예: "leaders")
    afterBreak: string;       // 줄바꿈 후 부분 (예: "hip guide")
    suggestion: string;       // 권장 줄바꿈 위치
}

/**
 * 색상 분포 문제 - 원본의 다중 색상이 번역본에서 단일 색상으로 변경된 경우
 */
export interface ColorDistributionIssue {
    slideNumber: number;
    paragraphIndex: number;
    originalColors: string[];    // 원본에서 사용된 색상들
    translatedColors: string[];  // 번역본에서 사용된 색상들
    originalText: string;
    translatedText: string;
    description: string;
}

/**
 * 텍스트 오버플로우 문제 - 글자가 너무 길어서 텍스트 박스를 벗어나는 경우
 */
export interface TextOverflowIssue {
    slideNumber: number;
    paragraphIndex: number;
    originalLength: number;     // 원본 텍스트 길이
    translatedLength: number;   // 번역 텍스트 길이
    expansionRatio: number;     // 확장 비율 (번역/원본)
    originalText: string;
    translatedText: string;
    severity: 'minor' | 'moderate' | 'severe';
}

export interface TableOverflow {
    slideNumber: number;
    rowIndex: number;
    cellIndex: number;
    text: string;
}

export interface ComparisonResult {
    visual: {
        fontSizeChanges: FontSizeChange[];
        layoutChanges: LayoutChange[];
        spacingChanges: SpacingChange[];
        styleChanges: StyleChange[];
        langAttributeIssues: LangAttributeIssue[];
        specialCharIssues: SpecialCharIssue[];
        tableOverflows: TableOverflow[];
        // 새로 추가된 검증 항목들
        partialStyleIssues: PartialStyleIssue[];
        colorDistributionIssues: ColorDistributionIssue[];
        textOverflowIssues: TextOverflowIssue[];
    };
    translation: {
        glossaryMismatches: GlossaryMatchResult[];
        termInconsistencies: TermInconsistency[];
        caseViolations: CaseViolation[];
        romanNumeralIssues: RomanNumeralIssue[];
        // 새로 추가된 검증 항목
        wordBreakIssues: WordBreakIssue[];
    };
}

// ============================================
// 점수 관련 타입
// ============================================

export interface VisualScore {
    total: number;           // 0-80
    fontSize: number;        // 0-20
    layout: number;          // 0-20
    table: number;           // 0-15
    style: number;           // 0-10
    spacing: number;         // 0-5
    specialChar: number;     // 0-5
    langAttribute: number;   // 0-5
}

export interface TranslationScore {
    total: number;           // 0-20
    glossaryCompliance: number;  // 0-8
    consistency: number;     // 0-5
    casing: number;          // 0-3
    numbers: number;         // 0-2
    romanNumerals: number;   // 0-2
}

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

export interface ScoreResult {
    total: number;           // 0-100
    grade: Grade;
    visual: VisualScore;
    translation: TranslationScore;
}

// ============================================
// 이슈 및 리포트 타입
// ============================================

export type IssueSeverity = 'high' | 'medium' | 'low';
export type IssueCategory = 'visual' | 'translation' | 'glossary';

export interface Issue {
    id: string;
    severity: IssueSeverity;
    category: IssueCategory;
    subcategory: string;
    slideNumber: number;
    location: string;
    description: string;
    suggestion?: string;
}

export interface ReportData {
    summary: string;
    visualDetails: {
        item: string;
        score: number;
        maxScore: number;
        status: 'pass' | 'warning' | 'fail';
        description: string;
    }[];
    translationDetails: {
        item: string;
        score: number;
        maxScore: number;
        status: 'pass' | 'warning' | 'fail';
        description: string;
    }[];
    glossaryMismatches: GlossaryMatchResult[];
    issues: Issue[];
}

// ============================================
// 입출력 타입
// ============================================

export interface EvaluationOptions {
    enableVisualScore: boolean;
    enableTranslationScore: boolean;
    enableGlossaryCheck: boolean;
    enableReferenceComparison: boolean;
    fontSizeTolerancePercent: number;     // 기본값: 2%
    expectedFontSizeRatio: number;        // 기본값: 0.85
}

export interface EvaluationInput {
    koreanFile: File;
    translatedFile: File;
    referenceFile?: File;
    glossaryFile?: File;
    guidelineFile?: File;
    options: EvaluationOptions;
}

export interface EvaluationOutput {
    score: ScoreResult;
    report: ReportData;
    comparison: ComparisonResult;
    glossaryResults: GlossaryMatchResult[];
    issues: Issue[];
    metadata: {
        evaluatedAt: string;
        koreanFileName: string;
        translatedFileName: string;
        referenceFileName?: string;
        glossaryTermCount: number;
        slideCount: number;
        totalTextItems: number;
    };
}

// ============================================
// 기본값
// ============================================

export const DEFAULT_OPTIONS: EvaluationOptions = {
    enableVisualScore: true,
    enableTranslationScore: true,
    enableGlossaryCheck: true,
    enableReferenceComparison: false,
    fontSizeTolerancePercent: 2,
    expectedFontSizeRatio: 0.85,
};
