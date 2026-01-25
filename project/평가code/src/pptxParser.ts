/**
 * Module 1: PPTX Parser
 * PPTX 파일에서 텍스트, 스타일, 레이아웃 정보를 추출합니다.
 */

import JSZip from 'jszip';
import type {
    ParsedPPTX,
    ParsedSlide,
    TextItem,
    RunData,
    RunProperties,
    TableData,
    TableRow,
    TableCell
} from './types';

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATION_NAMESPACE = "http://schemas.openxmlformats.org/presentationml/2006/main";

/**
 * PPTX 파일을 파싱하여 모든 텍스트와 스타일 정보를 추출합니다.
 */
export async function parsePPTX(file: File): Promise<ParsedPPTX> {
    const zip = await JSZip.loadAsync(file);
    const allFiles = Object.keys(zip.files);

    // slide1.xml, slide2.xml ... 순서대로 정렬
    const slideFiles = allFiles
        .filter(path => path.match(/^ppt\/slides\/slide(\d+)\.xml$/))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
            return numA - numB;
        });

    const slides: ParsedSlide[] = [];
    const allTextItems: TextItem[] = [];
    const parser = new DOMParser();

    for (const slidePath of slideFiles) {
        const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/)![1]);
        const slideXml = await zip.file(slidePath)!.async('string');
        const xmlDoc = parser.parseFromString(slideXml, 'application/xml');

        const parsedSlide = parseSlide(xmlDoc, slidePath, slideNum);
        slides.push(parsedSlide);
        allTextItems.push(...parsedSlide.textItems);
    }

    return {
        fileName: file.name,
        slideCount: slides.length,
        slides,
        allTextItems,
    };
}

/**
 * 단일 슬라이드를 파싱합니다.
 */
function parseSlide(xmlDoc: Document, slidePath: string, slideNumber: number): ParsedSlide {
    const textItems: TextItem[] = [];

    // 모든 문단(p) 요소 추출
    const paragraphNodes = Array.from(xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'p'));

    paragraphNodes.forEach((pNode, paragraphIndex) => {
        const runNodes = Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'r'));
        if (runNodes.length === 0) return;

        const runs: RunData[] = [];
        let fullText = '';

        runNodes.forEach(rNode => {
            const tNode = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0];
            const text = tNode?.textContent || '';
            if (!text) return;

            fullText += text;
            const properties = extractRunProperties(rNode);

            runs.push({
                text,
                properties,
            });
        });

        if (fullText.trim() !== '') {
            textItems.push({
                slidePath,
                slideNumber,
                paragraphIndex,
                text: fullText,
                runs,
            });
        }
    });

    // 테이블 감지
    const tableNodes = xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tbl');
    const hasTable = tableNodes.length > 0;
    const tableData = hasTable ? parseTablesInSlide(xmlDoc, slideNumber) : undefined;

    return {
        slideNumber,
        slidePath,
        textItems,
        hasTable,
        tableData,
    };
}

/**
 * Run(a:r) 요소에서 스타일 속성을 추출합니다.
 */
function extractRunProperties(rNode: Element): RunProperties {
    const rPr = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];

    if (!rPr) {
        return {
            fontSize: null,
            bold: false,
            italic: false,
            fontFamily: null,
            color: null,
            lang: null,
            spacing: null,
        };
    }

    // 폰트 크기 (sz 속성, 1/100 pt 단위)
    const fontSize = rPr.getAttribute('sz') ? parseInt(rPr.getAttribute('sz')!) : null;

    // Bold / Italic
    const bold = rPr.getAttribute('b') === '1';
    const italic = rPr.getAttribute('i') === '1';

    // 언어 속성
    const lang = rPr.getAttribute('lang');

    // 텍스트 간격 (spc)
    const spacing = rPr.getAttribute('spc') ? parseInt(rPr.getAttribute('spc')!) : null;

    // 폰트 패밀리 (latin 또는 ea typeface)
    let fontFamily: string | null = null;
    const latinFont = rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'latin')[0];
    const eaFont = rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'ea')[0];
    if (latinFont) {
        fontFamily = latinFont.getAttribute('typeface');
    } else if (eaFont) {
        fontFamily = eaFont.getAttribute('typeface');
    }

    // 색상 (solidFill)
    let color: string | null = null;
    const solidFill = rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'solidFill')[0];
    if (solidFill) {
        const srgbClr = solidFill.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'srgbClr')[0];
        if (srgbClr) {
            color = srgbClr.getAttribute('val');
        }
    }

    return {
        fontSize,
        bold,
        italic,
        fontFamily,
        color,
        lang,
        spacing,
    };
}

