/**
 * documentAudit - 번역 완료 후 최종 PPTX 문서 감사 (결정적, API 호출 없음)
 *
 * 검사 항목:
 * 1. 색상 보존 — 번역 텍스트의 색상 태그가 결과물 XML에 실제로 적용됐는지
 * 2. 번역 완성도 — 결과물에 한글이 잔존하는 문단 탐지
 * 3. 오버플로우 — 축소 적용 후에도 박스 용량을 초과할 가능성이 있는 도형 탐지
 */
import JSZip from 'jszip';
import { extractTextFromPptx, TextItem, getShapeExtent, getBodyInsetsPt } from './pptxService';
import { extractColorTokens } from './aiProvider';
import { measureWidthPt, linesNeededAtScale, solveFitScale } from './textMetrics';

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const KOREAN_RE = /[가-힣]/;
const LINE_HEIGHT_RATIO = 1.22;

/** txBody의 문단별 텍스트 목록 */
const getParaTexts = (txBody: Element): string[] =>
    Array.from(txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'))
        .map(p => Array.from(p.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't'))
            .map(t => t.textContent || '').join(''));

export type AuditIssueType = 'color-loss' | 'untranslated' | 'overflow';

export interface AuditIssue {
    slideNumber: number;
    type: AuditIssueType;
    severity: 'high' | 'medium' | 'low';
    detail: string;
    /** 수정 루프에서 재번역할 수 있도록 translatedItems 기준 인덱스를 첨부 */
    itemIndexes?: number[];
}

export interface AuditReport {
    checkedSlides: number;
    colorLossCount: number;
    untranslatedCount: number;
    overflowCount: number;
    issues: AuditIssue[];
    /** 번역 범위 밖 요소에 대한 사용자 고지 (이미지 글자, 노트, 폰트 대체 등) */
    notices: string[];
}

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '');

