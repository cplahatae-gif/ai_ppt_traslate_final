import React, { useState, useEffect } from 'react';
import { translateText } from '../services/translationService';

const Translator = () => {
    const [inputText, setInputText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [sourceLang, setSourceLang] = useState('en');
    const [targetLang, setTargetLang] = useState('ko');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (inputText.trim()) {
                setIsLoading(true);
                const result = await translateText(inputText, sourceLang, targetLang);
                setTranslatedText(result);
                setIsLoading(false);
            } else {
                setTranslatedText('');
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [inputText, sourceLang, targetLang]);

    const handleSwapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setInputText(translatedText);
        setTranslatedText(inputText);
    };

    const handleCopy = async () => {
        if (translatedText) {
            await navigator.clipboard.writeText(translatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getLanguageInfo = (lang) => {
        return lang === 'en'
            ? { name: 'English', flag: '🇺🇸' }
            : { name: '한국어', flag: '🇰🇷' };
    };

    const sourceInfo = getLanguageInfo(sourceLang);
    const targetInfo = getLanguageInfo(targetLang);

    return (
        <div className="translator-container">
            {/* Header */}
            <header className="app-header">
                <div className="app-logo">
                    <div className="logo-icon">🌐</div>
                    <h1 className="app-title">AI Translator</h1>
                </div>
                <p className="app-subtitle">실시간 영어-한국어 번역 서비스</p>
            </header>

            {/* Main Translator Card */}
            <div className="translator-card">
                {/* Language Controls */}
                <div className="language-controls">
                    <div className="language-selector">
                        <span className="lang-pill active">
                            <span className="lang-flag">{sourceInfo.flag}</span>
                            {sourceInfo.name}
                        </span>
                    </div>

                    <button
                        className="swap-button"
                        onClick={handleSwapLanguages}
                        aria-label="언어 바꾸기"
                    >
                        ⇄
                    </button>

                    <div className="language-selector">
                        <span className="lang-pill active">
                            <span className="lang-flag">{targetInfo.flag}</span>
                            {targetInfo.name}
                        </span>
                    </div>
                </div>

                {/* Translation Area */}
                <div className="translation-area">
                    {/* Input Section */}
                    <div className="input-section">
                        <label className="section-label">원문</label>
                        <textarea
                            className="text-input"
                            placeholder="번역할 텍스트를 입력하세요..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <span className="char-count">{inputText.length} / 5000</span>
                    </div>

                    {/* Output Section */}
                    <div className="output-section">
                        <label className="section-label">번역</label>
                        <div className="output-content">
                            {isLoading ? (
                                <div className="loading-indicator">
                                    <div className="loading-spinner"></div>
                                    <span>번역 중...</span>
                                </div>
                            ) : translatedText ? (
                                <p>{translatedText}</p>
                            ) : (
                                <p className="output-placeholder">번역 결과가 여기에 표시됩니다...</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="translator-footer">
                    <div className="footer-info">
                        <span className="status-dot"></span>
                        <span>Powered by MyMemory API</span>
                    </div>
                    <button
                        className="copy-button"
                        onClick={handleCopy}
                        disabled={!translatedText}
                    >
                        {copied ? '✓ 복사됨' : '📋 복사'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Translator;
