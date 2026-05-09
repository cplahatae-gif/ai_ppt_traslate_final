/**
 * Module 5: Report Generator
 * 평가 결과를 리포트 형식으로 생성합니다.
 */

import type {
    ScoreResult,
    ComparisonResult,
    GlossaryMatchResult,
    Issue,
    ReportData,
    EvaluationOutput,
} from './types';

/**
 * 평가 결과를 기반으로 상세 리포트를 생성합니다.
 */
export function generateReport(
    score: ScoreResult,
    comparison: ComparisonResult,
    glossaryResults: GlossaryMatchResult[],
    metadata: {
        koreanFileName: string;
        translatedFileName: string;
        slideCount: number;
        totalTextItems: number;
        glossaryTermCount: number;
    }
): ReportData {
    const issues = generateIssueList(comparison, glossaryResults);

    return {
        summary: generateSummary(score, metadata),
        visualDetails: generateVisualDetails(score, comparison),
        translationDetails: generateTranslationDetails(score, comparison, glossaryResults),
        glossaryMismatches: glossaryResults.filter(r => !r.isMatch),
        issues,
    };
}

/**
 * 종합 요약을 생성합니다.
 */
function generateSummary(
    score: ScoreResult,
    metadata: {
        koreanFileName: string;
        translatedFileName: string;
        slideCount: number;
        totalTextItems: number;
    }
): string {
    const gradeEmoji = getGradeEmoji(score.grade);

    return `## ${gradeEmoji} 종합 점수: ${score.total}/100 (${score.grade})

### 파일 정보
- **원본**: ${metadata.koreanFileName}
- **번역본**: ${metadata.translatedFileName}
- **슬라이드 수**: ${metadata.slideCount}
- **텍스트 항목 수**: ${metadata.totalTextItems}

### 점수 요약
- **시각적 품질**: ${score.visual.total}/80
- **번역 품질**: ${score.translation.total}/20`;
}

/**
 * 시각적 품질 상세 내역을 생성합니다.
 */
function generateVisualDetails(
    score: ScoreResult,
    comparison: ComparisonResult
): ReportData['visualDetails'] {
    return [
        {
            item: '폰트 크기',
            score: score.visual.fontSize,
            maxScore: 20,
            status: getStatus(score.visual.fontSize, 20),
            description: comparison.visual.fontSizeChanges.length === 0
                ? '85% 축소 적용됨 (의도대로)'
                : `${comparison.visual.fontSizeChanges.length}개 비정상 변경 감지`,
        },
        {
            item: '레이아웃',
            score: score.visual.layout,
            maxScore: 20,
            status: getStatus(score.visual.layout, 20),
            description: comparison.visual.layoutChanges.length === 0
                ? '레이아웃 보존됨'
                : `${comparison.visual.layoutChanges.filter(c => c.type === 'normAutofit_added').length}개 normAutofit 추가됨`,
        },
        {
            item: '테이블',
            score: score.visual.table,
            maxScore: 15,
            status: getStatus(score.visual.table, 15),
            description: comparison.visual.tableOverflows.length === 0
                ? '테이블 구조 보존됨'
                : `${comparison.visual.tableOverflows.length}개 셀 오버플로우`,
        },
        {
            item: '스타일',
            score: score.visual.style,
            maxScore: 10,
            status: getStatus(score.visual.style, 10),
            description: comparison.visual.styleChanges.length === 0
                ? 'Bold/Italic 보존됨'
                : `${comparison.visual.styleChanges.length}개 스타일 변경`,
        },
        {
            item: '텍스트 간격',
            score: score.visual.spacing,
            maxScore: 5,
            status: getStatus(score.visual.spacing, 5),
            description: '텍스트 간격 정규화됨',
        },
        {
            item: '특수문자',
            score: score.visual.specialChar,
            maxScore: 5,
            status: getStatus(score.visual.specialChar, 5),
            description: comparison.visual.specialCharIssues.length === 0
                ? '특수문자 보존됨'
                : `${comparison.visual.specialCharIssues.length}개 누락`,
        },
        {
            item: '언어 속성',
            score: score.visual.langAttribute,
            maxScore: 5,
            status: getStatus(score.visual.langAttribute, 5),
            description: comparison.visual.langAttributeIssues.length === 0
                ? 'lang="en-US" 적용됨'
                : `${comparison.visual.langAttributeIssues.length}개 미적용`,
        },
    ];
}

