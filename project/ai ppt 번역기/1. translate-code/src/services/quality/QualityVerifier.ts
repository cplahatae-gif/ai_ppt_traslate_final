/**
 * QualityVerifier - 번역 품질 검증 서비스 (결정적 규칙 기반)
 *
 * LLM 기반 검증(QualityService)과 별개로, API 호출 없이
 * 구조적 결함(태그 소실, 숫자 변형, 빈 번역 등)을 검사합니다.
 */

import type {
    QualityResult,
    QualityCriteria,
    QualityIssue,
    ImprovementSuggestion,
    DocumentType
} from '../../types';
import { extractColorTokens } from '../aiProvider';

const countTag = (text: string, tag: string): number =>
    (text.match(new RegExp(`<${tag}>`, 'gi')) || []).length;

const extractNumbers = (text: string): string[] =>
    text.replace(/<[^>]*>/g, '').match(/\d+(?:[.,]\d+)*/g) || [];

export class QualityVerifier {
    /**
     * 번역 결과를 검증하고 품질 점수를 반환합니다
     */
    async verifyTranslation(
        original: string[],
        translated: string[],
        _documentType: DocumentType
    ): Promise<QualityResult> {
        const issues: QualityIssue[] = [];
        let colorOk = true;
        let formatOk = true;
        let numbersOk = true;

        const n = Math.min(original.length, translated.length);
        if (original.length !== translated.length) {
            formatOk = false;
            issues.push({
                type: 'formatting',
                description: `항목 수 불일치: 원본 ${original.length}개 vs 번역 ${translated.length}개`,
                location: '전체',
                severity: 'high',
            });
        }

        for (let i = 0; i < n; i++) {
            const orig = original[i];
            const trans = translated[i] ?? '';

            // 1. 빈 번역
            if (orig.replace(/<[^>]*>/g, '').trim() && !trans.replace(/<[^>]*>/g, '').trim()) {
                formatOk = false;
                issues.push({
                    type: 'formatting',
                    description: '번역 결과가 비어 있음',
                    location: `항목 ${i + 1}`,
                    severity: 'high',
                    index: i,
                });
                continue;
            }

            // 2. 색상 토큰 보존 (소실 시 글자색 깨짐으로 직결)
            const origColors = new Set(extractColorTokens(orig));
            const transColors = new Set(extractColorTokens(trans));
            const missing = [...origColors].filter(c => !transColors.has(c));
            if (missing.length > 0) {
                colorOk = false;
                issues.push({
                    type: 'formatting',
                    description: `색상 태그 소실: ${missing.map(c => `<color:${c}>`).join(', ')}`,
                    location: `항목 ${i + 1}`,
                    severity: 'high',
                    index: i,
                });
            }

            // 3. 굵게/줄바꿈 태그 (병합 가능성이 있어 전부 사라졌을 때만 보고)
            if (countTag(trans, 'b') === 0 && countTag(orig, 'b') > 0) {
                formatOk = false;
                issues.push({
                    type: 'formatting',
                    description: '<b> 태그가 모두 사라짐',
                    location: `항목 ${i + 1}`,
                    severity: 'medium',
                    index: i,
                });
            }
            if (countTag(trans, 'br') > countTag(orig, 'br')) {
                formatOk = false;
                issues.push({
                    type: 'formatting',
                    description: '원본에 없는 <br> 줄바꿈이 추가됨',
                    location: `항목 ${i + 1}`,
                    severity: 'low',
                    index: i,
                });
            }

            // 4. 숫자 보존 (원본 숫자가 번역에 존재하는지)
            const origNums = extractNumbers(orig);
            const transText = trans.replace(/<[^>]*>/g, '');
            const lostNums = origNums.filter(num => !transText.includes(num));
            if (lostNums.length > 0) {
                numbersOk = false;
                issues.push({
                    type: 'numbers',
                    description: `숫자 누락/변형 가능성: ${lostNums.slice(0, 5).join(', ')}`,
                    location: `항목 ${i + 1}`,
                    severity: 'medium',
                    index: i,
                });
            }
        }

        const criteria: QualityCriteria = {
            documentTypeAppropriate: true,
            terminologyConsistent: true,
            formattingPreserved: formatOk && colorOk,
            numbersPreserved: numbersOk,
            properNounsUntranslated: true,
            englishConsistent: true,
            safetyGuideCompliant: true,
            tableFormatCorrect: true,
            questionNumberingPreserved: true,
            bulletPointsConsistent: true,
            capitalizationConsistent: true,
        };

        const highCount = issues.filter(i => i.severity === 'high').length;
        const mediumCount = issues.filter(i => i.severity === 'medium').length;
        const lowCount = issues.filter(i => i.severity === 'low').length;
        const overallScore = Math.max(0, 100 - highCount * 10 - mediumCount * 3 - lowCount * 1);

        return {
            overallScore,
            criteria,
            issues,
            passed: overallScore >= 80,
        };
    }

    /**
     * 품질 문제에 대한 개선 제안을 생성합니다
     */
    async generateImprovements(
        qualityResult: QualityResult
    ): Promise<ImprovementSuggestion[]> {
        return qualityResult.issues
            .filter(issue => issue.suggestion && issue.index !== undefined)
            .map(issue => ({
                issueId: `${issue.type}-${issue.index}`,
                original: '',
                suggested: issue.suggestion!,
                reason: issue.description,
            }));
    }

    /**
     * 개선 제안을 적용합니다
     */
    async applyImprovements(
        translated: string[],
        improvements: ImprovementSuggestion[]
    ): Promise<string[]> {
        const result = [...translated];
        for (const imp of improvements) {
            const idx = parseInt(imp.issueId.split('-').pop() || '', 10);
            if (!isNaN(idx) && idx >= 0 && idx < result.length && imp.suggested) {
                result[idx] = imp.suggested;
            }
        }
        return result;
    }
}

export const qualityVerifier = new QualityVerifier();
