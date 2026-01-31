/**
 * Module 3: Comparison Analyzer
 * 원본과 번역본을 비교 분석하여 차이점을 감지합니다.
 */

import type {
    ParsedPPTX,
    TextItem,
    ComparisonResult,
    FontSizeChange,
    LayoutChange,
    SpacingChange,
    StyleChange,
    LangAttributeIssue,
    SpecialCharIssue,
    TableOverflow,
    TermInconsistency,
    CaseViolation,
    RomanNumeralIssue,
    GlossaryMatchResult,
    GlossaryEntry,
    // 새로 추가된 타입들
    PartialStyleIssue,
    ColorDistributionIssue,
    TextOverflowIssue,
    WordBreakIssue,
} from './types';
import { extractBodyProperties, createTextMapping } from './pptxParser';
import { matchGlossaryTerms } from './glossaryParser';

// 특수 문자 목록 (보존해야 할 문자들)
const SPECIAL_CHARS = ['㈜', '※', '□', '■', '●', '○', '◆', '◇', '★', '☆', '▲', '▼', '△', '▽', '→', '←', '↑', '↓'];

// 전각 로마자 → 반각 로마자 매핑
const ROMAN_NUMERAL_MAP: { [key: string]: string } = {
    'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 'Ⅴ': 'V',
    'Ⅵ': 'VI', 'Ⅶ': 'VII', 'Ⅷ': 'VIII', 'Ⅸ': 'IX', 'Ⅹ': 'X',
};

/**
 * 두 PPTX 파일을 비교 분석합니다.
 */
export async function analyzeComparison(
    koreanPPTX: ParsedPPTX,
    englishPPTX: ParsedPPTX,
    koreanFile: File,
    englishFile: File,
    glossary?: GlossaryEntry[],
    options?: { minAllowedFontRatio?: number; maxAllowedFontRatio?: number }
): Promise<ComparisonResult> {
    // 과도한 축소 기준: 50% 이하로 줄어들면 문제
    const minAllowedRatio = options?.minAllowedFontRatio ?? 0.50;
    // 과도한 확대 기준: 120% 이상으로 커지면 문제  
    const maxAllowedRatio = options?.maxAllowedFontRatio ?? 1.20;

    // 텍스트 매핑 생성
    const textMappings = createTextMapping(koreanPPTX, englishPPTX);

    // 시각적 분석 (기존)
    const fontSizeChanges = analyzeFontSizeChanges(textMappings, minAllowedRatio, maxAllowedRatio);
    const layoutChanges = await analyzeLayoutChanges(koreanFile, englishFile);
    const spacingChanges = analyzeSpacingChanges(textMappings);
    const styleChanges = analyzeStyleChanges(textMappings);
    const langAttributeIssues = analyzeLangAttributes(englishPPTX.allTextItems);
    const specialCharIssues = analyzeSpecialChars(textMappings);
    const tableOverflows = analyzeTableOverflows(englishPPTX);

    // 시각적 분석 (신규 추가)
    const partialStyleIssues = analyzePartialStyles(textMappings);
    const colorDistributionIssues = analyzeColorDistribution(textMappings);
    const textOverflowIssues = analyzeTextOverflow(textMappings);

    // 번역 분석 (기존)
    const glossaryMismatches = glossary
        ? matchGlossaryTerms(koreanPPTX.allTextItems, englishPPTX.allTextItems, glossary)
        : [];
    const termInconsistencies = analyzeTermConsistency(textMappings);
    const caseViolations = analyzeCaseRules(englishPPTX.allTextItems);
    const romanNumeralIssues = analyzeRomanNumerals(textMappings);

    // 번역 분석 (신규 추가)
    const wordBreakIssues = analyzeWordBreaks(textMappings);

    return {
        visual: {
            fontSizeChanges,
            layoutChanges,
            spacingChanges,
            styleChanges,
            langAttributeIssues,
            specialCharIssues,
            tableOverflows,
            // 신규 추가
            partialStyleIssues,
            colorDistributionIssues,
            textOverflowIssues,
        },
        translation: {
            glossaryMismatches: glossaryMismatches.filter(m => !m.isMatch),
            termInconsistencies,
            caseViolations,
            romanNumeralIssues,
            // 신규 추가
            wordBreakIssues,
        },
    };
}

