// ============================================
// PPT Translator - Type Definitions
// ============================================

// ============================================
// Token Management Types
// ============================================

export interface TokenEstimate {
    estimatedTokens: number;
    estimatedCost: number;
    withinLimits: boolean;
    suggestedPageLimit?: number;
}

export interface PageLimitSuggestion {
    recommendedPages: number[];
    reason: string;
    estimatedTokens: number;
}

// ============================================
// Quality Verification Types
// ============================================

export interface QualityResult {
    overallScore: number;
    criteria: QualityCriteria;
    issues: QualityIssue[];
    passed: boolean;
}

export interface QualityCriteria {
    documentTypeAppropriate: boolean;
    terminologyConsistent: boolean;
    formattingPreserved: boolean;
    numbersPreserved: boolean;
    properNounsUntranslated: boolean;
    englishConsistent: boolean;
    safetyGuideCompliant: boolean;
    tableFormatCorrect: boolean;
    questionNumberingPreserved: boolean;
    bulletPointsConsistent: boolean;
    capitalizationConsistent: boolean;
}

export type QualityIssueType =
    | 'document_type'
    | 'terminology'
    | 'formatting'
    | 'numbers'
    | 'proper_nouns'
    | 'english_consistency'
    | 'safety_guide'
    | 'table_format'
    | 'question_numbering'
    | 'bullet_points'
    | 'capitalization';

export interface QualityIssue {
    type: QualityIssueType;
    description: string;
    location: string;
    severity: 'low' | 'medium' | 'high';
    suggestion?: string;
    index?: number;
}

export interface ImprovementSuggestion {
    issueId: string;
    original: string;
    suggested: string;
    reason: string;
}

// ============================================
// Translation Types
// ============================================

export enum DocumentType {
    REPORT = 'report',
    PRESENTATION = 'presentation',
    CAMPAIGN = 'campaign'
}

export interface TranslationResult {
    success: boolean;
    translatedFile?: Blob;
    qualityResult?: QualityResult;
    tokensUsed: number;
    error?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
    data?: T;
    error?: ApiError;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
