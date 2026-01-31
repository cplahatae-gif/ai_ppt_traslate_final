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

            childNodes.forEach(child => {
                if (child.nodeName === 'a:r') {
                    const rNode = child as Element;
                    const tNode = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0];
                    const text = tNode?.textContent || '';
                    if (!text) return;

                    hasText = true;

                    // 스타일 확인 (rPr)
                    const rPr = rNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
                    const isBold = rPr?.getAttribute('b') === '1';
                    const isItalic = rPr?.getAttribute('i') === '1';
                    const isUnderline = rPr?.getAttribute('u') === 'sng'; // single underline

                    // 색상 추출 (solidFill > srgbClr)
                    let colorHex = '';
                    const solidFill = rPr?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'solidFill')[0];
                    if (solidFill) {
                        const srgbClr = solidFill.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'srgbClr')[0];
                        if (srgbClr) {
                            colorHex = srgbClr.getAttribute('val') || '';
                        }
                    }

                    // 하이라이트(배경색) 추출 (highlight > srgbClr)
                    let highlightHex = '';
                    const highlight = rPr?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'highlight')[0];
                    if (highlight) {
                        const srgbClr = highlight.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'srgbClr')[0];
                        if (srgbClr) {
                            highlightHex = srgbClr.getAttribute('val') || '';
                        }
                    }

                    let chunk = text;
                    // 태그 감싸기 (가장 안쪽부터: highlight -> color -> underline -> italic -> bold)
                    if (highlightHex) chunk = `<highlight:${highlightHex}>${chunk}</highlight>`;
                    if (colorHex) chunk = `<color:${colorHex}>${chunk}</color>`;
                    if (isUnderline) chunk = `<u>${chunk}</u>`;
                    if (isItalic) chunk = `<i>${chunk}</i>`;
                    if (isBold) chunk = `<b>${chunk}</b>`;

                    formattedText += chunk;
                } else if (child.nodeName === 'a:br') {
                    formattedText += '<br>';
                    hasText = true;
                }
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
 * @param xmlDoc XML Document
 * @param text 번역된 텍스트 (HTML 태그 포함)
 * @param defaultProps 원본 스타일 속성
 * @param originalLength 원본 텍스트 길이 (동적 폰트 스케일링용)
 */