/**
 * 폰트 크기 변경을 분석합니다.
 * 어느 정도 축소는 허용하고, 과도한 축소(50% 이하) 또는 확대(120% 이상)만 문제로 감지합니다.
 */
function analyzeFontSizeChanges(
    mappings: { korean: TextItem; english: TextItem }[],
    minAllowedRatio: number,
    maxAllowedRatio: number
): FontSizeChange[] {
    const changes: FontSizeChange[] = [];

    for (const { korean, english } of mappings) {
        const koreanRuns = korean.runs;
        const englishRuns = english.runs;

        for (let i = 0; i < Math.min(koreanRuns.length, englishRuns.length); i++) {
            const originalSize = koreanRuns[i]?.properties.fontSize;
            const translatedSize = englishRuns[i]?.properties.fontSize;

            if (originalSize && translatedSize) {
                const ratio = translatedSize / originalSize;

                // 과도한 축소 (50% 이하) 또는 과도한 확대 (120% 이상)만 문제로 감지
                const isExcessiveReduction = ratio < minAllowedRatio;
                const isExcessiveEnlargement = ratio > maxAllowedRatio;

                if (isExcessiveReduction || isExcessiveEnlargement) {
                    changes.push({
                        slideNumber: korean.slideNumber,
                        paragraphIndex: korean.paragraphIndex,
                        original: originalSize,
                        translated: translatedSize,
                        ratio,
                        isIntentional: false,
                        // 어떤 텍스트인지 알 수 있도록 추가
                        originalText: korean.text.substring(0, 60),
                        translatedText: english.text.substring(0, 60),
                    } as FontSizeChange & { originalText: string; translatedText: string });
                }
            }
        }
    }

    return changes;
}

/**
 * 레이아웃 변경을 분석합니다 (normAutofit 등).
 */
async function analyzeLayoutChanges(
    koreanFile: File,
    englishFile: File
): Promise<LayoutChange[]> {
    const changes: LayoutChange[] = [];

    const koreanBodyProps = await extractBodyProperties(koreanFile);
    const englishBodyProps = await extractBodyProperties(englishFile);

    // 영어본에서 새로 추가된 normAutofit 감지
    for (const [key, englishProps] of englishBodyProps) {
        const koreanProps = koreanBodyProps.get(key);

        if (englishProps.hasNormAutofit && (!koreanProps || !koreanProps.hasNormAutofit)) {
            const slideMatch = key.match(/slide(\d+)\.xml/);
            const slideNumber = slideMatch ? parseInt(slideMatch[1]) : 0;

            changes.push({
                slideNumber,
                type: 'normAutofit_added',
                description: 'normAutofit이 번역 후 추가됨 (텍스트 자동 축소)',
            });
        }
    }

    return changes;
}

/**
 * 텍스트 간격 변경을 분석합니다.
 */
function analyzeSpacingChanges(
    mappings: { korean: TextItem; english: TextItem }[]
): SpacingChange[] {
    const changes: SpacingChange[] = [];

    for (const { korean, english } of mappings) {
        const koreanRuns = korean.runs;
        const englishRuns = english.runs;

        for (let i = 0; i < Math.min(koreanRuns.length, englishRuns.length); i++) {
            const originalSpacing = koreanRuns[i]?.properties.spacing;
            const translatedSpacing = englishRuns[i]?.properties.spacing;

            if (originalSpacing !== null && translatedSpacing !== null) {
                // 음수 → 0 변환은 의도적
                const isIntentional = originalSpacing < 0 && translatedSpacing === 0;

                if (originalSpacing !== translatedSpacing && !isIntentional) {
                    changes.push({
                        slideNumber: korean.slideNumber,
                        paragraphIndex: korean.paragraphIndex,
                        original: originalSpacing,
                        translated: translatedSpacing,
                        isIntentional: false,
                    });
                }
            }
        }
    }

    return changes;
}

/**
 * 스타일 변경을 분석합니다 (Bold, Italic, Color 등).
 */
