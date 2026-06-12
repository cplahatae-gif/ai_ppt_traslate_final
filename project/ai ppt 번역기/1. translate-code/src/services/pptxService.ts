import JSZip from 'jszip';

export interface TextItem {
    slidePath: string;
    paragraphIndex: number;
    text: string; // HTML 태그가 포함된 텍스트 (예: "Hello <b>World</b>")
    slideNumber: number; // 슬라이드 번호 (1부터 시작)
    originalLength?: number; // 원본 텍스트 길이 (동적 폰트 스케일링용)
}

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";

/**
 * PPTX 파일의 총 슬라이드 개수를 반환합니다.
 */
export const countSlides = async (file: File): Promise<number> => {
    const zip = await JSZip.loadAsync(file);
    const slidePaths = Object.keys(zip.files).filter(path => path.startsWith('ppt/slides/slide') && path.endsWith('.xml'));
    return slidePaths.length;
};

/**
 * rPr의 직계 자식 solidFill에서 색상 토큰을 추출합니다.
 * - srgbClr: "0000FF" (hex 6자리)
 * - schemeClr: "tx1", "bg1" 등. lumMod/lumOff 변형은 "tx1.lm50000.lo35000" 형태로 인코딩
 * - a:ln(외곽선) 내부의 solidFill은 무시 (직계 자식만)
 */
const extractColorToken = (rPr: Element | undefined): string => {
    if (!rPr) return '';
    const fills = Array.from(rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'solidFill'));
    const solidFill = fills.find(f => f.parentNode === rPr);
    if (!solidFill) return '';

    const srgbClr = solidFill.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'srgbClr')[0];
    if (srgbClr) return srgbClr.getAttribute('val') || '';

    const schemeClr = solidFill.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'schemeClr')[0];
    if (schemeClr) {
        let token = schemeClr.getAttribute('val') || '';
        if (!token) return '';
        const lumMod = schemeClr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'lumMod')[0];
        const lumOff = schemeClr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'lumOff')[0];
        if (lumMod?.getAttribute('val')) token += `.lm${lumMod.getAttribute('val')}`;
        if (lumOff?.getAttribute('val')) token += `.lo${lumOff.getAttribute('val')}`;
        return token;
    }
    return '';
};

/**
 * PPTX 파일에서 텍스트를 추출합니다. (스타일 태그 보존)
 * @param file PPTX 파일
 * @param startSlide 시작 슬라이드 번호 (1부터)
 * @param endSlide 끝 슬라이드 번호 (포함)
 */
