import React, { useState } from 'react';
import { EmailSettings } from '../settings/EmailSettings';
import { ProviderId, PROVIDERS, getProviderConfig, isApiKeyRemembered, setApiKeyRemember } from '../../services/modelCatalog';

interface TranslationOptionsProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    guideLoaded?: boolean;
    startPage: number;
    setStartPage: (val: number) => void;
    endPage: number;
    setEndPage: (val: number) => void;
    totalSlides: number;
    onTranslate: () => void;
    isAnalyzing: boolean;
    userEmail: string;
    userName: string;
    glossary: string;
    onGlossaryChange: (value: string) => void;
    apiKey: string;
    onApiKeyChange: (value: string) => void;
    provider: ProviderId;
    onProviderChange: (provider: ProviderId) => void;
    model: string;
    onModelChange: (model: string) => void;
}

export const TranslationOptions: React.FC<TranslationOptionsProps> = ({
    prompt, onPromptChange,
    guideLoaded,
    startPage, setStartPage,
    endPage, setEndPage,
    totalSlides,
    onTranslate,
    isAnalyzing,
    userEmail, userName,
    glossary, onGlossaryChange,
    apiKey, onApiKeyChange,
    provider, onProviderChange,
    model, onModelChange,
}) => {
    const [rememberKey, setRememberKey] = useState(isApiKeyRemembered);

    const handleRememberChange = (checked: boolean) => {
        setRememberKey(checked);
        setApiKeyRemember(checked);
        if (checked && apiKey) {
            // Persist current key to localStorage when user enables "remember"
            const { localStorageKey } = getProviderConfig(provider);
            localStorage.setItem(localStorageKey, apiKey);
        }
    };

    const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setter(ev.target.result as string);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const providerConfig = getProviderConfig(provider);

    return (
        <section className="flex-1 bg-white border-2 border-border-strong rounded-xl shadow-float flex flex-col animate-scale-in delay-75 h-full">
            {/* Header */}
            <div className="p-4 border-b-2 border-border-strong bg-gray-light rounded-t-lg">
                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="p-1.5 bg-white border-2 border-black rounded-md text-black shadow-sm">
                        <span className="material-symbols-outlined text-lg">tune</span>
                    </div>
                    <h2 className="text-xl font-black text-black tracking-tight">번역 설정</h2>
                </div>
                <p className="text-xs font-bold text-gray-400 ml-9">최상의 번역 품질을 위해 상세 옵션을 설정하세요.</p>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-white">

                {/* 1. AI 모델 선택 */}
                <div className="bg-gray-light border border-gray-200 rounded-lg p-3.5 space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">smart_toy</span> AI 모델 선택
                    </label>

                    {/* Provider 드롭다운 */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">프로바이더</p>
                        <div className="relative">
                            <select
                                value={provider}
                                onChange={(e) => onProviderChange(e.target.value as ProviderId)}
                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs font-bold text-black appearance-none focus:border-primary transition-all outline-none cursor-pointer hover:border-black"
                            >
                                {PROVIDERS.map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-sm">expand_more</span>
                        </div>
                    </div>

                    {/* Model 드롭다운 */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">모델</p>
                        <div className="relative">
                            <select
                                value={model}
                                onChange={(e) => onModelChange(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs font-bold text-black appearance-none focus:border-primary transition-all outline-none cursor-pointer hover:border-black"
                            >
                                {providerConfig.models.map(m => (
                                    <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-sm">expand_more</span>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">{providerConfig.apiKeyLabel}</p>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => onApiKeyChange(e.target.value)}
                                placeholder={`${providerConfig.apiKeyPlaceholder} (없으면 공용 키 사용)`}
                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-black font-bold focus:border-primary outline-none transition-all placeholder-gray-400"
                            />
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                {apiKey ? (
                                    <span className="material-symbols-outlined text-green-600 text-xs">check_circle</span>
                                ) : (
                                    <span className="material-symbols-outlined text-gray-400 text-xs">vpn_key</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <input
                                type="checkbox"
                                id="rememberKey"
                                checked={rememberKey}
                                onChange={(e) => handleRememberChange(e.target.checked)}
                                className="w-3 h-3 accent-primary cursor-pointer"
                            />
                            <label htmlFor="rememberKey" className="text-[10px] font-bold text-gray-400 cursor-pointer select-none">
                                이 기기에서 API 키 기억하기
                            </label>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                            * 체크 해제 시 탭 닫으면 키가 삭제됩니다.
                        </p>
                    </div>
                </div>

                {/* 2. Language & Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">translate</span> 대상 언어
                        </label>
                        <div className="relative">
                            <select className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs font-bold text-black appearance-none focus:border-primary transition-all outline-none cursor-pointer hover:border-black">
                                <option>한국어 (Korean)</option>
                                <option>영어 (English)</option>
                                <option>일본어 (Japanese)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-sm">expand_more</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">pages</span> 페이지 범위
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max={totalSlides}
                                value={startPage}
                                onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-white border border-gray-200 rounded-md px-2 py-2 text-xs font-bold text-center focus:border-primary outline-none hover:border-black transition-colors"
                            />
                            <span className="text-gray-400 font-black text-sm">~</span>
                            <input
                                type="number"
                                min="1"
                                max={totalSlides}
                                value={endPage}
                                onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                                className="w-full bg-white border border-gray-200 rounded-md px-2 py-2 text-xs font-bold text-center focus:border-primary outline-none hover:border-black transition-colors"
                            />
                        </div>
                        <div className="text-[9px] text-right text-gray-400 font-bold">Total: {totalSlides} pages</div>
                    </div>
                </div>

                {/* 3. Prompt Instructions */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">description</span> 추가 지시사항
                        </label>
                        <label className="cursor-pointer text-[10px] font-bold text-primary hover:text-black flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-gray-100 rounded transition-colors">
                            <span className="material-symbols-outlined text-xs">upload_file</span> 파일 불러오기
                            <input type="file" accept=".txt,.md" className="hidden" onChange={(e) => handleFileRead(e, onPromptChange)} />
                        </label>
                    </div>
                    {guideLoaded && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-600 font-bold">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            기본 번역 가이드 적용됨 (guide.md)
                        </div>
                    )}
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-md p-3 text-xs font-medium text-black focus:border-primary outline-none transition-all resize-none shadow-inner custom-scrollbar hover:border-black"
                        placeholder="예: '격식 있는 비즈니스 톤으로 번역해줘', 'IT 전문 용어는 영어 그대로 유지해줘'... (기본 가이드에 덧붙여집니다)"
                        rows={3}
                    ></textarea>
                </div>

                {/* 4. Glossary */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">book_2</span> 단어장 (Glossary)
                        </label>
                        <label className="cursor-pointer text-[10px] font-bold text-primary hover:text-black flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-gray-100 rounded transition-colors">
                            <span className="material-symbols-outlined text-xs">upload_file</span> 파일 불러오기
                            <input type="file" accept=".txt,.csv" className="hidden" onChange={(e) => handleFileRead(e, onGlossaryChange)} />
                        </label>
                    </div>
                    <textarea
                        value={glossary}
                        onChange={(e) => onGlossaryChange(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-md p-3 text-xs font-mono font-medium text-black focus:border-primary outline-none transition-all resize-none shadow-inner custom-scrollbar hover:border-black"
                        placeholder={'사용자 정의 용어를 입력하세요.\n예:\nLLM: 거대언어모델\nAntigravity: 안티그래비티'}
                        rows={3}
                    ></textarea>
                </div>

                {/* 5. Email Settings */}
                <div className="pt-3 border-t border-gray-200 border-dashed">
                    <EmailSettings userEmail={userEmail} userName={userName} />
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto rounded-b-lg">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-gray-500">준비 완료</span>
                </div>
                <button
                    onClick={onTranslate}
                    disabled={isAnalyzing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none border border-transparent"
                >
                    {isAnalyzing ? (
                        <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            분석 중...
                        </>
                    ) : (
                        <>
                            번역 시작하기
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </>
                    )}
                </button>
            </div>
        </section>
    );
};
