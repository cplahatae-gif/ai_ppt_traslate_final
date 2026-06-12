/**
 * pptxService 라운드트립 테스트
 * - scheme/srgb 색상 보존 (lumMod 변형 포함)
 * - </color> 이후 텍스트에 색상이 전염되지 않는지 (구 HTML 파서 버그 회귀 방지)
 * - 오버플로우 시 normAutofit fontScale 적용 (도형) / 명시 sz 축소 (표 셀)
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractTextFromPptx, replaceTextInPptx, TextItem } from '@src/services/pptxService';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1440000" cy="540000"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/>
<a:p>
<a:r><a:rPr lang="ko-KR" sz="1100" b="0"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr><a:t>흰색텍스트</a:t></a:r>
<a:r><a:rPr lang="ko-KR" sz="1100"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></a:rPr><a:t>회색텍스트</a:t></a:r>
<a:r><a:rPr lang="ko-KR" sz="1100"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:rPr><a:t>파란텍스트</a:t></a:r>
</a:p>
</p:txBody>
</p:sp>
<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
<a:tbl><a:tr h="370840"><a:tc>
<a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="ko-KR" sz="1200"/><a:t>셀텍스트</a:t></a:r></a:p></a:txBody>
<a:tcPr/></a:tc></a:tr></a:tbl>
</a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld>
</p:sld>`;

const buildPptx = async (): Promise<File> => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', SLIDE_XML);
    const buf = await zip.generateAsync({ type: 'uint8array' });
    return buf as unknown as File;
};

// jsdom Blob에는 arrayBuffer()가 없어 FileReader로 변환
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

const readSlide = async (blob: Blob): Promise<string> => {
    const buf = await blobToArrayBuffer(blob);
    const zip = await JSZip.loadAsync(buf);
    return zip.file('ppt/slides/slide1.xml')!.async('string');
};

describe('색상 보존', () => {
    it('scheme 색상(lumMod 포함)과 srgb 색상을 모두 태그로 추출한다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);

        expect(items[0].text).toBe(
            '<color:bg1>흰색텍스트</color><color:tx1.lm50000>회색텍스트</color><color:0000FF>파란텍스트</color>'
        );
    });

    it('identity 라운드트립에서 scheme/srgb 색상이 XML에 복원된다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = items.map(it => ({
            ...it,
            originalLength: it.text.replace(/<[^>]*>/g, '').length,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);

        expect(xml).toContain('<a:schemeClr val="bg1"/>');
        expect(xml).toContain('<a:schemeClr val="tx1"><a:lumMod val="50000"/></a:schemeClr>');
        expect(xml).toContain('<a:srgbClr val="0000FF"/>');
    });

    it('고정점: 추출→재조립→재추출 결과가 동일하다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = items.map(it => ({
            ...it,
            originalLength: it.text.replace(/<[^>]*>/g, '').length,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const rebuilt = (await blobToArrayBuffer(blob)) as unknown as File;
        const reExtracted = await extractTextFromPptx(rebuilt);

        expect(reExtracted.map(i => i.text)).toEqual(items.map(i => i.text));
    });

    it('</color> 이후 텍스트에 색상이 전염되지 않는다 (회귀 방지)', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = [{
            ...items[0],
            text: '<color:0000FF>Red part</color> uncolored tail',
            originalLength: 20,
        }];

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
        const runs = Array.from(doc.getElementsByTagNameNS(NS, 'r'))
            .filter(r => r.parentElement?.parentElement?.parentElement?.localName !== 'tc');

        const tailRun = runs.find(r =>
            r.getElementsByTagNameNS(NS, 't')[0]?.textContent?.includes('uncolored tail'));
        expect(tailRun).toBeDefined();
        const tailRPr = tailRun!.getElementsByTagNameNS(NS, 'rPr')[0];
        const directFills = Array.from(tailRPr.getElementsByTagNameNS(NS, 'solidFill'))
            .filter(f => f.parentNode === tailRPr);
        expect(directFills.length).toBe(0);
    });

    it('번역 문단에 영어 단어 단위 줄바꿈(latinLnBrk="0")이 강제된다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = items.map(it => ({
            ...it,
            text: 'Translated English text',
            originalLength: 10,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);
        expect(xml).toContain('latinLnBrk="0"');
        expect(xml).not.toContain('latinLnBrk="1"');
    });

    it('명시적 b="0"이 보존된다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = items.map(it => ({
            ...it,
            originalLength: it.text.replace(/<[^>]*>/g, '').length,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);
        expect(xml).toMatch(/b="0"/);
    });
});

describe('오버플로우 축소', () => {
    it('박스 용량 초과 시 도형 txBody에 normAutofit fontScale을 기록한다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        // 박스(113pt×42.5pt, 11pt 폰트 → 용량 약 34자)를 크게 초과하는 긴 번역
        const longText = 'This is a very long English translation that greatly exceeds the tiny box capacity for sure';
        const translated: TextItem[] = [{
            ...items[0],
            text: longText,
            originalLength: 15,
        }];

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);

        const m = xml.match(/fontScale="(\d+)"/);
        expect(m).not.toBeNull();
        const scale = parseInt(m![1]);
        expect(scale).toBeLessThan(100000);
        expect(scale).toBeGreaterThanOrEqual(60000);
    });

    it('확장비가 1.15 이하면 축소하지 않는다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = items.map(it => ({
            ...it,
            originalLength: it.text.replace(/<[^>]*>/g, '').length,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);
        expect(xml).not.toContain('fontScale');
    });

    it('표 셀(열너비 정보 없음)은 폴백으로 명시 sz를 축소한다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const cellItem = items.find(it => it.text.includes('셀텍스트'))!;
        const translated: TextItem[] = [{
            ...cellItem,
            text: 'A very long translated cell content that is much longer than the original',
            originalLength: 4,
        }];

        const blob = await replaceTextInPptx(file, translated);
        const xml = await readSlide(blob);

        // 1200 → 폴백 szScale 하한 0.75 → 900
        expect(xml).toContain('sz="900"');
    });

    it('여백 0인 초소형 라벨 박스는 명시 여백으로 용량 계산 (高→High 과축소 회귀 방지)', async () => {
        // 20pt×22pt 박스 + lIns/rIns/tIns/bIns=0 — 기본 여백 가정 시 가용폭이 음수가 되어 과축소됨
        const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="254000" cy="279400"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/>
<a:p><a:r><a:rPr lang="ko-KR" sz="1100"/><a:t>高</a:t></a:r></a:p>
</p:txBody>
</p:sp>
</p:spTree></p:cSld>
</p:sld>`;
        const zip = new JSZip();
        zip.file('ppt/slides/slide1.xml', xml);
        const file = (await zip.generateAsync({ type: 'uint8array' })) as unknown as File;

        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = [{
            ...items[0],
            text: 'High',
            originalLength: 1,
        }];

        const blob = await replaceTextInPptx(file, translated);
        const outXml = await readSlide(blob);
        const m = outXml.match(/fontScale="(\d+)"/);
        // 실제 여백(0) 기준 용량 ≈ 3자 → 'High'(4자) → √(3/4) ≈ 0.87 — 완만한 축소
        if (m) {
            expect(parseInt(m[1])).toBeGreaterThanOrEqual(80000);
        }
    });

    it('넓은 열의 표 셀은 글자수가 늘어도 폰트를 축소하지 않는다 (열너비 기반)', async () => {
        // tblGrid 포함 + 넓은 열(283pt) — '구분'→'Category' 과축소 회귀 방지
        const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
<a:tbl><a:tblGrid><a:gridCol w="3600000"/></a:tblGrid><a:tr h="370840"><a:tc>
<a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="ko-KR" sz="1100"/><a:t>구분</a:t></a:r></a:p></a:txBody>
<a:tcPr/></a:tc></a:tr></a:tbl>
</a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld>
</p:sld>`;
        const zip = new JSZip();
        zip.file('ppt/slides/slide1.xml', xml);
        const file = (await zip.generateAsync({ type: 'uint8array' })) as unknown as File;

        const items = await extractTextFromPptx(file);
        const translated: TextItem[] = [{
            ...items[0],
            text: 'Category', // 2자→8자 (비율 4배)지만 열이 넓어 한 줄에 들어감
            originalLength: 2,
        }];

        const blob = await replaceTextInPptx(file, translated);
        const outXml = await readSlide(blob);
        expect(outXml).toContain('sz="1100"'); // 축소 없음
    });
});
