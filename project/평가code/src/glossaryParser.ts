/**
 * Module 2: Glossary Parser
 * 단어장 파일을 파싱하고 용어 매칭을 수행합니다.
 */

import type { GlossaryEntry, GlossaryMatchResult, TextItem } from './types';

/**
 * 단어장 파일(TXT)을 파싱합니다.
 * 형식: "한글 : 영어1, 영어2, 영어3"
 * 
 * @param content 단어장 파일 내용
 * @returns 파싱된 단어장 항목 배열
 */
export function parseGlossaryFile(content: string): GlossaryEntry[] {
    const entries: GlossaryEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // 빈 줄이나 주석 무시
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        // 콜론(:)으로 구분
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex === -1) continue;

        const korean = trimmedLine.substring(0, colonIndex).trim();
        const englishPart = trimmedLine.substring(colonIndex + 1).trim();

        if (!korean || !englishPart) continue;

        // 영어 부분은 콤마로 구분된 여러 표현 가능
        const english = englishPart.split(',').map(e => e.trim()).filter(e => e.length > 0);

        if (english.length > 0) {
            entries.push({
                korean,
                english,
            });
        }
    }

    return entries;
}

/**
 * File 객체에서 단어장을 로드합니다.
 */
export async function loadGlossaryFromFile(file: File): Promise<GlossaryEntry[]> {
    const content = await file.text();
    return parseGlossaryFile(content);
}

/**
 * 한글 텍스트에서 단어장 용어를 찾아 영어 번역과 매칭합니다.
 * 
 * @param koreanTexts 한글 원본 텍스트 항목들
 * @param englishTexts 영어 번역 텍스트 항목들
 * @param glossary 단어장
 * @returns 매칭 결과 배열
 */
export function matchGlossaryTerms(
    koreanTexts: TextItem[],
    englishTexts: TextItem[],
    glossary: GlossaryEntry[]
): GlossaryMatchResult[] {
    const results: GlossaryMatchResult[] = [];

    // 빠른 검색을 위해 단어장을 한글 기준으로 인덱싱
    // 긴 용어가 먼저 매칭되도록 정렬 (예: "안전담당자" → "안전" 보다 우선)
    const sortedGlossary = [...glossary].sort((a, b) => b.korean.length - a.korean.length);

    for (let i = 0; i < koreanTexts.length; i++) {
        const korean = koreanTexts[i];
        const english = englishTexts[i];

        if (!korean || !english) continue;

        const koreanText = korean.text;
        const englishText = english.text.toLowerCase();

        // 이 텍스트에서 이미 매칭된 용어 추적 (중복 방지)
        const matchedTerms = new Set<string>();

        for (const entry of sortedGlossary) {
            // 한글 원문에 해당 용어가 포함되어 있는지 확인
            if (!koreanText.includes(entry.korean)) continue;

            // 이미 매칭된 용어면 스킵
            if (matchedTerms.has(entry.korean)) continue;
            matchedTerms.add(entry.korean);

            // 영어 번역에 기대 표현 중 하나가 포함되어 있는지 확인
            const isMatch = entry.english.some(expectedEnglish =>
                englishText.includes(expectedEnglish.toLowerCase())
            );

            results.push({
                korean: entry.korean,
                expectedEnglish: entry.english,
                actualEnglish: english.text,
                isMatch,
                slideNumber: korean.slideNumber,
                position: `Paragraph ${korean.paragraphIndex + 1}`,
            });
        }
    }

    return results;
}

/**
 * 단어장 매칭 결과에서 미준수 항목만 필터링합니다.
 */
export function getGlossaryMismatches(results: GlossaryMatchResult[]): GlossaryMatchResult[] {
    return results.filter(r => !r.isMatch);
}

/**
 * 단어장 준수율을 계산합니다.
 */
export function calculateGlossaryComplianceRate(results: GlossaryMatchResult[]): number {
    if (results.length === 0) return 1;

    const matchedCount = results.filter(r => r.isMatch).length;
    return matchedCount / results.length;
}

/**
 * 단어장에서 특정 한글 용어의 영어 표현을 찾습니다.
 */
export function findEnglishTranslation(
    korean: string,
    glossary: GlossaryEntry[]
): string[] | null {
    const entry = glossary.find(e => e.korean === korean);
    return entry ? entry.english : null;
}

/**
 * 단어장 통계를 반환합니다.
 */
export function getGlossaryStats(glossary: GlossaryEntry[]): {
    totalEntries: number;
    avgEnglishVariants: number;
    longestKoreanTerm: string;
    shortestKoreanTerm: string;
} {
    if (glossary.length === 0) {
        return {
            totalEntries: 0,
            avgEnglishVariants: 0,
            longestKoreanTerm: '',
            shortestKoreanTerm: '',
        };
    }

    const totalEnglishVariants = glossary.reduce((sum, e) => sum + e.english.length, 0);
    const sortedByLength = [...glossary].sort((a, b) => b.korean.length - a.korean.length);

    return {
        totalEntries: glossary.length,
        avgEnglishVariants: totalEnglishVariants / glossary.length,
        longestKoreanTerm: sortedByLength[0].korean,
        shortestKoreanTerm: sortedByLength[sortedByLength.length - 1].korean,
    };
}

/**
 * 번역 가이드라인 파일에서 주요 규칙을 추출합니다.
 */
export function parseGuidelineFile(content: string): {
    rules: string[];
    abbreviations: { korean: string; english: string }[];
} {
    const rules: string[] = [];
    const abbreviations: { korean: string; english: string }[] = [];

    const lines = content.split('\n');
    let inAbbreviationSection = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // 약어 섹션 감지
        if (trimmed.includes('고정 약어') || trimmed.includes('Specialized Abbreviations')) {
            inAbbreviationSection = true;
            continue;
        }

        // 다른 섹션으로 전환
        if (trimmed.startsWith('---') || trimmed.startsWith('===')) {
            inAbbreviationSection = false;
            continue;
        }

        // 약어 파싱
        if (inAbbreviationSection && trimmed.startsWith('- ')) {
            const match = trimmed.match(/- (\w+)\s*\/\s*(.+?)\s*\/\s*(.+)/);
            if (match) {
                abbreviations.push({
                    korean: match[3].trim(),
                    english: match[1].trim(),
                });
            }
        }

        // 규칙 추출 (불릿 포인트)
        if (trimmed.startsWith('- ') && !inAbbreviationSection) {
            const ruleText = trimmed.substring(2).trim();
            if (ruleText.length > 10 && !ruleText.includes('/')) {
                rules.push(ruleText);
            }
        }
    }

    return { rules, abbreviations };
}