export const extractTextFromPptx = async (file: File, startSlide: number = 1, endSlide: number = 9999): Promise<TextItem[]> => {
    const zip = await JSZip.loadAsync(file);
    const allFiles = Object.keys(zip.files);

    // slide1.xml, slide2.xml ... 순서대로 정렬하기 위해 번호 추출 및 정렬
    const slideFiles = allFiles
        .filter(path => path.match(/^ppt\/slides\/slide(\d+)\.xml$/))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
            return numA - numB;
        });

    const allTextItems: TextItem[] = [];
    const parser = new DOMParser();

    // 범위에 해당하는 슬라이드만 처리
    const targetSlides = slideFiles.filter((_, index) => {
        const slideNum = index + 1;
        return slideNum >= startSlide && slideNum <= endSlide;
    });

    for (const slidePath of targetSlides) {
        const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/)![1]);
        const slideXml = await zip.file(slidePath)!.async('string');
        const xmlDoc = parser.parseFromString(slideXml, 'application/xml');

        const paragraphNodes = Array.from(xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'));

        paragraphNodes.forEach((pNode, index) => {
            // 문단 내의 노드(Run, Break)들을 순회하며 텍스트와 줄바꿈 추출
            // getElementsByTagNameNS 대신 childNodes를 순회해야 순서를 지킬 수 있음
            const childNodes = Array.from(pNode.childNodes);
            if (childNodes.length === 0) return;

            let formattedText = '';
            let hasText = false;

            // Run Buffer for merging adjacent runs with same styles
            interface RunStyle {
                text: string;
                b: boolean;
                i: boolean;
                u: boolean;
                color: string;
            }
            let runBuffer: RunStyle[] = [];

            const flushBuffer = () => {
                if (runBuffer.length === 0) return '';
                let result = '';
                let current = runBuffer[0];

                for (let k = 1; k < runBuffer.length; k++) {
                    const next = runBuffer[k];
                    const isSame = current.b === next.b &&
                        current.i === next.i &&
                        current.u === next.u &&
                        current.color === next.color;

                    if (isSame) {
                        current.text += next.text;
                    } else {
                        result += tagRun(current);
                        current = next;
                    }
                }
                result += tagRun(current);
                runBuffer = [];
                return result;
            };

            const tagRun = (run: RunStyle) => {
                let chunk = run.text;
                if (run.color) chunk = `<color:${run.color}>${chunk}</color>`;
                if (run.u) chunk = `<u>${chunk}</u>`;
                if (run.i) chunk = `<i>${chunk}</i>`;
                if (run.b) chunk = `<b>${chunk}</b>`;
                return chunk;
            };

            childNodes.forEach(child => {
                if (child.nodeName === 'a:r') {
                    const rNode = child as Element;
                    const tNode = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0];
                    const text = tNode?.textContent || '';
                    if (!text) return;
                    hasText = true;

                    // 스타일 확인 (rPr)
                    const rPr = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
                    const b = rPr?.getAttribute('b') === '1';
                    const i = rPr?.getAttribute('i') === '1';
                    const u = rPr?.getAttribute('u') === 'sng';

                    // 색상 추출 (srgbClr hex + schemeClr 테마색/lumMod 변형)
                    const color = extractColorToken(rPr);

                    runBuffer.push({ text, b, i, u, color });

                } else if (child.nodeName === 'a:br') {
                    formattedText += flushBuffer();
                    formattedText += '<br>';
                    hasText = true;
                }
            });

            // Flush remaining runs
            formattedText += flushBuffer();

            if (hasText && formattedText.trim() !== '') {
                allTextItems.push({
                    slidePath,
                    paragraphIndex: index,
                    text: formattedText,
                    slideNumber: slideNum
                });
            }
        });
    }

    return allTextItems;
};

// ============================================================
// 태그 토크나이저 (재조립용)
// ============================================================
// DOMParser(text/html) 대신 직접 토크나이즈하는 이유:
// 1. <color:0000FF>...</color> 는 HTML 파서에서 여는/닫는 태그 이름이 달라
//    닫는 태그가 무시되고 이후 텍스트까지 색이 전염되는 버그가 있었음
// 2. <color:tx1.lm50000> 같은 scheme 토큰은 HTML 태그 이름으로 안전하지 않음

const ENTITY_MAP: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};
const decodeEntities = (s: string): string =>
    s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, m => ENTITY_MAP[m] ?? m);

interface StyleFrame {
    tag: 'b' | 'i' | 'u' | 'color';
    color?: string;
}

/**
 * 색상 토큰을 rPr에 solidFill로 적용합니다.
 * - 6자리 hex → srgbClr
 * - 그 외 → schemeClr (".lmNNN"/".loNNN" 접미사는 lumMod/lumOff로 복원)
 */
const applyColorToken = (xmlDoc: Document, rPr: Element, token: string): void => {
    // 기존 직계 solidFill 제거
    Array.from(rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'solidFill'))
        .filter(f => f.parentNode === rPr)
        .forEach(f => rPr.removeChild(f));

    if (!token) return;

    const solidFill = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:solidFill');

    if (/^[0-9a-fA-F]{6}$/.test(token)) {
        const srgbClr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:srgbClr');
        srgbClr.setAttribute('val', token.toUpperCase());
        solidFill.appendChild(srgbClr);
    } else {
        const parts = token.split('.');
        const name = parts[0].toLowerCase();
        // 유효한 scheme 이름만 허용 (LLM이 토큰을 변형한 경우 색 적용 생략)
        if (!/^(bg1|bg2|tx1|tx2|dk1|dk2|lt1|lt2|accent[1-6]|hlink|folHlink|phClr)$/.test(name)) return;
        const schemeClr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:schemeClr');
        schemeClr.setAttribute('val', name);
        for (const mod of parts.slice(1)) {
            const m = mod.match(/^(lm|lo)(\d+)$/);
            if (!m) continue;
            const el = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, m[1] === 'lm' ? 'a:lumMod' : 'a:lumOff');
            el.setAttribute('val', m[2]);
            schemeClr.appendChild(el);
        }
        solidFill.appendChild(schemeClr);
    }

    // OOXML 스키마 순서상 fill은 폰트 정의(latin 등)보다 앞에 와야 함
    if (rPr.firstChild) {
        rPr.insertBefore(solidFill, rPr.firstChild);
    } else {
        rPr.appendChild(solidFill);
    }
};

