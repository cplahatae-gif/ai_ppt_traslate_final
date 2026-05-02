// ============================================
// Enhanced PPT Translator - Type Definitions
// ============================================

// ============================================
// User & Authentication Types (Requirement 2)
// ============================================

export interface User {
    id: string;
    email: string;
    name: string;
    isApproved: boolean;
    isAdmin: boolean;
    apiKey?: string;
    accessCount: number;
    createdAt: Date;
    lastLoginAt: Date;
}

export interface UserRegistrationData {
    email: string;
    name: string;
    password: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    error?: string;
    requiresApproval?: boolean;
}

// ============================================
// Token Management Types (Requirement 1)
// ============================================

export interface TokenEstimate {
    estimatedTokens: number;
    estimatedCost: number;
    withinLimits: boolean;
    suggestedPageLimit?: number;
}

export interface LimitStatus {
    dailyUsed: number;
    dailyLimit: number;
    minuteUsed: number;
    minuteLimit: number;
    canProceed: boolean;
}

export interface PageLimitSuggestion {
    recommendedPages: number[];
    reason: string;
    estimatedTokens: number;
}

// ============================================
// Quality Verification Types (Requirement 5)
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
// Translation Types (Requirement 8)
// ============================================

export enum DocumentType {
    REPORT = 'report',
    PRESENTATION = 'presentation',
    CAMPAIGN = 'campaign'
}

export interface TranslationOptions {
    pageRange?: [number, number];
    targetLanguage: string;
    documentType: DocumentType;
    userId: string;
    qualityCheck: boolean;
}

export interface TranslationResult {
    success: boolean;
    translatedFile?: Blob;
    qualityResult?: QualityResult;
    tokensUsed: number;
    error?: string;
}

export interface TranslationJob {
    id: string;
    userId: string;
    fileName: string;
    status: 'pending' | 'translating' | 'completed' | 'failed';
    downloadUrl?: string;
    qualityScore?: number;
    tokensUsed?: number;
    createdAt: Date;
    completedAt?: Date;
}

// ============================================
// Admin Types (Requirement 3)
// ============================================

export interface UserStats {
    userId: string;
    userName: string;
    email: string;
    accessCount: number;
    lastAccess: Date;
    totalTranslations: number;
    isActive: boolean;
}

export interface AccessLog {
    id: string;
    userId: string;
    timestamp: Date;
    action: string;
    details?: string;
    ipAddress?: string;
}

// ============================================
// Email Notification Types (Requirement 6)
// ============================================

export interface EmailNotification {
    to: string;
    subject: string;
    body: string;
    translationJobId?: string;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ============================================
// Local Storage Types
// ============================================

export interface LocalStorageData {
    apiKey?: string;
    userPreferences: UserPreferences;
    recentTranslations: RecentTranslation[];
}

export interface UserPreferences {
    theme: 'light' | 'dark';
    defaultLanguage: string;
    autoQualityCheck: boolean;
    emailNotifications: boolean;
}

export interface RecentTranslation {
    fileName: string;
    timestamp: Date;
    status: string;
    downloadUrl?: string;
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
