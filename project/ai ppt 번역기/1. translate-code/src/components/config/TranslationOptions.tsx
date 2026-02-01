import React, { useState, useRef } from 'react';
import { EmailSettings } from '../settings/EmailSettings';

interface TranslationOptionsProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    startPage: number;
    setStartPage: (val: number) => void;
    endPage: number;
    setEndPage: (val: number) => void;
    totalSlides: number;
    onTranslate: () => void;
    isAnalyzing: boolean;
    userEmail: string;
    userName: string;
    // New Props for restored features
    glossary: string; // Add glossary prop
    onGlossaryChange: (value: string) => void; // Add handler
    apiKey: string; // Add apiKey prop
    onApiKeyChange: (value: string) => void; // Add handler
}

export const TranslationOptions: React.FC<TranslationOptionsProps> = ({
    prompt, onPromptChange,
    startPage, setStartPage,
    endPage, setEndPage,
    totalSlides,
    onTranslate,
    isAnalyzing,
    userEmail, userName,
    glossary, onGlossaryChange,
    apiKey, onApiKeyChange
}) => {

    // File Upload Helpers
    const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setter(ev.target.result as string);
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    return (
        <section className="flex-1 bg-white border-2 border-border-strong rounded-xl shadow-float flex flex-col animate-scale-in delay-75 h-full">
            {/* Header */}
            <div className="p-6 border-b-2 border-border-strong bg-gray-light rounded-t-lg">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-white border-2 border-black rounded-lg text-black shadow-sm">
                        <span className="material-symbols-outlined text-xl">tune</span>
                    </div>
                    <h2 className="text-lg font-black text-black tracking-tight">번역 설정 (Configuration)</h2>
                </div>
                <p className="text-sm font-bold text-gray-500 ml-11">최상의 번역 품질을 위해 상세 옵션을 설정하세요.</p>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-white">

                {/* 1. API Key Setup (Restored) */}
                <div className="bg-gray-light border-2 border-gray-200 rounded-xl p-5 hover:border-black transition-colors">
                    <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-sm">key</span> Gemini API Key
                        <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-bold">Recommended</span>
                    </label>
                    <div className="relative">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            placeholder="개인 API Key가 있다면 입력하세요 (없으면 공용 키 사용)"
                            className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-3 text-sm text-black font-bold focus:border-primary outline-none transition-all placeholder-gray-400"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {apiKey ? (
                                <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                            ) : (
                                <span className="material-symbols-outlined text-gray-400 text-sm">vpn_key</span>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-gray-500 mt-2 leading-relaxed">
                        * 개인 키를 사용하면 속도 제한 없이 더 안정적인 번역이 가능합니다.
                    </p>
                </div>

                {/* 2. Language & Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">translate</span> 대상 언어
                        </label>
                        <div className="relative">
                            <select className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-black appearance-none focus:border-primary transition-all outline-none cursor-pointer hover:border-black">
                                <option>한국어 (Korean)</option>
                                <option>영어 (English)</option>
                                <option>일본어 (Japanese)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">expand_more</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">pages</span> 페이지 범위
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max={totalSlides}
                                value={startPage}
                                onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-3 text-sm font-bold text-center focus:border-primary outline-none hover:border-black transition-colors"
                            />
                            <span className="text-gray-400 font-black">~</span>
                            <input
                                type="number"
                                min="1"
                                max={totalSlides}
                                value={endPage}
                                onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                                className="w-full bg-white border-2 border-gray-200 rounded-lg px-3 py-3 text-sm font-bold text-center focus:border-primary outline-none hover:border-black transition-colors"
                            />
                        </div>
                        <div className="text-[10px] text-right text-gray-400 font-bold">Total: {totalSlides} pages</div>
                    </div>
                </div>

                {/* 3. Prompt Instructions (Restored File Upload) */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">description</span> 프롬프트 지침
                        </label>
                        <label className="cursor-pointer text-[11px] font-bold text-primary hover:text-black flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors">
                            <span className="material-symbols-outlined text-sm">upload_file</span> 파일 불러오기
                            <input type="file" accept=".txt,.md" className="hidden" onChange={(e) => handleFileRead(e, onPromptChange)} />
                        </label>
                    </div>
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        className="w-full bg-white border-2 border-gray-200 rounded-lg p-4 text-sm font-medium text-black focus:border-primary outline-none transition-all resize-none shadow-inner custom-scrollbar hover:border-black"
                        placeholder="예: '격식 있는 비즈니스 톤으로 번역해줘', 'IT 전문 용어는 영어 그대로 유지해줘'..."
                        rows={4}
                    ></textarea>
                </div>

                {/* 4. Glossary (Restored) */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">book_2</span> 단어장 (Glossary)
                        </label>
                        <label className="cursor-pointer text-[11px] font-bold text-primary hover:text-black flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors">
                            <span className="material-symbols-outlined text-sm">upload_file</span> 파일 불러오기
                            <input type="file" accept=".txt,.csv" className="hidden" onChange={(e) => handleFileRead(e, onGlossaryChange)} />
                        </label>
                    </div>
                    <textarea
                        value={glossary}
                        onChange={(e) => onGlossaryChange(e.target.value)}
                        className="w-full bg-white border-2 border-gray-200 rounded-lg p-4 text-sm font-mono font-medium text-black focus:border-primary outline-none transition-all resize-none shadow-inner custom-scrollbar hover:border-black"
                        placeholder={'사용자 정의 용어를 입력하세요.\n예:\nLLM: 거대언어모델\nAntigravity: 안티그래비티'}
                        rows={4}
                    ></textarea>
                </div>

                {/* 5. Email Settings */}
                <div className="pt-4 border-t-2 border-gray-200 border-dashed">
                    <EmailSettings userEmail={userEmail} userName={userName} />
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto rounded-b-lg">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-black text-gray-500">준비 완료</span>
                </div>
                <button
                    onClick={onTranslate}
                    disabled={isAnalyzing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none border-2 border-transparent"
                >
                    {isAnalyzing ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            분석 중...
                        </>
                    ) : (
                        <>
                            번역 시작하기
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </>
                    )}
                </button>
            </div>
        </section>
    );
};