function analyzeStyleChanges(
    mappings: { korean: TextItem; english: TextItem }[]
): StyleChange[] {
    const changes: StyleChange[] = [];

    for (const { korean, english } of mappings) {
        const koreanRuns = korean.runs;
        const englishRuns = english.runs;

        for (let i = 0; i < Math.min(koreanRuns.length, englishRuns.length); i++) {
            const kProps = koreanRuns[i]?.properties;
            const eProps = englishRuns[i]?.properties;

            if (!kProps || !eProps) continue;

            // Bold 변경 감지
            if (kProps.bold !== eProps.bold) {
                changes.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'bold',
                    original: kProps.bold ? 'bold' : 'normal',
                    translated: eProps.bold ? 'bold' : 'normal',
                });
            }

            // Italic 변경 감지
            if (kProps.italic !== eProps.italic) {
                changes.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'italic',
                    original: kProps.italic ? 'italic' : 'normal',
                    translated: eProps.italic ? 'italic' : 'normal',
                });
            }

            // Color 변경 감지
            if (kProps.color !== eProps.color) {
                changes.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'color',
                    original: kProps.color || 'default',
                    translated: eProps.color || 'default',
                });
            }
        }
    }

    return changes;
}

/**
 * 언어 속성(lang) 적용 여부를 분석합니다.
 */
function analyzeLangAttributes(englishTexts: TextItem[]): LangAttributeIssue[] {
    const issues: LangAttributeIssue[] = [];

    for (const item of englishTexts) {
        for (const run of item.runs) {
            const lang = run.properties.lang;

            // 영어 번역본에서 lang이 en-US가 아닌 경우
            if (lang !== 'en-US') {
                issues.push({
                    slideNumber: item.slideNumber,
                    paragraphIndex: item.paragraphIndex,
                    expected: 'en-US',
                    actual: lang,
                });
                break; // 문단당 한 번만 기록
            }
        }
    }

    return issues;
}

/**
 * 특수 문자 보존 여부를 분석합니다.
 * 어디서 어떤 특수문자가 빠졌는지 정확히 알 수 있도록 원본 텍스트도 함께 반환합니다.
 */
function analyzeSpecialChars(
    mappings: { korean: TextItem; english: TextItem }[]
): SpecialCharIssue[] {
    const issues: SpecialCharIssue[] = [];

    for (const { korean, english } of mappings) {
        const missingChars: string[] = [];

        for (const char of SPECIAL_CHARS) {
            if (korean.text.includes(char) && !english.text.includes(char)) {
                missingChars.push(char);
            }
        }

        if (missingChars.length > 0) {
            issues.push({
                slideNumber: korean.slideNumber,
                paragraphIndex: korean.paragraphIndex,
                missingChars,
                // 정확한 위치 파악을 위해 원본/번역 텍스트 추가
                originalText: korean.text.substring(0, 80),
                translatedText: english.text.substring(0, 80),
            } as SpecialCharIssue & { originalText: string; translatedText: string });
        }
    }

    return issues;
}

/**
 * 테이블 오버플로우를 분석합니다.
 */
function analyzeTableOverflows(englishPPTX: ParsedPPTX): TableOverflow[] {
    const overflows: TableOverflow[] = [];

    for (const slide of englishPPTX.slides) {
        if (!slide.tableData) continue;

        for (const table of slide.tableData) {
            table.rows.forEach((row, rowIndex) => {
                row.cells.forEach((cell, cellIndex) => {
                    // 셀 텍스트가 너무 길면 오버플로우 가능성
                    // 경험적으로 영어는 한글보다 30% 정도 더 긺
                    const estimatedWidth = cell.text.length * 100; // 대략적 추정

                    if (cell.width > 0 && estimatedWidth > cell.width * 1.5) {
                        overflows.push({
                            slideNumber: slide.slideNumber,
                            rowIndex,
                            cellIndex,
                            text: cell.text.substring(0, 50) + (cell.text.length > 50 ? '...' : ''),
                        });
                    }
                });
            });
        }
    }

    return overflows;
}

/**
 * 용어 일관성을 분석합니다.
 * 동일한 한글 원문이 다르게 번역된 경우를 감지합니다.
 */
