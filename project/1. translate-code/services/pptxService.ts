import JSZip from 'jszip';

export interface TextItem {
    slidePath: string;
    paragraphIndex: number;
    text: string; // HTML 태그가 포함된 텍스트 (예: "Hello <b>World</b>")
    slideNumber: number; // 슬라이드 번호 (1부터 시작)
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
            // 문단 내의 Run(<a:r>)들을 순회하며 스타일 정보를 확인
            const runNodes = Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'r'));
            if (runNodes.length === 0) return;

            let formattedText = '';
            let hasText = false;

            runNodes.forEach(rNode => {
                const tNode = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0];
                const text = tNode?.textContent || '';
                if (!text) return;

                hasText = true;

                // 스타일 확인 (rPr)
                const rPr = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
                const isBold = rPr?.getAttribute('b') === '1';
                const isItalic = rPr?.getAttribute('i') === '1';

                let chunk = text;
                // 태그 감싸기 (Gemini가 인식하도록)
                if (isBold) chunk = `<b>${chunk}</b>`;
                if (isItalic) chunk = `<i>${chunk}</i>`;

                formattedText += chunk;
            });

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

/**
 * 태그가 포함된 텍스트를 파싱하여 PPTX XML 노드(a:r)로 변환합니다.
 * DOMParser를 사용하여 중첩된 태그나 불완전한 HTML도 견고하게 처리합니다.
 */
const createRunsFromTaggedText = (xmlDoc: Document, text: string, defaultProps?: Element): Node[] => {
    const parser = new DOMParser();
    // HTML 파서를 사용하여 텍스트를 DOM 트리로 변환 (wrapper로 감싸서 처리)
    // <span> wrapper ensures a valid root for fragments
    const doc = parser.parseFromString(`<span>${text}</span>`, 'text/html');
    const root = doc.body.firstChild;

    const nodes: Node[] = [];

    // 재귀적으로 DOM 트리를 순회하며 스타일 적용
    const traverse = (node: Node, styles: { b: boolean, i: boolean }) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const content = node.textContent || '';
            if (!content) return;

            // 텍스트 노드 생성
            const rNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:r");

            // 속성 노드 (rPr) 준비
            let rPr: Element;

            if (defaultProps) {
                rPr = defaultProps.cloneNode(true) as Element;

                // FONT SCALING LOGIC: Reduce font size by 15%
                const currentSize = parseInt(rPr.getAttribute('sz') || '0');
                if (currentSize > 0) {
                    const newSize = Math.floor(currentSize * 0.85);
                    rPr.setAttribute('sz', String(Math.max(newSize, 600)));
                }
            } else {
                rPr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:rPr");
            }

            // Apply accumulated styles
            if (styles.b) rPr.setAttribute('b', '1');
            if (styles.i) rPr.setAttribute('i', '1');

            rPr.setAttribute('lang', 'en-US');
            rPr.setAttribute('dirty', '0');

            rNode.appendChild(rPr);

            const tNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:t");
            tNode.textContent = content;
            rNode.appendChild(tNode);

            nodes.push(rNode);

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const newStyles = { ...styles };

            // 태그 확인 (대소문자 무관)
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'b' || tagName === 'strong') newStyles.b = true;
            if (tagName === 'i' || tagName === 'em') newStyles.i = true;

            // 자식 노드 순회
            node.childNodes.forEach(child => traverse(child, newStyles));
        }
    };

    if (root) {
        root.childNodes.forEach(child => traverse(child, { b: false, i: false }));
    }

    return nodes;
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

        for (const item of itemsBySlide[slidePath]) {
            const pNode = paragraphNodes[item.paragraphIndex];

            if (!pNode) continue;

            // 텍스트 상자 자동 맞춤 로직 (기존 유지)
            let parent = pNode.parentElement;
            while (parent) {
                if (parent.tagName.endsWith('txBody')) {
                    let bodyPr = parent.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'bodyPr')[0];
                    if (bodyPr) {
                        const noAutofit = bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'noAutofit')[0];
                        if (noAutofit) bodyPr.removeChild(noAutofit);

                        if (!bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'normAutofit')[0] &&
                            !bodyPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'spAutoFit')[0]) {
                            // spAutoFit이 더 안전한 경우가 많음 (도형 크기에 맞춤)
                            const normAutofit = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:normAutofit');
                            bodyPr.appendChild(normAutofit);
                        }
                    }
                    break;
                }
                parent = parent.parentElement;
            }

            // 기존 Run들을 모두 제거
            const runNodes = Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'r'));

            // 첫 번째 rPr (폰트 사이즈 등 유지를 위해 저장) - 가장 대표 스타일로 간주
            const firstRPr = runNodes[0]?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0]?.cloneNode(true) as Element;

            runNodes.forEach(r => pNode.removeChild(r));

            // 새로운 Run 생성 및 삽입
            const newNodes = createRunsFromTaggedText(xmlDoc, item.text, firstRPr); // Pass captured style

            // endParaRPr (문단 끝 속성) 앞에 삽입하거나 append
            const endParaRunPr = pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'endParaRPr')[0];

            newNodes.forEach(node => {
                if (endParaRunPr) {
                    pNode.insertBefore(node, endParaRunPr);
                } else {
                    pNode.appendChild(node);
                }
            });
        }

        const newXmlString = serializer.serializeToString(xmlDoc);
        zip.file(slidePath, newXmlString);
    }

    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
};