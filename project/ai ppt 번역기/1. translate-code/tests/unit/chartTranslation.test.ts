/**
 * 차트(chartN.xml) 번역 테스트 — 카테고리/계열명은 번역, 숫자 데이터는 보존
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractTextFromPptx, replaceTextInPptx, TextItem, CHART_STR_INDEX_BASE } from '@src/services/pptxService';
import { abbreviateForFit } from '@src/services/aiProvider';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="540000"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="ko-KR" sz="1400"/><a:t>슬라이드 제목</a:t></a:r></a:p></p:txBody>
</p:sp>
</p:spTree></p:cSld>
</p:sld>`;

const SLIDE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

const CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:rPr lang="ko-KR"/><a:t>안전성숙도 추이</a:t></a:r></a:p></c:rich></c:tx></c:title>
<c:plotArea>
<c:barChart><c:ser>
<c:tx><c:strRef><c:f>S1</c:f><c:strCache><c:pt idx="0"><c:v>안전점수</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:cat><c:strRef><c:f>C1</c:f><c:strCache>
<c:pt idx="0"><c:v>레미콘</c:v></c:pt>
<c:pt idx="1"><c:v>골재</c:v></c:pt>
<c:pt idx="2"><c:v>Aggregate</c:v></c:pt>
</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>V1</c:f><c:numCache>
<c:pt idx="0"><c:v>2.61</c:v></c:pt>
<c:pt idx="1"><c:v>2.74</c:v></c:pt>
</c:numCache></c:numRef></c:val>
</c:ser></c:barChart>
</c:plotArea>
</c:chart>
</c:chartSpace>`;

const buildPptx = async (): Promise<File> => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', SLIDE_XML);
    zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS);
    zip.file('ppt/charts/chart1.xml', CHART_XML);
    return (await zip.generateAsync({ type: 'uint8array' })) as unknown as File;
};

const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

describe('차트 번역', () => {
    it('차트 제목(리치텍스트)과 한글 라벨(strCache)을 추출한다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);

        const texts = items.map(i => i.text);
        expect(texts).toContain('안전성숙도 추이');   // c:rich 안 a:p
        expect(texts).toContain('안전점수');           // 계열명 c:v
        expect(texts).toContain('레미콘');             // 카테고리 c:v
        expect(texts).toContain('골재');
        // 숫자와 영문 라벨은 추출하지 않음
        expect(texts).not.toContain('2.61');
        expect(texts).not.toContain('Aggregate');
    });

    it('차트 라벨을 치환하고 숫자 데이터는 보존한다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const map: Record<string, string> = {
            '안전성숙도 추이': 'Safety Maturity Trend',
            '안전점수': 'Safety Score',
            '레미콘': 'Remicon',
            '골재': 'Aggregate',
            '슬라이드 제목': 'Slide Title',
        };
        const translated: TextItem[] = items.map(it => ({
            ...it,
            text: map[it.text] ?? it.text,
            originalLength: it.text.length,
        }));

        const blob = await replaceTextInPptx(file, translated);
        const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
        const chartXml = await zip.file('ppt/charts/chart1.xml')!.async('string');

        expect(chartXml).toContain('Safety Maturity Trend');
        expect(chartXml).toContain('Safety Score');
        expect(chartXml).toContain('Remicon');
        expect(chartXml).not.toContain('레미콘');
        expect(chartXml).not.toContain('안전점수');
        // 숫자 데이터 무결성
        expect(chartXml).toContain('<c:v>2.61</c:v>');
        expect(chartXml).toContain('<c:v>2.74</c:v>');
    });

    it('차트 c:v 항목은 인덱스 오프셋으로 구분된다', async () => {
        const file = await buildPptx();
        const items = await extractTextFromPptx(file);
        const chartStrItems = items.filter(i => i.paragraphIndex >= CHART_STR_INDEX_BASE);
        expect(chartStrItems.length).toBe(3); // 안전점수, 레미콘, 골재
        chartStrItems.forEach(i => expect(i.slidePath).toBe('ppt/charts/chart1.xml'));
    });
});

describe('abbreviateForFit (약어 사다리)', () => {
    it('표준 약어로 치환한다', () => {
        expect(abbreviateForFit('Risk Management and Safety Department'))
            .toBe('Risk Mgmt & Safety Dept.');
    });

    it('해당 없으면 원문 유지', () => {
        expect(abbreviateForFit('Safety Maturity')).toBe('Safety Maturity');
    });
});