function analyzeTermConsistency(
    mappings: { korean: TextItem; english: TextItem }[]
): TermInconsistency[] {
    const termMap = new Map<string, Map<string, { slideNumber: number; count: number }>>();

    for (const { korean, english } of mappings) {
        const koreanText = korean.text.trim();
        const englishText = english.text.trim();

        if (koreanText.length < 2 || englishText.length < 2) continue;

        if (!termMap.has(koreanText)) {
            termMap.set(koreanText, new Map());
        }

        const translations = termMap.get(koreanText)!;
        if (translations.has(englishText)) {
            translations.get(englishText)!.count++;
        } else {
            translations.set(englishText, { slideNumber: korean.slideNumber, count: 1 });
        }
    }

    // 2개 이상의 다른 번역이 있는 경우만 불일치로 간주
    const inconsistencies: TermInconsistency[] = [];

    for (const [korean, translations] of termMap) {
        if (translations.size > 1) {
            const translationList = Array.from(translations.entries()).map(([english, data]) => ({
                english,
                slideNumber: data.slideNumber,
                count: data.count,
            }));

            inconsistencies.push({
                korean,
                translations: translationList,
            });
        }
    }

    return inconsistencies;
}

/**
 * 대소문자 규칙 준수 여부를 분석합니다.
 * - 제목: Title Case
 * - 본문: Sentence case
 */
function analyzeCaseRules(englishTexts: TextItem[]): CaseViolation[] {
    const violations: CaseViolation[] = [];

    for (const item of englishTexts) {
        const text = item.text.trim();
        if (text.length < 3) continue;

        // 전체 대문자인 경우 (제목이 아닌 긴 텍스트)
        if (text === text.toUpperCase() && text.length > 20 && /[A-Z]/.test(text)) {
            violations.push({
                slideNumber: item.slideNumber,
                paragraphIndex: item.paragraphIndex,
                text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                expectedCase: 'sentence',
                description: '전체 대문자 사용 - Sentence case 권장',
            });
        }

        // 짧은 제목인데 소문자로 시작하는 경우
        if (text.length < 30 && text[0] === text[0].toLowerCase() && /^[a-z]/.test(text)) {
            // 불릿 포인트는 소문자 시작이 맞음 (가이드라인에 따르면)
            // 여기서는 명확한 위반만 기록
        }
    }

    return violations;
}

/**
 * 로마자 변환을 분석합니다.
 * 전각 로마자(Ⅰ, Ⅱ, ...)가 반각(I, II, ...)으로 변환되었는지 확인
 */
function analyzeRomanNumerals(
    mappings: { korean: TextItem; english: TextItem }[]
): RomanNumeralIssue[] {
    const issues: RomanNumeralIssue[] = [];

    for (const { korean, english } of mappings) {
        for (const [fullWidth, halfWidth] of Object.entries(ROMAN_NUMERAL_MAP)) {
            if (korean.text.includes(fullWidth)) {
                // 영어본에서 반각으로 변환되어야 함
                if (english.text.includes(fullWidth)) {
                    // 변환되지 않음
                    issues.push({
                        slideNumber: korean.slideNumber,
                        paragraphIndex: korean.paragraphIndex,
                        original: fullWidth,
                        expected: halfWidth,
                        actual: fullWidth,
                    });
                }
            }
        }
    }

    return issues;
}

// ========================================
// 신규 추가된 분석 함수들
// ========================================

/**
 * 부분 스타일 문제를 분석합니다.
 * 원본에서 일부만 볼드/색상이었는데 번역본에서 전체가 적용된 경우를 감지합니다.
 * 
 * 사용자 언급 문제:
 * 1. 일부 글자만 볼드체가 되야하는데 전부다 볼드가 되는 경우
 * 2. 문장에서 일부만 빨간색인데 전부 빨간색으로 표기되는 경우
 */