/**
 * 번역 품질 상세 내역을 생성합니다.
 */
function generateTranslationDetails(
    score: ScoreResult,
    comparison: ComparisonResult,
    glossaryResults: GlossaryMatchResult[]
): ReportData['translationDetails'] {
    const mismatches = glossaryResults.filter(r => !r.isMatch);
    const matchedCount = glossaryResults.length - mismatches.length;

    return [
        {
            item: '단어장 준수',
            score: score.translation.glossaryCompliance,
            maxScore: 8,
            status: getStatus(score.translation.glossaryCompliance, 8),
            description: glossaryResults.length === 0
                ? '단어장 없음'
                : `${matchedCount}/${glossaryResults.length} 용어 준수 (${mismatches.length}개 미준수)`,
        },
        {
            item: '용어 일관성',
            score: score.translation.consistency,
            maxScore: 5,
            status: getStatus(score.translation.consistency, 5),
            description: comparison.translation.termInconsistencies.length === 0
                ? '용어 일관성 유지됨'
                : `${comparison.translation.termInconsistencies.length}개 불일치`,
        },
        {
            item: '대소문자',
            score: score.translation.casing,
            maxScore: 3,
            status: getStatus(score.translation.casing, 3),
            description: comparison.translation.caseViolations.length === 0
                ? '대소문자 규칙 준수'
                : `${comparison.translation.caseViolations.length}개 위반`,
        },
        {
            item: '숫자/단위',
            score: score.translation.numbers,
            maxScore: 2,
            status: getStatus(score.translation.numbers, 2),
            description: '숫자/단위 보존됨',
        },
        {
            item: '로마자 변환',
            score: score.translation.romanNumerals,
            maxScore: 2,
            status: getStatus(score.translation.romanNumerals, 2),
            description: comparison.translation.romanNumeralIssues.length === 0
                ? '전각→반각 변환 완료'
                : `${comparison.translation.romanNumeralIssues.length}개 미변환`,
        },
    ];
}

/**
 * 이슈 목록을 생성합니다.
 */
function generateIssueList(
    comparison: ComparisonResult,
    glossaryResults: GlossaryMatchResult[]
): Issue[] {
    const issues: Issue[] = [];
    let issueId = 1;

    // 시각적 이슈
    for (const change of comparison.visual.fontSizeChanges) {
        const extChange = change as typeof change & { originalText?: string; translatedText?: string };
        issues.push({
            id: `V${issueId++}`,
            severity: 'high',
            category: 'visual',
            subcategory: 'fontSize',
            slideNumber: change.slideNumber,
            location: `슬라이드 ${change.slideNumber}페이지`,
            description: `폰트 과도 축소: ${change.original}→${change.translated} (${Math.round(change.ratio * 100)}%) | 원문: "${extChange.originalText || ''}"`,
            suggestion: '텍스트가 너무 작아지지 않았는지 확인',
        });
    }

    for (const change of comparison.visual.layoutChanges) {
        issues.push({
            id: `V${issueId++}`,
            severity: change.type === 'normAutofit_added' ? 'medium' : 'low',
            category: 'visual',
            subcategory: 'layout',
            slideNumber: change.slideNumber,
            location: `슬라이드 ${change.slideNumber}페이지`,
            description: change.description,
        });
    }

    for (const overflow of comparison.visual.tableOverflows) {
        issues.push({
            id: `V${issueId++}`,
            severity: 'high',
            category: 'visual',
            subcategory: 'table',
            slideNumber: overflow.slideNumber,
            location: `슬라이드 ${overflow.slideNumber}페이지, 테이블 ${overflow.rowIndex + 1}행 ${overflow.cellIndex + 1}열`,
            description: `셀 오버플로우: "${overflow.text}"`,
            suggestion: '셀 너비 확대 또는 텍스트 축약',
        });
    }

    for (const issue of comparison.visual.specialCharIssues) {
        const extIssue = issue as typeof issue & { originalText?: string; translatedText?: string };
        issues.push({
            id: `V${issueId++}`,
            severity: 'medium',
            category: 'visual',
            subcategory: 'specialChar',
            slideNumber: issue.slideNumber,
            location: `슬라이드 ${issue.slideNumber}페이지`,
            description: `특수문자 [${issue.missingChars.join(', ')}] 누락 | 원문: "${extIssue.originalText || ''}"`,
            suggestion: extIssue.originalText ? `원본에 있던 "${issue.missingChars.join('')}" 문자가 번역본에서 빠짐` : undefined,
        });
    }

    // 번역 이슈
    for (const mismatch of glossaryResults.filter(r => !r.isMatch)) {
        issues.push({
            id: `T${issueId++}`,
            severity: 'medium',
            category: 'glossary',
            subcategory: 'glossaryMismatch',
            slideNumber: mismatch.slideNumber,
            location: mismatch.position,
            description: `"${mismatch.korean}" → 기대: "${mismatch.expectedEnglish[0]}"`,
            suggestion: `단어장에 따라 "${mismatch.expectedEnglish[0]}" 사용 권장`,
        });
    }

    for (const inconsistency of comparison.translation.termInconsistencies) {
        const translations = inconsistency.translations.map(t => `"${t.english}" (슬라이드 ${t.slideNumber})`).join(', ');
        issues.push({
            id: `T${issueId++}`,
            severity: 'medium',
            category: 'translation',
            subcategory: 'inconsistency',
            slideNumber: inconsistency.translations[0]?.slideNumber || 0,
            location: '전체',
            description: `"${inconsistency.korean}"에 대해 다른 번역 사용: ${translations}`,
            suggestion: '동일한 원문에는 동일한 번역 사용',
        });
    }

    for (const violation of comparison.translation.caseViolations) {
        issues.push({
            id: `T${issueId++}`,
            severity: 'low',
            category: 'translation',
            subcategory: 'casing',
            slideNumber: violation.slideNumber,
            location: `Paragraph ${violation.paragraphIndex + 1}`,
            description: violation.description,
            suggestion: `${violation.expectedCase === 'title' ? 'Title Case' : 'Sentence case'} 사용 권장`,
        });
    }

    // 심각도 순으로 정렬
    return issues.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
}

