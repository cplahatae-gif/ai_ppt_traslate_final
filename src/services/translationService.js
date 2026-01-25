/**
 * MyMemory API를 사용하여 텍스트를 번역하는 서비스입니다.
 * @param {string} text - 번역할 텍스트
 * @param {string} sourceLang - 원본 언어 코드 (예: 'en')
 * @param {string} targetLang - 결과 언어 코드 (예: 'ko')
 * @returns {Promise<string>} - 번역된 텍스트
 */
export const translateText = async (text, sourceLang, targetLang) => {
    if (!text) return '';

    try {
        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
        );
        const data = await response.json();

        if (data.responseData) {
            return data.responseData.translatedText;
        } else {
            throw new Error('Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        return '번역 중 오류가 발생했습니다.';
    }
};
