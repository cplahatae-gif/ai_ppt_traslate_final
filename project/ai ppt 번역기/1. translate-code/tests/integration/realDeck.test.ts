/**
 * 실제 보고서 덱 회귀 테스트 (로컬 전용 — 파일 없으면 자동 스킵)
 *
 * 고정점 검증: 추출 → 무번역 재조립 → 재추출 결과가 원본 추출과 동일해야
 * 색상(scheme/srgb)·굵게·줄바꿈이 완벽 보존된 것이다.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import JSZip from 'jszip';
import { extractTextFromPptx, replaceTextInPptx, TextItem } from '@src/services/pptxService';

const DECK_PATH = '/Users/hatae/임시작업/번역기/test-files/original.pptx';
const hasDeck = fs.existsSync(DECK_PATH);

// jsdom Blob에는 arrayBuffer()가 없어 FileReader로 변환
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

describe.skipIf(!hasDeck)('실제 덱 (삼표 안전성숙도 보고서 21p)', () => {
    it('identity 라운드트립 고정점: 색상/스타일 태그가 보존된다', async () => {
        const buf = fs.readFileSync(DECK_PATH);
        const file = new Uint8Array(buf) as unknown as File;

        const items = await extractTextFromPptx(file);
        expect(items.length).toBeGreaterThan(100);

        // 원본에 scheme 색상 태그가 추출되는지 (슬라이드 2의 bg2 등)
        const allText = items.map(i => i.text).join('\n');
        expect(allText).toContain('<color:bg1>');
        expect(allText).toContain('<color:bg2');
        expect(allText).toContain('<color:tx1');

        const translated: TextItem[] = items.map(it => ({
            ...it,
            originalLength: it.text.replace(/<[^>]*>/g, '').length,
        }));
        const blob = await replaceTextInPptx(file, translated);
        const rebuilt = new Uint8Array(await blobToArrayBuffer(blob)) as unknown as File;
        const reExtracted = await extractTextFromPptx(rebuilt);

        expect(reExtracted.length).toBe(items.length);
        const mismatches = items
            .map((it, i) => ({ orig: it.text, re: reExtracted[i]?.text, slide: it.slideNumber }))
            .filter(x => x.orig !== x.re);
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(mismatches.length).toBe(0);
    }, 120000);

    it('2.5배 확장 시 축소가 작동하고 색상은 유지된다', async () => {
        const buf = fs.readFileSync(DECK_PATH);
        const file = new Uint8Array(buf) as unknown as File;

        const items = await extractTextFromPptx(file);
        // 텍스트를 2.5배로 뻥튀기 (태그는 유지)
        const translated: TextItem[] = items.map(it => {
            const stripped = it.text.replace(/<[^>]*>/g, '');
            const expanded = it.text + ' ' + stripped + ' ' + stripped.slice(0, Math.floor(stripped.length / 2));
            return { ...it, text: expanded, originalLength: stripped.length };
        });

        const blob = await replaceTextInPptx(file, translated);
        const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));

        let reducedFontScales = 0;
        let schemeColorRuns = 0;
        for (const path of Object.keys(zip.files)) {
            if (!path.match(/^ppt\/slides\/slide\d+\.xml$/)) continue;
            const xml = await zip.file(path)!.async('string');
            for (const m of xml.matchAll(/fontScale="(\d+)"/g)) {
                if (parseInt(m[1]) < 100000) reducedFontScales++;
            }
            schemeColorRuns += (xml.match(/<a:rPr[^>]*><a:solidFill><a:schemeClr/g) || []).length;
        }

        // 13p 강점/약점 박스 등에서 축소가 실제로 작동해야 함
        expect(reducedFontScales).toBeGreaterThan(10);
        // 확장 후에도 scheme 색상 run이 살아 있어야 함 (원본 262개, 병합 감안 100+)
        expect(schemeColorRuns).toBeGreaterThan(100);
    }, 120000);
});