function analyzePartialStyles(
    mappings: { korean: TextItem; english: TextItem }[]
): PartialStyleIssue[] {
    const issues: PartialStyleIssue[] = [];

    for (const { korean, english } of mappings) {
        const koreanRuns = korean.runs;
        const englishRuns = english.runs;

        // Run이 2개 이상 있어야 부분 스타일이 의미가 있음
        if (koreanRuns.length < 2) continue;

        // 1. 부분 볼드 분석
        const koreanBoldCount = koreanRuns.filter(r => r.properties.bold).length;
        const englishBoldCount = englishRuns.filter(r => r.properties.bold).length;

        // 원본에서 일부만 볼드인데 번역본에서 전부 볼드인 경우
        if (koreanBoldCount > 0 && koreanBoldCount < koreanRuns.length) {
            if (englishBoldCount === englishRuns.length && englishRuns.length > 0) {
                issues.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'partial_bold',
                    originalText: korean.text.substring(0, 80),
                    translatedText: english.text.substring(0, 80),
                    originalStyleDistribution: {
                        styled: koreanBoldCount,
                        total: koreanRuns.length,
                    },
                    translatedStyleDistribution: {
                        styled: englishBoldCount,
                        total: englishRuns.length,
                    },
                    description: `원본: ${koreanBoldCount}/${koreanRuns.length} 볼드 → 번역본: 전체 볼드`,
                });
            }
        }

        // 2. 부분 색상 분석 (색상이 있는 Run 분석)
        const koreanColoredRuns = koreanRuns.filter(r => r.properties.color);
        const englishColoredRuns = englishRuns.filter(r => r.properties.color);

        // 원본에서 일부만 색상이 있는데 번역본에서 전부 같은 색상인 경우
        if (koreanColoredRuns.length > 0 && koreanColoredRuns.length < koreanRuns.length) {
            if (englishColoredRuns.length === englishRuns.length && englishRuns.length > 0) {
                issues.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'partial_color',
                    originalText: korean.text.substring(0, 80),
                    translatedText: english.text.substring(0, 80),
                    originalStyleDistribution: {
                        styled: koreanColoredRuns.length,
                        total: koreanRuns.length,
                    },
                    translatedStyleDistribution: {
                        styled: englishColoredRuns.length,
                        total: englishRuns.length,
                    },
                    description: `원본: ${koreanColoredRuns.length}/${koreanRuns.length} 색상 → 번역본: 전체 색상`,
                });
            }
        }

        // 3. 부분 이탤릭 분석
        const koreanItalicCount = koreanRuns.filter(r => r.properties.italic).length;
        const englishItalicCount = englishRuns.filter(r => r.properties.italic).length;

        if (koreanItalicCount > 0 && koreanItalicCount < koreanRuns.length) {
            if (englishItalicCount === englishRuns.length && englishRuns.length > 0) {
                issues.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    type: 'partial_italic',
                    originalText: korean.text.substring(0, 80),
                    translatedText: english.text.substring(0, 80),
                    originalStyleDistribution: {
                        styled: koreanItalicCount,
                        total: koreanRuns.length,
                    },
                    translatedStyleDistribution: {
                        styled: englishItalicCount,
                        total: englishRuns.length,
                    },
                    description: `원본: ${koreanItalicCount}/${koreanRuns.length} 이탤릭 → 번역본: 전체 이탤릭`,
                });
            }
        }
    }

    return issues;
}

/**
 * 색상 분포 문제를 분석합니다.
 * 원본에 여러 색상이 사용되었는데 번역본에서 단일 색상으로 변경된 경우를 감지합니다.
 * 
 * 사용자 언급 문제:
 * - 페이지 5: issue 부분은 빨간색이고 맞은편은 파란색인데 번역본은 모두 빨간색
 */
function analyzeColorDistribution(
    mappings: { korean: TextItem; english: TextItem }[]
): ColorDistributionIssue[] {
    const issues: ColorDistributionIssue[] = [];

    for (const { korean, english } of mappings) {
        // 원본의 모든 색상 추출 (null 제외, 중복 제거)
        const originalColors = [...new Set(
            korean.runs
                .map(r => r.properties.color)
                .filter((c): c is string => c !== null)
        )];

        // 번역본의 모든 색상 추출
        const translatedColors = [...new Set(
            english.runs
                .map(r => r.properties.color)
                .filter((c): c is string => c !== null)
        )];

        // 원본에 2개 이상의 색상이 있는데 번역본에서 1개로 줄어든 경우
        if (originalColors.length >= 2 && translatedColors.length === 1) {
            issues.push({
                slideNumber: korean.slideNumber,
                paragraphIndex: korean.paragraphIndex,
                originalColors,
                translatedColors,
                originalText: korean.text.substring(0, 80),
                translatedText: english.text.substring(0, 80),
                description: `원본: ${originalColors.length}개 색상 사용 (${originalColors.join(', ')}) → 번역본: 단일 색상 (${translatedColors[0]})`,
            });
        }

        // 원본의 색상 개수와 번역본의 색상 개수가 다른 경우 (더 일반적인 케이스)
        if (originalColors.length > 0 && translatedColors.length > 0 &&
            originalColors.length !== translatedColors.length) {
            // 이미 위에서 2→1 케이스를 처리했으므로 그 외의 경우만
            if (!(originalColors.length >= 2 && translatedColors.length === 1)) {
                issues.push({
                    slideNumber: korean.slideNumber,
                    paragraphIndex: korean.paragraphIndex,
                    originalColors,
                    translatedColors,
                    originalText: korean.text.substring(0, 80),
                    translatedText: english.text.substring(0, 80),
                    description: `색상 개수 불일치: 원본 ${originalColors.length}개 → 번역본 ${translatedColors.length}개`,
                });
            }
        }
    }

    return issues;
}