/**
 * 태그가 포함된 텍스트를 파싱하여 PPTX XML 노드(a:r)로 변환합니다.
 * @param xmlDoc XML Document
 * @param text 번역된 텍스트 (태그 포함)
 * @param defaultProps 원본 스타일 속성 (대표 rPr 클론)
 * @param szScale 명시 폰트 크기(sz)에 곱할 축소 비율 (표 셀 등 normAutofit이 안 통하는 곳용)
 */
const createRunsFromTaggedText = (xmlDoc: Document, text: string, defaultProps?: Element, szScale: number = 1.0): Node[] => {
    const nodes: Node[] = [];
    const stack: StyleFrame[] = [];

    const currentStyles = () => ({
        b: stack.some(f => f.tag === 'b'),
        i: stack.some(f => f.tag === 'i'),
        u: stack.some(f => f.tag === 'u'),
        color: [...stack].reverse().find(f => f.tag === 'color')?.color || '',
    });

    const popLast = (tag: StyleFrame['tag']) => {
        for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].tag === tag) {
                stack.splice(k, 1);
                return;
            }
        }
    };

    const emitText = (raw: string) => {
        if (!raw) return;
        const content = decodeEntities(raw);
        const styles = currentStyles();

        const rNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:r");
        let rPr: Element;

        if (defaultProps) {
            rPr = defaultProps.cloneNode(true) as Element;

            // 표 셀 등: 명시 sz 직접 축소
            const currentSize = parseInt(rPr.getAttribute('sz') || '0');
            if (currentSize > 0 && szScale < 1.0) {
                const newSize = Math.floor(currentSize * szScale);
                rPr.setAttribute('sz', String(Math.max(newSize, 800)));
            }

            // 영문 번역 시 자간 설정이 좁으면 글자가 겹침 — 무조건 표준으로 리셋
            rPr.removeAttribute('spc');
        } else {
            rPr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:rPr");
        }

        // 태그 기반 스타일 적용. 명시적 "0"(비굵게 등)은 보존해야
        // 마스터/레이아웃에서 굵게가 상속되는 경우를 막을 수 있음
        if (styles.b) {
            rPr.setAttribute('b', '1');
        } else if (rPr.getAttribute('b') === '1') {
            rPr.removeAttribute('b');
        }

        if (styles.i) {
            rPr.setAttribute('i', '1');
        } else if (rPr.getAttribute('i') === '1') {
            rPr.removeAttribute('i');
        }

        if (styles.u) {
            rPr.setAttribute('u', 'sng');
        } else if (rPr.getAttribute('u')) {
            rPr.removeAttribute('u');
        }

        applyColorToken(xmlDoc, rPr, styles.color);

        rPr.setAttribute('lang', 'en-US');
        rPr.setAttribute('dirty', '0');

        rNode.appendChild(rPr);

        const tNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:t");
        tNode.textContent = content;
        rNode.appendChild(tNode);

        nodes.push(rNode);
    };

    const tagRe = /<[^<>]+>/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(text)) !== null) {
        emitText(text.slice(last, m.index));
        last = tagRe.lastIndex;

        const tag = m[0].toLowerCase().replace(/\s+/g, '');
        if (tag === '<br>' || tag === '<br/>') {
            nodes.push(xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:br"));
        } else if (tag === '<b>' || tag === '<strong>') {
            stack.push({ tag: 'b' });
        } else if (tag === '<i>' || tag === '<em>') {
            stack.push({ tag: 'i' });
        } else if (tag === '<u>') {
            stack.push({ tag: 'u' });
        } else if (tag.startsWith('<color:')) {
            stack.push({ tag: 'color', color: m[0].slice(7, -1).trim() });
        } else if (tag === '</b>' || tag === '</strong>') {
            popLast('b');
        } else if (tag === '</i>' || tag === '</em>') {
            popLast('i');
        } else if (tag === '</u>') {
            popLast('u');
        } else if (tag.startsWith('</color')) {
            popLast('color');
        }
        // 그 외 알 수 없는 태그는 무시 (LLM 노이즈 방어)
    }
    emitText(text.slice(last));

    return nodes;
};

