import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_BATCH_SIZE = 25;
const MAX_RETRIES = 3;

const extractJson = (text: string): string => {
    const trimmedText = text.trim();
    const match = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1];
    }
    return trimmedText;
};

export const estimateTokens = (texts: string[]): number => {
    const totalChars = texts.join('').length;
    return Math.ceil(totalChars * 1.5) + (texts.length * 5);
};

const translateBatch = async (batch: string[], promptInstruction?: string, glossary?: string, apiKey?: string): Promise<string[]> => {
    const finalApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!finalApiKey) {
        throw new Error("API Key is missing. Please enter your API Key or set VITE_GEMINI_API_KEY in the environment.");
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            let systemInstruction = `You are an expert translator for PowerPoint presentations. 
Translate an array of Korean text fragments into professional English while STRICTLY preserving HTML-like formatting tags (<b>, </b>, <i>, </i>, <br>).

# Critical Rules
1. **One-to-One Mapping**: The input array has ${batch.length} items. The output MUST have exactly ${batch.length} items.
2. **Order Preservation**: Do NOT reorder, merge, or split items.
3. **Tag Preservation - CRITICAL**: 
    - Preserve ALL tags EXACTLY as they appear: <b>, </b>, <i>, </i>, <u>, </u>, <br>, <color:XXXXXX>, </color>, <highlight:XXXXXX>, </highlight>
    - The <color:XXXXXX> tag contains a hex color code (e.g., <color:0000FF> for blue). Keep the exact color code.
    - The <highlight:XXXXXX> tag is for background/highlight color (e.g., <highlight:FFFF00> for yellow). Keep the exact code.
    - **CRITICAL SCOPING**: Color and Highlight tags must wrap **ONLY** the corresponding words. Do not extend the tag to the entire sentence if the original was specific.
    - **TAG REORDERING**: If the word order changes during translation, you **MUST** move the tag to wrap the translated word in its *new* position. Do not leave the tag at the original position (e.g. at the start of the sentence) if the word moved.
    - **Example**: '<highlight:FFFF00>사과</highlight>를 좋아해' -> 'I like <highlight:FFFF00>apples</highlight>' (Tag moved to end).
    - **Example**: '<highlight:FFFF00>Apple</highlight> is red.' (Assume 'Apply' is tagged) -> '<highlight:FFFF00>사과</highlight>는 빨갛다'.
    - Close tags immediately after the relevant text (e.g., <color:Red>Word</color> next word).
    - If the original text has NO tags, the translation MUST have NO tags.
    - If the original has <b>only part</b> bolded, keep ONLY that part bolded.
    - **CRITICAL: Do NOT add <br> or newline characters unless they exist in the original text.**
    - Do NOT split single sentences into multiple lines.
    - Do NOT add new tags that don't exist in the original.
    - Do NOT remove existing tags from the original.
    - Do NOT change the order or nesting of tags.
4. **Glossary & Style**: 
    - Use "Electric Shock" instead of "Electrical Shock".
    - Use "Accident Summary" instead of "Accident Overview".
    - Use "Anseong Plant" instead of "Anseong Site" for 안성 사업장/현장.
    - Use "Plant" instead of "Site" for 사업장/현장 in company context.
    - Use "Attendees" instead of "Participants" for 참석자.
    - Use **Title Case** for headers/titles (e.g., "Accident Summary").
    - Use **Sentence case** for body text.
5. **Conciseness**: Prefer concise translations where possible to fit in slides.
6. **Roman Numerals**: Convert full-width roman numerals to half-width (Ⅰ→I, Ⅱ→II, Ⅲ→III, Ⅳ→IV, Ⅴ→V).
`;

            if (promptInstruction?.trim()) {
                systemInstruction += `\n# Additional Context\n${promptInstruction.trim()}\n`;
            }

            if (glossary?.trim()) {
                systemInstruction += `\n# Terminology/Glossary\n${glossary.trim()}\n`;
            }

            const prompt = `Translate these ${batch.length} items to English:\n${JSON.stringify(batch)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
            });

            const jsonString = extractJson(response.text || "[]");
            const translatedArray = JSON.parse(jsonString);

            if (Array.isArray(translatedArray) && translatedArray.length === batch.length) {
                return translatedArray;
            }

            lastError = new Error(`Expected ${batch.length} items, but received ${translatedArray?.length}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }

    throw lastError || new Error("Translation failed.");
};

export const translateTexts = async (
    koreanTexts: string[],
    onProgress?: (completedBatches: number, totalBatches: number) => void,
    promptInstruction?: string,
    glossary?: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
    apiKey?: string
): Promise<string[]> => {
    if (!koreanTexts || koreanTexts.length === 0) return [];

    const batches: string[][] = [];
    for (let i = 0; i < koreanTexts.length; i += batchSize) {
        batches.push(koreanTexts.slice(i, i + batchSize));
    }

    const allTranslatedTexts: string[] = [];
    let completedBatches = 0;

    for (const batch of batches) {
        const translatedBatch = await translateBatch(batch, promptInstruction, glossary, apiKey);
        allTranslatedTexts.push(...translatedBatch);
        completedBatches++;
        if (onProgress) onProgress(completedBatches, batches.length);
    }

    return allTranslatedTexts;
};