/**
 * 점수에 따른 상태를 반환합니다.
 */
function getStatus(score: number, maxScore: number): 'pass' | 'warning' | 'fail' {
    const percentage = score / maxScore;
    if (percentage >= 0.9) return 'pass';
    if (percentage >= 0.6) return 'warning';
    return 'fail';
}

/**
 * 등급에 따른 이모지를 반환합니다.
 */
function getGradeEmoji(grade: string): string {
    const emojiMap: { [key: string]: string } = {
        'A+': '🏆',
        'A': '⭐',
        'B+': '✅',
        'B': '👍',
        'C+': '⚠️',
        'C': '📝',
        'D': '❌',
        'F': '🚫',
    };
    return emojiMap[grade] || '📋';
}

/**
 * 마크다운 형식의 리포트를 생성합니다.
 */
export function generateMarkdownReport(
    output: EvaluationOutput
): string {
    const { score, report, comparison, metadata } = output;

    let md = `# 번역 품질 평가 리포트

${report.summary}

---

## 📊 시각적 품질 (${score.visual.total}/80)

| 항목 | 점수 | 상태 | 설명 |
|------|------|------|------|
`;

    for (const item of report.visualDetails) {
        const statusIcon = item.status === 'pass' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
        md += `| ${item.item} | ${item.score}/${item.maxScore} | ${statusIcon} | ${item.description} |\n`;
    }

    md += `
---

## 📝 번역 품질 (${score.translation.total}/20)

| 항목 | 점수 | 상태 | 설명 |
|------|------|------|------|
`;

    for (const item of report.translationDetails) {
        const statusIcon = item.status === 'pass' ? '✅' : item.status === 'warning' ? '⚠️' : '❌';
        md += `| ${item.item} | ${item.score}/${item.maxScore} | ${statusIcon} | ${item.description} |\n`;
    }

    // 단어장 미준수 목록
    if (report.glossaryMismatches.length > 0) {
        md += `
---

## 📖 단어장 미준수 목록 (${report.glossaryMismatches.length}건)

| 원문 | 기대 번역 | 실제 번역 | 슬라이드 |
|------|----------|----------|---------|
`;

        for (const mismatch of report.glossaryMismatches.slice(0, 20)) {
            const expected = mismatch.expectedEnglish[0];
            const actual = mismatch.actualEnglish.substring(0, 30) + (mismatch.actualEnglish.length > 30 ? '...' : '');
            md += `| ${mismatch.korean} | ${expected} | ${actual} | ${mismatch.slideNumber} |\n`;
        }

        if (report.glossaryMismatches.length > 20) {
            md += `\n*... 외 ${report.glossaryMismatches.length - 20}건 더*\n`;
        }
    }

    // 이슈 목록
    if (report.issues.length > 0) {
        md += `
---

## ⚠️ 상세 이슈 목록 (${report.issues.length}건)

### 🔴 High
`;
        const highIssues = report.issues.filter(i => i.severity === 'high');
        if (highIssues.length === 0) {
            md += '\n없음\n';
        } else {
            for (const issue of highIssues) {
                md += `- **Slide ${issue.slideNumber}** ${issue.location}: ${issue.description}\n`;
            }
        }

        md += `
### 🟡 Medium
`;
        const mediumIssues = report.issues.filter(i => i.severity === 'medium');
        if (mediumIssues.length === 0) {
            md += '\n없음\n';
        } else {
            for (const issue of mediumIssues.slice(0, 10)) {
                md += `- **Slide ${issue.slideNumber}** ${issue.location}: ${issue.description}\n`;
            }
            if (mediumIssues.length > 10) {
                md += `\n*... 외 ${mediumIssues.length - 10}건 더*\n`;
            }
        }

        md += `
### 🟢 Low
`;
        const lowIssues = report.issues.filter(i => i.severity === 'low');
        if (lowIssues.length === 0) {
            md += '\n없음\n';
        } else {
            for (const issue of lowIssues.slice(0, 5)) {
                md += `- **Slide ${issue.slideNumber}** ${issue.location}: ${issue.description}\n`;
            }
            if (lowIssues.length > 5) {
                md += `\n*... 외 ${lowIssues.length - 5}건 더*\n`;
            }
        }
    }

    md += `
---

*평가 일시: ${metadata.evaluatedAt}*
`;

    return md;
}

