/**
 * documentAudit 테스트 — 번역 완료 후 최종 PPTX 감사
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractTextFromPptx, replaceTextInPptx, TextItem } from '@src/services/pptxService';
import { auditDocument, remediateOverflows } from '@src/services/documentAudit';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="1080000"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/>
<a:p><a:r><a:rPr lang="ko-KR" sz="1400"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr><a:t>첫번째 문단입니다</a:t></a:r></a:p>
<a:p><a:r><a:rPr lang="ko-KR" sz="1400"/><a:t>두번째 문단입니다</a:t></a:r></a:p>
</p:txBody>
</p:sp>
</p:spTree></p:cSld>
</p:sld>`;

const buildPptx = async (): Promise<File> => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', SLIDE_XML);
    const buf = await zip.generateAsync({ type: 'uint8array' });
    return buf as unknown as File;
};

const translate = async (file: File, texts: string[]): Promise<{ blob: Blob; items: TextItem[] }> => {
    const extracted = await extractTextFromPptx(file);
    const items: TextItem[] = extracted.map((it, i) => ({
        ...it,
        text: texts[i] ?? it.text,
        originalLength: it.text.replace(/<[^>]*>/g, '').length,
    }));
    const blob = await replaceTextInPptx(file, items);
    return { blob, items };
};

describe('auditDocument', () => {
    it('정상 번역(색상 유지·영문·용량 내)은 이슈 0건', async () => {
        const file = await buildPptx();
        const { blob, items } = await translate(file, [
            '<color:bg1>First paragraph</color>',
            'Second paragraph',
        ]);

        const report = await auditDocument(blob, items, 1, 1);

        expect(report.checkedSlides).toBe(1);
        expect(report.issues).toEqual([]);
    });

    it('번역 텍스트의 색상 태그가 결과물에 없으면 color-loss 보고', async () => {
        const file = await buildPptx();
        // 색상 태그 없이 빌드해 놓고, 감사에는 "색상이 있어야 한다"고 주장하는 items를 전달
        const { blob } = await translate(file, ['First paragraph', 'Second paragraph']);
        const extracted = await extractTextFromPptx(file);
        const claimedItems: TextItem[] = extracted.map((it, i) => ({
            ...it,
            text: i === 0 ? '<color:bg1>First paragraph</color>' : 'Second paragraph',
        }));

        const report = await auditDocument(blob, claimedItems, 1, 1);

        expect(report.colorLossCount).toBe(1);
        expect(report.issues[0].type).toBe('color-loss');
        expect(report.issues[0].slideNumber).toBe(1);
    });

    it('결과물에 한글이 남아있으면 untranslated 보고', async () => {
        const file = await buildPptx();
        const { blob, items } = await translate(file, [
            '<color:bg1>First paragraph</color>',
            'Second 문단 partially translated',
        ]);

        const report = await auditDocument(blob, items, 1, 1);

        expect(report.untranslatedCount).toBe(1);
        expect(report.issues.find(i => i.type === 'untranslated')?.detail).toContain('문단');
    });

    it('축소 후에도 박스 용량을 크게 초과하면 overflow 보고 (항목 인덱스 포함)', async () => {
        const file = await buildPptx();
        const huge = 'A very long English sentence that absolutely will not fit in this box. '.repeat(20);
        const { blob, items } = await translate(file, [
            `<color:bg1>${huge}</color>`,
            'Second paragraph',
        ]);

        const report = await auditDocument(blob, items, 1, 1);

        expect(report.overflowCount).toBeGreaterThanOrEqual(1);
        const overflow = report.issues.find(i => i.type === 'overflow')!;
        expect(overflow.severity).toBe('high');
        expect(overflow.itemIndexes).toContain(0);
    });
});

describe('remediateOverflows (3단계 보정)', () => {
    const readSlide = async (blob: Blob): Promise<string> => {
        const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blob);
        });
        const zip = await JSZip.loadAsync(buf);
        return zip.file('ppt/slides/slide1.xml')!.async('string');
    };

    it('가벼운 초과는 글자크기 축소만으로 해결 (1단계)', async () => {
        const file = await buildPptx();
        // 용량(약 144자)의 2배 → s_fit ≈ 0.71 ≥ 0.6 → 글자 축소만
        const mild = 'This sentence is moderately long for the box capacity. '.repeat(5);
        const { blob, items } = await translate(file, [mild, 'Second paragraph']);

        const rem = await remediateOverflows(blob, items, 1, 1);

        expect(rem.boxesAdjusted).toBe(1);
        expect(rem.shortenItemIndexes).toEqual([]);
        const xml = await readSlide(rem.blob);
        const m = xml.match(/fontScale="(\d+)"/);
        expect(m).not.toBeNull();
        expect(parseInt(m![1])).toBeGreaterThanOrEqual(60000);
        // 박스 크기는 그대로
        expect(xml).toContain('cy="1080000"');
    });

    it('심한 초과는 박스 확대 + 글자 축소 병행 (2~3단계)', async () => {
        const file = await buildPptx();
        // 용량의 약 4배 → 글자 0.6 으로 부족 → 박스 확대 병행
        const heavy = 'A considerably longer English sentence that requires more remediation. '.repeat(8);
        const { blob, items } = await translate(file, [heavy, 'Second paragraph']);

        const rem = await remediateOverflows(blob, items, 1, 1);

        expect(rem.boxesAdjusted).toBe(1);
        expect(rem.shortenItemIndexes).toEqual([]);
        const xml = await readSlide(rem.blob);
        // 박스 높이가 커졌는지 (원본 1080000)
        const cy = parseInt(xml.match(/<a:ext cx="3600000" cy="(\d+)"/)![1]);
        expect(cy).toBeGreaterThan(1080000);
    });

    it('극단적 초과는 축약 재번역 대상으로 반환', async () => {
        const file = await buildPptx();
        // 용량의 10배 이상 → 보정 한도 초과 → 축약 필요
        const extreme = 'A very long English sentence that absolutely will not fit in this box. '.repeat(20);
        const { blob, items } = await translate(file, [extreme, 'Second paragraph']);

        const rem = await remediateOverflows(blob, items, 1, 1);

        expect(rem.shortenItemIndexes).toContain(0);
    });
});