const createRunsFromTaggedText = (xmlDoc: Document, text: string, defaultProps?: Element, originalLength?: number): Node[] => {
    const parser = new DOMParser();
    // HTML 파서를 사용하여 텍스트를 DOM 트리로 변환 (wrapper로 감싸서 처리)
    // <span> wrapper ensures a valid root for fragments
    const doc = parser.parseFromString(`<span>${text}</span>`, 'text/html');
    const root = doc.body.firstChild;

    const nodes: Node[] = [];

    // 번역된 텍스트 길이 (태그 제외)
    const translatedLength = text.replace(/<[^>]*>/g, '').length;

    // 동적 스케일 팩터 계산: 텍스트가 늘어난 비율에 따라 폰트 축소
    // 최소 0.7 (70%), 최대 1.0 (축소만, 확대 안함)
    // 텍스트가 30% 이상 증가한 경우에만 축소 적용
    let scaleFactor = 1.0;
    if (originalLength && originalLength > 0 && translatedLength > originalLength * 1.3) {
        const ratio = originalLength / translatedLength;
        scaleFactor = Math.max(0.7, Math.min(1.0, ratio));
    }

    // 재귀적으로 DOM 트리를 순회하며 스타일 적용
    const traverse = (node: Node, styles: { b: boolean, i: boolean, u: boolean, color: string, highlight: string }) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const content = node.textContent || '';
            if (!content) return;

            // 텍스트 노드 생성
            const rNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:r");

            // 속성 노드 (rPr) 준비
            let rPr: Element;

            if (defaultProps) {
                rPr = defaultProps.cloneNode(true) as Element;

                // DYNAMIC FONT SCALING
                const currentSize = parseInt(rPr.getAttribute('sz') || '0');
                if (currentSize > 0) {
                    const newSize = Math.floor(currentSize * scaleFactor);
                    rPr.setAttribute('sz', String(Math.max(newSize, 800)));
                }

                // TEXT SPACING CLEAR
                const currentSpc = parseInt(rPr.getAttribute('spc') || '0');
                if (currentSpc < 0) {
                    rPr.setAttribute('spc', '0');
                }
            } else {
                rPr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:rPr");
            }

            // Apply styles based strictly on tags (override defaultProps)
            if (styles.b) {
                rPr.setAttribute('b', '1');
            } else {
                rPr.removeAttribute('b');
            }

            if (styles.i) {
                rPr.setAttribute('i', '1');
            } else {
                rPr.removeAttribute('i');
            }

            // Underline 적용
            if (styles.u) {
                rPr.setAttribute('u', 'sng');
            } else {
                rPr.removeAttribute('u');
            }

            // Color 적용 (solidFill > srgbClr)
            // 기존 solidFill 제거 후 새로 생성
            const existingSolidFill = rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'solidFill')[0];
            if (existingSolidFill && existingSolidFill.parentNode === rPr) {
                rPr.removeChild(existingSolidFill);
            }
            if (styles.color) {
                const solidFill = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:solidFill');
                const srgbClr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:srgbClr');
                srgbClr.setAttribute('val', styles.color);
                solidFill.appendChild(srgbClr);
                rPr.appendChild(solidFill);
            }

            // Highlight(배경색) 적용 (highlight > srgbClr)
            const existingHighlight = rPr.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'highlight')[0];
            if (existingHighlight && existingHighlight.parentNode === rPr) {
                rPr.removeChild(existingHighlight);
            }
            if (styles.highlight) {
                const highlightEl = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:highlight');
                const srgbClr = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, 'a:srgbClr');
                srgbClr.setAttribute('val', styles.highlight);
                highlightEl.appendChild(srgbClr);
                rPr.appendChild(highlightEl);
            }

            rPr.setAttribute('lang', 'en-US');
            rPr.setAttribute('dirty', '0');

            rNode.appendChild(rPr);

            const tNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:t");
            tNode.textContent = content;
            rNode.appendChild(tNode);

            nodes.push(rNode);

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName.toLowerCase();

            if (tagName === 'br') {
                // 줄바꿈 (<a:br>) 생성
                const brNode = xmlDoc.createElementNS(DRAWINGML_NAMESPACE, "a:br");
                nodes.push(brNode);
                return;
            }

            const newStyles = { ...styles };

            if (tagName === 'b' || tagName === 'strong') newStyles.b = true;
            if (tagName === 'i' || tagName === 'em') newStyles.i = true;
            if (tagName === 'u') newStyles.u = true;

            // <color:RRGGBB> 태그 처리
            if (tagName.startsWith('color:')) {
                newStyles.color = tagName.substring(6).toUpperCase();
            }

            // <highlight:RRGGBB> 태그 처리
            if (tagName.startsWith('highlight:')) {
                newStyles.highlight = tagName.substring(10).toUpperCase();
            }

            // 자식 노드 순회
            node.childNodes.forEach(child => traverse(child, newStyles));
        }
    };

    if (root) {
        root.childNodes.forEach(child => traverse(child, { b: false, i: false, u: false, color: '', highlight: '' }));
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

            // 기존 Run 및 Break 모두 제거
            // r 뿐만 아니라 br도 제거해야 함 (pNode의 자식 중 r와 br을 모두 삭제)
            // 간단하게: endParaRPr 전까지 모든 자식을 지우고 다시 채움?
            // 아니면 r와 br만 찾아서 지움.
            // 안전하게: r과 br 태그만 찾아서 삭제
            const children = Array.from(pNode.childNodes);
            const targetNodes = children.filter(n => n.nodeName === 'a:r' || n.nodeName === 'a:br');

            // 대표 스타일(Representative RPr) 찾기: 공백이 아닌 실제 텍스트가 있는 첫 번째 Run의 스타일 사용
            // 이렇게 해야 "앞의 투명/색깔 불릿" 스타일이 전체를 덮어쓰는 문제 해결 가능
            let representativeRPr: Element | undefined;

            const runNodes = Array.from(pNode.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'r'));
            for (const r of runNodes) {
                const text = r.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 't')[0]?.textContent || '';
                if (text.trim().length > 0) {
                    representativeRPr = r.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
                    break;
                }
            }
            // 텍스트 있는 Run이 없으면 그냥 첫 번째 사용
            if (!representativeRPr) {
                representativeRPr = runNodes[0]?.getElementsByTagNameNS(DRAWINGML_NAMESPACE, 'rPr')[0];
            }

            // 스타일 클론
            const defaultProps = representativeRPr ? representativeRPr.cloneNode(true) as Element : undefined;

            targetNodes.forEach(n => pNode.removeChild(n));

            // 새로운 Run 생성 및 삽입 (원본 길이 전달하여 동적 스케일링)
            const newNodes = createRunsFromTaggedText(xmlDoc, item.text, defaultProps, item.originalLength);

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