/**
 * JSON 형식으로 결과를 내보냅니다.
 */
export function exportAsJSON(output: EvaluationOutput): string {
    return JSON.stringify(output, null, 2);
}

/**
 * 평가 결과를 번역앱의 "추가 지시사항"용 텍스트로 변환합니다.
 * 사용자가 번역앱에 붙여넣어 재번역 시 이슈를 우선 해결하도록 LLM에 지시.
 */
export function generateRetranslationInstructions(output: EvaluationOutput): string {
    const lines: string[] = [];
    lines.push('# 재번역 시 우선 해결할 이슈');
    lines.push('');
    lines.push(`이전 번역(${output.metadata.translatedFileName})의 품질 점수: ${output.score.total}/100 (${output.score.grade}).`);
    lines.push('아래 이슈들을 반드시 반영해서 다시 번역해주세요.');
    lines.push('');

    const high = output.issues.filter(i => i.severity === 'high');
    const medium = output.issues.filter(i => i.severity === 'medium');
    const mismatches = output.report.glossaryMismatches;

    if (high.length > 0) {
        lines.push(`## 🔴 High Priority (${high.length}건)`);
        high.slice(0, 20).forEach(i => {
            lines.push(`- Slide ${i.slideNumber} (${i.location}): ${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`);
        });
        if (high.length > 20) lines.push(`- ... 외 ${high.length - 20}건`);
        lines.push('');
    }

    if (medium.length > 0) {
        lines.push(`## 🟡 Medium Priority (${medium.length}건)`);
        medium.slice(0, 15).forEach(i => {
            lines.push(`- Slide ${i.slideNumber} (${i.location}): ${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`);
        });
        if (medium.length > 15) lines.push(`- ... 외 ${medium.length - 15}건`);
        lines.push('');
    }

    if (mismatches.length > 0) {
        lines.push(`## 📖 단어장 미준수 (${mismatches.length}건) — 반드시 권장 표현 사용`);
        mismatches.slice(0, 30).forEach(m => {
            lines.push(`- "${m.korean}" → 권장: "${m.expectedEnglish[0]}" (이전 번역: "${m.actualEnglish.substring(0, 40)}${m.actualEnglish.length > 40 ? '...' : ''}")`);
        });
        if (mismatches.length > 30) lines.push(`- ... 외 ${mismatches.length - 30}건`);
        lines.push('');
    }

    lines.push('## 추가 가이드');
    lines.push('- 기존 톤/스타일을 유지하되 위 이슈들을 우선 수정');
    lines.push('- 단어장의 권장 표현을 일관되게 사용');
    lines.push('- 텍스트 박스를 벗어나는 긴 번역은 더 간결한 표현으로 단축');

    return lines.join('\n');
}