/**
 * 텍스트 오버플로우 가능성을 분석합니다.
 * 번역 후 텍스트가 너무 길어져서 레이아웃이 깨질 가능성이 있는 경우를 감지합니다.
 * 
 * 사용자 언급 문제:
 * - 글자가 너무 커서 레이아웃이 깨지는 경우
 */
function analyzeTextOverflow(
    mappings: { korean: TextItem; english: TextItem }[]
): TextOverflowIssue[] {
    const issues: TextOverflowIssue[] = [];

    for (const { korean, english } of mappings) {
        const originalLength = korean.text.length;
        const translatedLength = english.text.length;

        // 텍스트가 너무 짧으면 의미없음
        if (originalLength < 5) continue;

        const expansionRatio = translatedLength / originalLength;

        // 확장 비율에 따른 심각도 판별
        // 일반적으로 한글→영어 번역 시 1.5배 정도까지는 허용
        let severity: 'minor' | 'moderate' | 'severe' | null = null;

        if (expansionRatio > 3.0) {
            severity = 'severe';    // 3배 이상 확장: 심각
        } else if (expansionRatio > 2.0) {
            severity = 'moderate';  // 2배 이상 확장: 중간
        } else if (expansionRatio > 1.5) {
            severity = 'minor';     // 1.5배 이상 확장: 경미
        }

        if (severity) {
            issues.push({
                slideNumber: korean.slideNumber,
                paragraphIndex: korean.paragraphIndex,
                originalLength,
                translatedLength,
                expansionRatio,
                originalText: korean.text.substring(0, 60),
                translatedText: english.text.substring(0, 60),
                severity,
            });
        }
    }

    return issues;
}

/**
 * 단어 중간 줄바꿈 문제를 분석합니다.
 * 영어 번역에서 단어가 중간에 잘려서 줄바꿈된 경우를 감지합니다.
 * 
 * 사용자 언급 문제:
 * - "safety leadership guide"가 "safety leaders\nhip guide"로 잘리는 경우
 */
function analyzeWordBreaks(
    mappings: { korean: TextItem; english: TextItem }[]
): WordBreakIssue[] {
    const issues: WordBreakIssue[] = [];

    // 영어 단어가 줄바꿈으로 잘린 패턴을 감지
    // 예: "leaders\nhip" → "leadership"이 잘린 것
    const wordBreakPattern = /([a-zA-Z]+)\n([a-zA-Z]+)/g;

    for (const { korean, english } of mappings) {
        const text = english.text;
        let match;

        while ((match = wordBreakPattern.exec(text)) !== null) {
            const beforeBreak = match[1];
            const afterBreak = match[2];
            const possibleWord = beforeBreak + afterBreak;

            // 잠재적으로 잘린 단어가 3글자 이상이어야 의미있음
            if (possibleWord.length >= 4) {
                // 알려진 영어 단어 패턴인지 간단히 체크 (더 정교한 사전 검사도 가능)
                // 여기서는 기본적인 휴리스틱 사용
                issues.push({
                    slideNumber: english.slideNumber,
                    paragraphIndex: english.paragraphIndex,
                    brokenWord: possibleWord,
                    beforeBreak,
                    afterBreak,
                    suggestion: `"${possibleWord}"가 줄바꿈으로 잘렸을 수 있습니다. 단어 단위로 줄바꿈을 권장합니다.`,
                });
            }
        }
    }

    return issues;
}

