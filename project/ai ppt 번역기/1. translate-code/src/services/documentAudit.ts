/**
 * documentAudit - 번역 완료 후 최종 PPTX 문서 감사 (결정적, API 호출 없음)
 *
 * 검사 항목:
 * 1. 색상 보존 — 번역 텍스트의 색상 태그가 결과물 XML에 실제로 적용됐는지
 * 2. 번역 완성도 — 결과물에 한글이 잔존하는 문단 탐지
 * 3. 오버플로우 — 축소 적용 후에도 박스 용량을 초과할 가능성이 있는 도형 탐지
 */
import JSZip from 'jszip';
import { extractTextFromPptx, TextItem, getShapeExtent, estimateCapacityChars } from './pptxService';
import { extractColorTokens } from './aiProvider';

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const KOREAN_RE = /[가-힣]/;

export type AuditIssueType = 'color-loss' | 'untranslated' | 'overflow';

export interface AuditIssue {
    slideNumber: number;
    type: AuditIssueType;
    severity: 'high' | 'medium' | 'low';
    detail: string;
}

export interface AuditReport {
    checkedSlides: number;
    colorLossCount: number;
    untranslatedCount: number;
    overflowCount: number;
    issues: AuditIssue[];
}

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '');

export const auditDocument = async (
    translatedBlob: Blob,
    translatedItems: TextItem[],
    startSlide: number,
    endSlide: number,
): Promise<AuditReport> => {
    const issues: AuditIssue[] = [];

    // ---- 1·2. 결과물 재추출 후 색상/한글 검사 ----
    // 추출 병합 규칙이 동일하므로 색상 토큰을 "집합"으로 비교 가능
    const outItems = await extractTextFromPptx(translatedBlob as unknown as File, startSlide, endSlide);
    const outMap = new Map(outItems.map(i => [`${i.slidePath}#${i.paragraphIndex}`, i]));

    for (const item of translatedItems) {
        const expected = [...new Set(extractColorTokens(item.text))];
        if (expected.length === 0) continue;
        const out = outMap.get(`${item.slidePath}#${item.paragraphIndex}`);
        const actual = new Set(extractColorTokens(out?.text ?? ''));
        const missing = expected.filter(t => !actual.has(t));
        if (missing.length > 0) {
            issues.push({
                slideNumber: item.slideNumber,
                type: 'color-loss',
                severity: 'high',
                detail: `색상 미적용 ${missing.map(t => `<color:${t}>`).join(', ')} — "${stripTags(item.text).trim().slice(0, 30)}"`,
            });
        }
    }

    for (const out of outItems) {
        const plain = stripTags(out.text).trim();
        if (KOREAN_RE.test(plain)) {
            issues.push({
                slideNumber: out.slideNumber,
                type: 'untranslated',
                severity: 'medium',
                detail: `한글 잔존 — "${plain.slice(0, 40)}"`,
            });
        }
    }

    // ---- 3. 오버플로우 검사 (도형만 — 표는 행 높이가 자동으로 늘어남) ----
    const zip = await JSZip.loadAsync(translatedBlob as unknown as Blob);
    const parser = new DOMParser();
    const slidePaths = Object.keys(zip.files)
        .filter(p => p.match(/^ppt\/slides\/slide(\d+)\.xml$/))
        .sort((a, b) =>
            parseInt(a.match(/slide(\d+)\.xml/)![1]) - parseInt(b.match(/slide(\d+)\.xml/)![1]));

    let checkedSlides = 0;
    for (let i = 0; i < slidePaths.length; i++) {
        const position = i + 1;
        if (position < startSlide || position > endSlide) continue;
        checkedSlides++;

        const slideNumber = parseInt(slidePaths[i].match(/slide(\d+)\.xml/)![1]);
        const xml = await zip.file(slidePaths[i])!.async('string');
        const doc = parser.parseFromString(xml, 'application/xml');

        const txBodies = Array.from(doc.getElementsByTagName('*')).filter(el => el.localName === 'txBody');
        for (const txBody of txBodies) {
            if (txBody.parentElement?.localName === 'tc') continue;

            const text = Array.from(txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't'))
                .map(t => t.textContent || '').join('');
            if (text.trim().length < 8) continue;

            const extent = getShapeExtent(txBody as Element);
            if (!extent) continue;

            let maxSz = 0;
            for (const rPr of Array.from(txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr'))) {
                const sz = parseInt(rPr.getAttribute('sz') || '0');
                if (sz > maxSz) maxSz = sz;
            }
            if (maxSz === 0) continue;

            // 적용된 normAutofit fontScale 반영한 실효 폰트 크기로 용량 추정
            const normAutofit = txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit')[0];
            const fontScale = normAutofit ? parseInt(normAutofit.getAttribute('fontScale') || '100000') / 100000 : 1.0;
            const capacity = estimateCapacityChars(extent, maxSz * fontScale);
            if (capacity === null) continue;

            const overflowRatio = text.length / capacity;
            if (overflowRatio > 1.3) {
                issues.push({
                    slideNumber,
                    type: 'overflow',
                    severity: overflowRatio > 1.6 ? 'high' : 'medium',
                    detail: `박스 넘침 가능 (용량 대비 ${Math.round(overflowRatio * 100)}%) — "${text.trim().slice(0, 30)}"`,
                });
            }
        }
    }

    issues.sort((a, b) => a.slideNumber - b.slideNumber);

    return {
        checkedSlides,
        colorLossCount: issues.filter(i => i.type === 'color-loss').length,
        untranslatedCount: issues.filter(i => i.type === 'untranslated').length,
        overflowCount: issues.filter(i => i.type === 'overflow').length,
        issues,
    };
};