/**
 * 슬라이드 내 테이블 데이터를 파싱합니다.
 */
function parseTablesInSlide(xmlDoc: Document, slideNumber: number): TableData[] {
    const tables: TableData[] = [];
    const tableNodes = xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tbl');

    Array.from(tableNodes).forEach(tblNode => {
        const rows: TableRow[] = [];
        const trNodes = tblNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tr');

        Array.from(trNodes).forEach(trNode => {
            const cells: TableCell[] = [];
            const tcNodes = trNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tc');

            Array.from(tcNodes).forEach(tcNode => {
                // 셀 내 텍스트 추출
                const textNodes = tcNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't');
                const text = Array.from(textNodes).map(t => t.textContent || '').join('');

                // 셀 크기 (gridCol에서 가져오거나 추정)
                const tcPr = tcNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'tcPr')[0];
                const width = tcPr?.getAttribute('w') ? parseInt(tcPr.getAttribute('w')!) : 0;
                const height = parseInt(trNode.getAttribute('h') || '0');

                cells.push({ text, width, height });
            });

            rows.push({ cells });
        });

        tables.push({ slideNumber, rows });
    });

    return tables;
}

/**
 * 두 PPTX 파일의 텍스트 매핑을 생성합니다.
 * 같은 슬라이드, 같은 위치의 텍스트를 매핑합니다.
 */
export function createTextMapping(
    koreanPPTX: ParsedPPTX,
    englishPPTX: ParsedPPTX
): { korean: TextItem; english: TextItem }[] {
    const mappings: { korean: TextItem; english: TextItem }[] = [];

    for (let i = 0; i < koreanPPTX.allTextItems.length; i++) {
        const korean = koreanPPTX.allTextItems[i];
        const english = englishPPTX.allTextItems[i];

        if (korean && english) {
            mappings.push({ korean, english });
        }
    }

    return mappings;
}

/**
 * 슬라이드 개수를 반환합니다.
 */
export async function countSlides(file: File): Promise<number> {
    const zip = await JSZip.loadAsync(file);
    const slidePaths = Object.keys(zip.files).filter(
        path => path.startsWith('ppt/slides/slide') && path.endsWith('.xml')
    );
    return slidePaths.length;
}

/**
 * PPTX에서 bodyPr (텍스트 박스 속성) 정보를 추출합니다.
 * normAutofit 등의 레이아웃 변경 감지에 사용됩니다.
 */
export async function extractBodyProperties(file: File): Promise<Map<string, {
    hasNormAutofit: boolean;
    hasSpAutoFit: boolean;
    hasNoAutofit: boolean;
}>> {
    const zip = await JSZip.loadAsync(file);
    const allFiles = Object.keys(zip.files);
    const parser = new DOMParser();

    const bodyPropsMap = new Map<string, {
        hasNormAutofit: boolean;
        hasSpAutoFit: boolean;
        hasNoAutofit: boolean;
    }>();

    const slideFiles = allFiles.filter(path =>
        path.match(/^ppt\/slides\/slide(\d+)\.xml$/)
    );

    for (const slidePath of slideFiles) {
        const slideXml = await zip.file(slidePath)!.async('string');
        const xmlDoc = parser.parseFromString(slideXml, 'application/xml');

        const bodyPrNodes = xmlDoc.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'bodyPr');

        Array.from(bodyPrNodes).forEach((bodyPr, index) => {
            const key = `${slidePath}:bodyPr:${index}`;

            const hasNormAutofit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit').length > 0;
            const hasSpAutoFit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'spAutoFit').length > 0;
            const hasNoAutofit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'noAutofit').length > 0;

            bodyPropsMap.set(key, {
                hasNormAutofit,
                hasSpAutoFit,
                hasNoAutofit,
            });
        });
    }

    return bodyPropsMap;
}