// ============================================================
// 오버플로우 축소 (텍스트박스 용량 기반)
// ============================================================

const EMU_PER_PT = 12700;
// 기본 텍스트박스 내부 여백 (lIns/rIns 91440 EMU = 7.2pt, tIns/bIns 45720 EMU = 3.6pt)
const INSET_X_PT = 14.4;
const INSET_Y_PT = 7.2;
// 평균 글자폭/줄높이 휴리스틱 (폰트 pt 대비)
const CHAR_WIDTH_RATIO = 0.52;      // 영문 반각
const KO_CHAR_WIDTH_RATIO = 0.95;   // 한글 전각
const LINE_HEIGHT_RATIO = 1.22;

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '');

/**
 * 도형 크기와 폰트 크기로 박스가 수용 가능한 글자 수를 추정합니다.
 * @param extent 도형 크기 (EMU)
 * @param fontSzHundredths 폰트 크기 (1/100pt, 예: 1100 = 11pt)
 */
export const estimateCapacityChars = (
    extent: { cx: number; cy: number },
    fontSzHundredths: number,
): number | null => {
    const fontPt = fontSzHundredths / 100;
    if (fontPt <= 0) return null;
    const usableW = extent.cx / EMU_PER_PT - INSET_X_PT;
    const usableH = extent.cy / EMU_PER_PT - INSET_Y_PT;
    if (usableW <= 0 || usableH <= 0) return null;
    const charsPerLine = Math.floor(usableW / (CHAR_WIDTH_RATIO * fontPt));
    const lines = Math.max(1, Math.floor(usableH / (LINE_HEIGHT_RATIO * fontPt)));
    return Math.max(1, charsPerLine * lines);
};

const findAncestorByLocalName = (node: Element, localName: string): Element | null => {
    let cur: Element | null = node.parentElement;
    while (cur) {
        if (cur.localName === localName || cur.tagName.endsWith(`:${localName}`)) return cur;
        cur = cur.parentElement;
    }
    return null;
};

/** 도형(p:sp)의 spPr > xfrm > ext에서 크기(EMU)를 읽습니다. */
export const getShapeExtent = (txBody: Element): { cx: number; cy: number } | null => {
    const sp = txBody.parentElement;
    if (!sp) return null;
    const spPr = Array.from(sp.children).find(c => c.localName === 'spPr' || c.tagName.endsWith(':spPr'));
    if (!spPr) return null;
    const xfrm = spPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'xfrm')[0];
    if (!xfrm) return null;
    const ext = xfrm.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'ext')[0];
    if (!ext) return null;
    const cx = parseInt(ext.getAttribute('cx') || '0');
    const cy = parseInt(ext.getAttribute('cy') || '0');
    if (cx <= 0 || cy <= 0) return null;
    return { cx, cy };
};

/**
 * 표 셀이 속한 열의 너비(pt)를 구합니다. (gridSpan 병합 셀은 합산)
 */