export const auditDocument = async (
    translatedBlob: Blob,
    translatedItems: TextItem[],
    startSlide: number,
    endSlide: number,
): Promise<AuditReport> => {
    const issues: AuditIssue[] = [];

    // translatedItems 역참조용: 문단 키 → 항목 인덱스
    const itemIndexByKey = new Map(translatedItems.map((it, idx) => [`${it.slidePath}#${it.paragraphIndex}`, idx]));

    // ---- 1·2. 결과물 재추출 후 색상/한글 검사 ----
    // 추출 병합 규칙이 동일하므로 색상 토큰을 "집합"으로 비교 가능
    const outItems = await extractTextFromPptx(translatedBlob as unknown as File, startSlide, endSlide);
    const outMap = new Map(outItems.map(i => [`${i.slidePath}#${i.paragraphIndex}`, i]));

    translatedItems.forEach((item, idx) => {
        const expected = [...new Set(extractColorTokens(item.text))];
        if (expected.length === 0) return;
        const out = outMap.get(`${item.slidePath}#${item.paragraphIndex}`);
        const actual = new Set(extractColorTokens(out?.text ?? ''));
        const missing = expected.filter(t => !actual.has(t));
        if (missing.length > 0) {
            issues.push({
                slideNumber: item.slideNumber,
                type: 'color-loss',
                severity: 'high',
                detail: `색상 미적용 ${missing.map(t => `<color:${t}>`).join(', ')} — "${stripTags(item.text).trim().slice(0, 30)}"`,
                itemIndexes: [idx],
            });
        }
    });

    for (const out of outItems) {
        const plain = stripTags(out.text).trim();
        if (KOREAN_RE.test(plain)) {
            const idx = itemIndexByKey.get(`${out.slidePath}#${out.paragraphIndex}`);
            issues.push({
                slideNumber: out.slideNumber,
                type: 'untranslated',
                severity: 'medium',
                detail: `한글 잔존 — "${plain.slice(0, 40)}"`,
                itemIndexes: idx !== undefined ? [idx] : undefined,
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

        const slidePath = slidePaths[i];
        const slideNumber = parseInt(slidePath.match(/slide(\d+)\.xml/)![1]);
        const xml = await zip.file(slidePath)!.async('string');
        const doc = parser.parseFromString(xml, 'application/xml');
        const allParagraphs = Array.from(doc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'));

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

            // 적용된 normAutofit fontScale 반영, 실측 폭 기반으로 필요 높이 계산
            const normAutofit = txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit')[0];
            const fontScale = normAutofit ? parseInt(normAutofit.getAttribute('fontScale') || '100000') / 100000 : 1.0;
            const insets = getBodyInsetsPt(txBody as Element);
            const fontPt = maxSz / 100;
            const usableW = extent.cx / 12700 - insets.x;
            const usableH = extent.cy / 12700 - insets.y;
            if (usableW <= 0 || usableH <= 0) continue;

            const widths = getParaTexts(txBody as Element).map(t => measureWidthPt(t, fontPt));
            const neededH = linesNeededAtScale(widths, fontScale, usableW) * LINE_HEIGHT_RATIO * fontPt * fontScale;
            const overflowRatio = neededH / usableH;
            if (overflowRatio > 1.25) {
                // 이 txBody에 속한 번역 항목 인덱스 수집 (축약 재번역 대상)
                const itemIndexes = Array.from(txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'))
                    .map(p => itemIndexByKey.get(`${slidePath}#${allParagraphs.indexOf(p)}`))
                    .filter((v): v is number => v !== undefined);
                issues.push({
                    slideNumber,
                    type: 'overflow',
                    severity: overflowRatio > 1.6 ? 'high' : 'medium',
                    detail: `박스 넘침 가능 (용량 대비 ${Math.round(overflowRatio * 100)}%) — "${text.trim().slice(0, 30)}"`,
                    itemIndexes: itemIndexes.length > 0 ? itemIndexes : undefined,
                });
            }
        }
    }

    issues.sort((a, b) => a.slideNumber - b.slideNumber);

    // ---- 4. 사용자 고지 항목 (번역 범위 밖 요소) ----
    const notices: string[] = [];
    const allPaths = Object.keys(zip.files);

    const imageCount = allPaths.filter(p => p.match(/^ppt\/media\/.*\.(png|jpe?g|gif|bmp|tiff?|emf|wmf)$/i)).length;
    if (imageCount > 0) {
        notices.push(`이미지 ${imageCount}개 포함 — 그림 속에 박힌 글자는 번역되지 않습니다.`);
    }

    const noteFiles = allPaths.filter(p => p.match(/^ppt\/notesSlides\/notesSlide\d+\.xml$/));
    let koreanNoteCount = 0;
    for (const p of noteFiles) {
        const noteXml = await zip.file(p)!.async('string');
        const texts = (noteXml.match(/<a:t>([^<]*)<\/a:t>/g) || []).join('');
        if (KOREAN_RE.test(texts)) koreanNoteCount++;
    }
    if (koreanNoteCount > 0) {
        notices.push(`발표자 노트 ${koreanNoteCount}개 슬라이드에 한글 있음 — 노트는 번역 대상이 아닙니다.`);
    }

    if (allPaths.some(p => p.startsWith('ppt/diagrams/'))) {
        notices.push('다이어그램(SmartArt) 텍스트는 번역되지 않습니다.');
    }

    notices.push('한글 폰트(맑은 고딕 등)는 영문 환경에서 다른 폰트로 대체될 수 있습니다 — 실제 PowerPoint에서 최종 확인을 권장합니다.');

    return {
        checkedSlides,
        colorLossCount: issues.filter(i => i.type === 'color-loss').length,
        untranslatedCount: issues.filter(i => i.type === 'untranslated').length,
        overflowCount: issues.filter(i => i.type === 'overflow').length,
        issues,
        notices,
    };
};

// ============================================================
// 오버플로우 보정 (3단계 병행: 글자크기 → 박스크기 → 축약 재번역)
// ============================================================

export interface RemediationResult {
    blob: Blob;
    /** 글자크기/박스크기 조정으로 해결한 도형 수 */
    boxesAdjusted: number;
    /** 조정만으로 부족해 축약 재번역이 필요한 항목 인덱스 */
    shortenItemIndexes: number[];
}

const MIN_FONT_SCALE_SAFE = 0.6;   // 1차 글자 축소 하한 (가독성 안전선)
const MIN_FONT_SCALE_HARD = 0.5;   // 박스 확대와 병행할 때의 최저 하한
const MAX_BOX_GROWTH = 1.3;        // 박스 높이 최대 확대율 (+30%)

const findAncestorGroup = (node: Element): boolean => {
    let cur: Element | null = node.parentElement;
    while (cur) {
        if (cur.localName === 'grpSp') return true;
        cur = cur.parentElement;
    }
    return false;
};

const setAutofit = (xmlDoc: Document, txBody: Element, scale: number): void => {
    const bodyPr = txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'bodyPr')[0];
    if (!bodyPr) return;
    // spAutoFit(도형 확대형)은 박스가 자라며 레이아웃을 침범 → 축소형으로 교체
    const spAutoFit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'spAutoFit')[0];
    if (spAutoFit) bodyPr.removeChild(spAutoFit);
    const noAutofit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'noAutofit')[0];
    if (noAutofit) bodyPr.removeChild(noAutofit);

    const fontScale = String(Math.round(scale * 100000));
    const lnSpcReduction = scale < 0.8 ? '10000' : '0';
    const existing = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit')[0];
    if (existing) {
        existing.setAttribute('fontScale', fontScale);
        existing.setAttribute('lnSpcReduction', lnSpcReduction);
    } else {
        const normAutofit = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:normAutofit');
        normAutofit.setAttribute('fontScale', fontScale);
        normAutofit.setAttribute('lnSpcReduction', lnSpcReduction);
        bodyPr.appendChild(normAutofit);
    }
};

/**
 * 박스 넘침을 단계적으로 보정합니다. (텍스트 변경 없음 — 오역 리스크 0)
 *
 * 1단계: 글자크기 축소 (fontScale ≥ 0.6 으로 해결되면 그것만)
 * 2단계: 박스 높이 확대 (그룹 밖 + 슬라이드 하단 경계 내, 최대 +30%) + 글자 0.6
 * 3단계: 박스 +30% + 글자 0.5 까지 병행
 * 그래도 부족하면 → 축약 재번역 대상으로 반환 (호출 측에서 처리)
 */
export const remediateOverflows = async (
    translatedBlob: Blob,
    translatedItems: TextItem[],
    startSlide: number,
    endSlide: number,
): Promise<RemediationResult> => {
    const zip = await JSZip.loadAsync(translatedBlob as unknown as Blob);
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    // 슬라이드 높이 (박스 확대 시 하단 경계 확인용)
    let slideCy = 6858000;
    const presXml = await zip.file('ppt/presentation.xml')?.async('string');
    if (presXml) {
        const m = presXml.match(/<p:sldSz[^>]*cy="(\d+)"/);
        if (m) slideCy = parseInt(m[1]);
    }

    const itemIndexByKey = new Map(translatedItems.map((it, idx) => [`${it.slidePath}#${it.paragraphIndex}`, idx]));
    const slidePaths = Object.keys(zip.files)
        .filter(p => p.match(/^ppt\/slides\/slide(\d+)\.xml$/))
        .sort((a, b) =>
            parseInt(a.match(/slide(\d+)\.xml/)![1]) - parseInt(b.match(/slide(\d+)\.xml/)![1]));

    let boxesAdjusted = 0;
    const shortenIndexes = new Set<number>();

    for (let i = 0; i < slidePaths.length; i++) {
        const position = i + 1;
        if (position < startSlide || position > endSlide) continue;

        const slidePath = slidePaths[i];
        const xml = await zip.file(slidePath)!.async('string');
        const doc = parser.parseFromString(xml, 'application/xml');
        const allParagraphs = Array.from(doc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'));
        let changed = false;

        // 가족(같은 크기·같은 폰트) 단위 축소율 통일을 위해 1차 수집 후 일괄 적용
        const fontFixes: { txBody: Element; sFit: number; key: string }[] = [];

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

            // 실측 폭 기반: 박스에 들어가는 최대 폰트 배율 탐색
            const insets = getBodyInsetsPt(txBody as Element);
            const fontPt = maxSz / 100;
            const usableW = extent.cx / 12700 - insets.x;
            const usableH = extent.cy / 12700 - insets.y;
            if (usableW <= 0 || usableH <= 0) continue;

            const paraTexts = getParaTexts(txBody as Element);
            const widths = paraTexts.map(p => measureWidthPt(p, fontPt));
            const lineH = LINE_HEIGHT_RATIO * fontPt;
            const fitsAt = (s: number, growH: number = 1): boolean =>
                linesNeededAtScale(widths, s, usableW) * lineH * s
                <= (extent.cy * growH) / 12700 - insets.y;

            if (fitsAt(1)) continue; // 원본 크기로 수용 — 보정 불필요

            const inGroup = findAncestorGroup(txBody as Element);

            // 박스 확대 가능 여부 (그룹 밖 + 슬라이드 하단 경계 내)
            const sp = txBody.parentElement!;
            const spPr = Array.from(sp.children).find(c => c.localName === 'spPr');
            const xfrm = spPr?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'xfrm')[0];
            const off = xfrm?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'off')[0];
            const ext = xfrm?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'ext')[0];
            const offY = off ? parseInt(off.getAttribute('y') || '0') : null;
            const canGrow = (g: number): boolean =>
                !inGroup && !!ext && offY !== null && (offY + extent.cy * g) <= slideCy * 1.02;
            const grow = (g: number) => {
                ext!.setAttribute('cy', String(Math.round(extent.cy * g)));
            };

            const sFit = solveFitScale(paraTexts, fontPt, usableW, usableH, LINE_HEIGHT_RATIO, MIN_FONT_SCALE_SAFE);
            if (sFit !== null) {
                // 1단계: 글자크기 축소만으로 해결 (≥ 0.6) — 가족 통일 위해 일괄 적용으로 보류
                fontFixes.push({ txBody: txBody as Element, sFit, key: `${extent.cx}x${extent.cy}#${maxSz}` });
            } else if (canGrow(MAX_BOX_GROWTH) && fitsAt(MIN_FONT_SCALE_SAFE, MAX_BOX_GROWTH)) {
                // 2단계: 박스 확대(+30% 이내 최소량) + 글자 0.6
                let g = 1.05;
                while (g < MAX_BOX_GROWTH && !fitsAt(MIN_FONT_SCALE_SAFE, g)) g += 0.05;
                grow(Math.min(g, MAX_BOX_GROWTH));
                setAutofit(doc, txBody as Element, MIN_FONT_SCALE_SAFE);
                boxesAdjusted++; changed = true;
            } else if (canGrow(MAX_BOX_GROWTH) && fitsAt(MIN_FONT_SCALE_HARD, MAX_BOX_GROWTH)) {
                // 3단계: 박스 +30% + 글자 0.5
                grow(MAX_BOX_GROWTH);
                setAutofit(doc, txBody as Element, MIN_FONT_SCALE_HARD);
                boxesAdjusted++; changed = true;
            } else if (inGroup && fitsAt(MIN_FONT_SCALE_HARD)) {
                // 그룹 내부: 박스 확대 불가 → 글자 0.5 까지만
                setAutofit(doc, txBody as Element, MIN_FONT_SCALE_HARD);
                boxesAdjusted++; changed = true;
            } else {
                // 조정만으로 부족 → 축약 재번역 필요
                setAutofit(doc, txBody as Element, MIN_FONT_SCALE_HARD);
                changed = true;
                for (const p of Array.from(txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'))) {
                    const idx = itemIndexByKey.get(`${slidePath}#${allParagraphs.indexOf(p)}`);
                    if (idx !== undefined) shortenIndexes.add(idx);
                }
            }
        }

        // 글자 축소 건은 가족 단위로 최소값 통일 후 일괄 적용 (들쭉날쭉 방지)
        if (fontFixes.length > 0) {
            const familyMin = new Map<string, number>();
            for (const f of fontFixes) {
                familyMin.set(f.key, Math.min(familyMin.get(f.key) ?? 1, f.sFit));
            }
            for (const f of fontFixes) {
                setAutofit(doc, f.txBody, familyMin.get(f.key)!);
                boxesAdjusted++;
            }
            changed = true;
        }

        if (changed) {
            zip.file(slidePath, serializer.serializeToString(doc));
        }
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    return { blob, boxesAdjusted, shortenItemIndexes: [...shortenIndexes].sort((a, b) => a - b) };
};
