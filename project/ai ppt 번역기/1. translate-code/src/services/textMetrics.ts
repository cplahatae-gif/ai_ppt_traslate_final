/**
 * textMetrics - Canvas 기반 텍스트 폭 실측 (수준 1 시각 검증)
 *
 * 기존의 "글자당 폰트의 52% 폭" 휴리스틱 대신 브라우저 Canvas measureText로
 * 실제 폰트 메트릭을 측정합니다. Canvas를 쓸 수 없는 환경(테스트 등)에서는
 * 문자 종류별(한글 전각/영문 반각) 휴리스틱으로 폴백합니다.
 */

const CJK_RE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-｠]/;

const FALLBACK_CJK_RATIO = 0.95;   // 한글 전각: 폰트 pt 대비 글자폭
const FALLBACK_LATIN_RATIO = 0.52; // 영문 반각

let cachedCtx: CanvasRenderingContext2D | null | undefined;

const getCtx = (): CanvasRenderingContext2D | null => {
    if (cachedCtx !== undefined) return cachedCtx;
    try {
        cachedCtx = document.createElement('canvas').getContext('2d');
    } catch {
        cachedCtx = null;
    }
    return cachedCtx;
};

/**
 * 텍스트의 렌더링 폭(pt)을 측정합니다.
 * 폰트 크기 S에 비례하므로 px 단위로 S를 지정해 측정하면 수치가 pt 폭과 같음.
 */
export const measureWidthPt = (text: string, fontPt: number): number => {
    if (!text) return 0;
    const ctx = getCtx();
    if (ctx) {
        try {
            ctx.font = `${fontPt}px Arial, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`;
            const w = ctx.measureText(text).width;
            if (w > 0) return w;
        } catch {
            // 폴백으로 진행
        }
    }
    let w = 0;
    for (const ch of text) {
        w += (CJK_RE.test(ch) ? FALLBACK_CJK_RATIO : FALLBACK_LATIN_RATIO) * fontPt;
    }
    return w;
};

/**
 * 문단별 폭(pt at scale=1) 목록으로, scale 적용 시 필요한 줄 수를 계산합니다.
 */
export const linesNeededAtScale = (widthsPt: number[], scale: number, usableWPt: number): number => {
    if (usableWPt <= 0) return Number.POSITIVE_INFINITY;
    let lines = 0;
    for (const w of widthsPt) {
        if (w <= 0) continue;
        lines += Math.max(1, Math.ceil((w * scale) / usableWPt));
    }
    return Math.max(1, lines);
};

/**
 * 문단들이 박스(usableW × usableH)에 들어가는 최대 폰트 배율을 찾습니다.
 * @returns floor 이상에서 들어가는 최대 배율, floor로도 안 들어가면 null
 */
export const solveFitScale = (
    paraTexts: string[],
    fontPt: number,
    usableWPt: number,
    usableHPt: number,
    lineHeightRatio: number,
    floor: number,
): number | null => {
    if (usableWPt <= 0 || usableHPt <= 0 || fontPt <= 0) return null;
    const widths = paraTexts.map(t => measureWidthPt(t, fontPt));
    const lineH = lineHeightRatio * fontPt;

    const fits = (s: number): boolean =>
        linesNeededAtScale(widths, s, usableWPt) * lineH * s <= usableHPt;

    if (fits(1)) return 1;
    for (let s = 0.98; s >= floor - 1e-9; s -= 0.02) {
        if (fits(s)) return Math.round(s * 100) / 100;
    }
    return null;
};