const getCellColumnWidthPt = (tc: Element): number | null => {
    const tr = tc.parentElement;
    if (!tr || tr.localName !== 'tr') return null;
    const tbl = tr.parentElement;
    if (!tbl || tbl.localName !== 'tbl') return null;

    let colIdx = 0;
    for (const sib of Array.from(tr.children)) {
        if (sib === tc) break;
        if (sib.localName === 'tc') colIdx += parseInt(sib.getAttribute('gridSpan') || '1');
    }
    const grid = tbl.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tblGrid')[0];
    if (!grid) return null;
    const cols = Array.from(grid.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'gridCol'));
    const span = parseInt(tc.getAttribute('gridSpan') || '1');
    let w = 0;
    for (let k = colIdx; k < Math.min(colIdx + span, cols.length); k++) {
        w += parseInt(cols[k].getAttribute('w') || '0');
    }
    return w > 0 ? w / EMU_PER_PT : null;
};

/** 문단들에서 명시된 최대 폰트 크기(sz, 1/100pt)를 찾습니다. */
const getMaxFontSize = (pNodes: Element[]): number | null => {
    let max = 0;
    for (const pNode of pNodes) {
        for (const rPr of Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr'))) {
            const sz = parseInt(rPr.getAttribute('sz') || '0');
            if (sz > max) max = sz;
        }
    }
    return max > 0 ? max : null;
};

interface BodyPlan {
    /** 도형: normAutofit fontScale로 적용 (100000 = 100%) */
    fontScale: number;
    /** 표 셀: run 명시 sz에 곱하는 비율 */
    szScale: number;
    /** 확장 비율 (번역/원본 글자수) */
    ratio: number;
}

/**
 * txBody 단위로 축소 계획을 세웁니다.
 * - 도형 + 크기 정보 있음: 박스 용량(글자수) 추정 → 넘칠 때만 √(용량/글자수)로 축소
 * - 도형 + 크기 정보 없음: 확장비 기반 보수적 축소
 * - 표 셀: normAutofit이 무시되므로 run sz 직접 축소 (행 높이는 자동 증가하므로 √ 완화)
 */
const planBodyScaling = (
    isTableCell: boolean,
    totalOrig: number,
    totalTrans: number,
    extent: { cx: number; cy: number } | null,
    maxSz: number | null,
    cellColWPt: number | null = null,
): BodyPlan => {
    const ratio = totalOrig > 0 ? totalTrans / totalOrig : 1.0;
    const plan: BodyPlan = { fontScale: 100000, szScale: 1.0, ratio };

    if (ratio <= 1.15 || totalTrans < 4) return plan;

    if (isTableCell) {
        // 열 너비 기반: 영문이 "원본 한글 줄수 + 1줄" 안에 들어가면 축소하지 않음
        // (행 높이는 자동으로 늘어나므로 폭만이 실질 제약)
        if (cellColWPt && maxSz) {
            const fontPt = maxSz / 100;
            const usableW = cellColWPt - INSET_X_PT;
            if (usableW > 2) {
                const origLines = Math.max(1, Math.ceil(totalOrig * KO_CHAR_WIDTH_RATIO * fontPt / usableW));
                const allowedLines = origLines + 1;
                // 영문 줄수(s배 폰트) = totalTrans×0.52×fontPt×s / usableW ≤ allowedLines
                const sFit = (allowedLines * usableW) / (totalTrans * CHAR_WIDTH_RATIO * fontPt);
                plan.szScale = Math.max(0.75, Math.min(1.0, sFit));
                return plan;
            }
        }
        // 폭 정보 없을 때 폴백: 확장비 기반 완만 축소
        plan.szScale = Math.max(0.75, Math.min(1.0, Math.sqrt(1 / ratio)));
        return plan;
    }

    if (extent && maxSz) {
        const capacity = estimateCapacityChars(extent, maxSz);
        if (capacity !== null) {
            if (totalTrans > capacity) {
                // 폰트를 s배 하면 수용량은 1/s² → s = √(용량/글자수)
                const s = Math.max(0.6, Math.min(1.0, Math.sqrt(capacity / totalTrans)));
                plan.fontScale = Math.round(s * 100000);
            }
            return plan; // 용량 내에 들어가면 축소하지 않음 (넓은 박스 보호)
        }
    }

    // 크기 정보를 못 얻은 경우: 확장비 기반 폴백
    const s = Math.max(0.7, Math.min(1.0, 1 / ratio));
    plan.fontScale = Math.round(s * 100000);
    return plan;
};

/**
 * 영어 단어 단위 줄바꿈 강제.
 * 한국어 환경에서 만든 텍스트박스는 latinLnBrk="1"(단어 중간 잘림 허용)이
 * 기본이라, 영문 번역 후 단어가 중간에서 끊겨 가독성을 해침.
 */
const ensureLatinWordWrap = (xmlDoc: Document, pNode: Element): void => {
    let pPr = Array.from(pNode.childNodes)
        .find(n => n.nodeName === 'a:pPr') as Element | undefined;
    if (!pPr) {
        pPr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:pPr');
        pNode.insertBefore(pPr, pNode.firstChild); // pPr은 a:p의 첫 자식이어야 함
    }
    pPr.setAttribute('latinLnBrk', '0');
};

/**
 * P3 Fix: 영문 번역 시 줄간격을 한 단계 낮춤 (1.5→1.2, 1.2→1.0)
 * 한국어 넓은 줄간격이 영문 번역 후 텍스트 박스 초과를 유발
 */
const adjustLineSpacing = (pNode: Element): void => {
    const pPr = pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'pPr')[0];
    if (!pPr) return;
    const lnSpc = pPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'lnSpc')[0];
    if (!lnSpc) return;
    const spcPct = lnSpc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'spcPct')[0];
    if (!spcPct) return;
    const val = parseInt(spcPct.getAttribute('val') || '0');
    if (val >= 150000) {
        spcPct.setAttribute('val', '120000'); // 1.5 → 1.2
    } else if (val >= 120000) {
        spcPct.setAttribute('val', '100000'); // 1.2 → 1.0
    }
};

/** txBody의 bodyPr에 normAutofit fontScale을 기록합니다. (spAutoFit이면 도형이 자라므로 생략) */
const applyAutofit = (xmlDoc: Document, txBody: Element, fontScale: number): void => {
    const bodyPr = txBody.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'bodyPr')[0];
    if (!bodyPr) return;

    const spAutoFit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'spAutoFit')[0];
    if (spAutoFit) return;

    const noAutofit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'noAutofit')[0];
    if (noAutofit) bodyPr.removeChild(noAutofit);

    const lnSpcReduction = fontScale < 80000 ? '10000' : '0';
    const existing = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit')[0];
    if (existing) {
        existing.setAttribute('fontScale', String(fontScale));
        existing.setAttribute('lnSpcReduction', lnSpcReduction);
    } else {
        const normAutofit = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:normAutofit');
        normAutofit.setAttribute('fontScale', String(fontScale));
        normAutofit.setAttribute('lnSpcReduction', lnSpcReduction);
        bodyPr.appendChild(normAutofit);
    }
};

/**
 * 번역된 텍스트를 원본 파일에 덮어씁니다.
 */
export const replaceTextInPptx = async (originalFile: File, translatedItems: TextItem[]): Promise<Blob> => {
    const zip = await JSZip.loadAsync(originalFile);
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const itemsBySlide: { [key: string]: TextItem[] } = {};
    for (const item of translatedItems) {
        if (!itemsBySlide[item.slidePath]) {
            itemsBySlide[item.slidePath] = [];
        }
        itemsBySlide[item.slidePath].push(item);
    }

    for (const slidePath in itemsBySlide) {
        const slideXml = await zip.file(slidePath)!.async('string');
        const xmlDoc = parser.parseFromString(slideXml, 'application/xml');

        const paragraphNodes = xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p');

        // ---- 1단계: txBody 단위로 항목을 묶어 확장량 집계 ----
        interface BodyGroup {
            txBody: Element;
            isTableCell: boolean;
            cellColWPt: number | null;
            pNodes: Element[];
            totalOrig: number;
            totalTrans: number;
        }
        const groups = new Map<Element, BodyGroup>();
        const itemBody = new Map<TextItem, BodyGroup>();

        for (const item of itemsBySlide[slidePath]) {
            const pNode = paragraphNodes[item.paragraphIndex];
            if (!pNode) continue;
            const txBody = findAncestorByLocalName(pNode, 'txBody');
            if (!txBody) continue;

            let group = groups.get(txBody);
            if (!group) {
                const tc = findAncestorByLocalName(txBody, 'tc');
                group = {
                    txBody,
                    isTableCell: tc !== null,
                    cellColWPt: tc ? getCellColumnWidthPt(tc) : null,
                    pNodes: [],
                    totalOrig: 0,
                    totalTrans: 0,
                };
                groups.set(txBody, group);
            }
            group.pNodes.push(pNode);
            const transLen = stripTags(item.text).length;
            group.totalTrans += transLen;
            group.totalOrig += item.originalLength ?? transLen;
            itemBody.set(item, group);
        }

        // ---- 2단계: txBody별 축소 계획 수립 ----
        const plans = new Map<Element, BodyPlan>();
        for (const group of groups.values()) {
            const extent = group.isTableCell ? null : getShapeExtent(group.txBody);
            const maxSz = getMaxFontSize(group.pNodes);
            plans.set(group.txBody, planBodyScaling(
                group.isTableCell, group.totalOrig, group.totalTrans, extent, maxSz, group.cellColWPt,
            ));
        }

        // ---- 3단계: 문단 치환 ----
        for (const item of itemsBySlide[slidePath]) {
            const pNode = paragraphNodes[item.paragraphIndex];
            if (!pNode) continue;

            const group = itemBody.get(item);
            const plan = group ? plans.get(group.txBody) : undefined;

            // 영문은 단어 단위로 줄바꿈 (한국어 텍스트박스의 단어 중간 잘림 설정 해제)
            ensureLatinWordWrap(xmlDoc, pNode);

            // 줄간격 축소는 실제로 확장된 경우에만
            if (plan && plan.ratio > 1.2) {
                adjustLineSpacing(pNode);
            }

            // 기존 Run 및 Break 모두 제거 준비
            const children = Array.from(pNode.childNodes);
            const targetNodes = children.filter(n => n.nodeName === 'a:r' || n.nodeName === 'a:br');

            // 대표 스타일(Representative RPr): 공백이 아닌 실제 텍스트가 있는 첫 Run의 스타일
            let representativeRPr: Element | undefined;
            const runNodes = Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'r'));
            for (const r of runNodes) {
                const text = r.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0]?.textContent || '';
                if (text.trim().length > 0) {
                    representativeRPr = r.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
                    break;
                }
            }
            if (!representativeRPr) {
                representativeRPr = runNodes[0]?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
            }

            const defaultProps = representativeRPr ? representativeRPr.cloneNode(true) as Element : undefined;

            // 색상 전염 방지: 대표 스타일의 fill 제거.
            // 색상은 <color:> 태그가 있을 때만 run별로 부여 (scheme 색상도 태그로 보존되므로 안전)
            if (defaultProps) {
                ['solidFill', 'gradFill', 'pattFill', 'blipFill', 'noFill'].forEach(fillType => {
                    Array.from(defaultProps.getElementsByTagNameNS(DRAWINGML_NAMESPACE, fillType))
                        .filter(node => node.parentNode === defaultProps)
                        .forEach(node => defaultProps.removeChild(node));
                });
            }

            targetNodes.forEach(n => pNode.removeChild(n));

            // 표 셀이면 run sz 직접 축소, 도형이면 normAutofit으로 처리하므로 1.0
            const szScale = group?.isTableCell ? (plan?.szScale ?? 1.0) : 1.0;
            const newNodes = createRunsFromTaggedText(xmlDoc, item.text, defaultProps, szScale);

            const endParaRunPr = pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'endParaRPr')[0];
            newNodes.forEach(node => {
                if (endParaRunPr) {
                    pNode.insertBefore(node, endParaRunPr);
                } else {
                    pNode.appendChild(node);
                }
            });
        }

        // ---- 4단계: 도형 txBody에 normAutofit 적용 ----
        for (const group of groups.values()) {
            const plan = plans.get(group.txBody);
            if (!plan || group.isTableCell) continue;
            if (plan.fontScale < 100000) {
                applyAutofit(xmlDoc, group.txBody, plan.fontScale);
            }
        }

        const newXmlString = serializer.serializeToString(xmlDoc);
        zip.file(slidePath, newXmlString);
    }

    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
};
