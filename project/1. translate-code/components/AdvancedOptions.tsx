import React, { useState, useCallback } from 'react';
import { ChevronDownIcon, UploadCloudIcon } from './icons';

interface AdvancedOptionsProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  glossary: string;
  onGlossaryChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  startPage: number;
  setStartPage: (val: number) => void;
  endPage: number;
  setEndPage: (val: number) => void;
  totalSlides: number;
  isParsing: boolean;
}

export const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
  prompt,
  onPromptChange,
  glossary,
  onGlossaryChange,
  apiKey,
  onApiKeyChange,
  startPage,
  setStartPage,
  endPage,
  setEndPage,
  totalSlides,
  isParsing
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [promptFileName, setPromptFileName] = useState<string | null>(null);
  const [glossaryFileName, setGlossaryFileName] = useState<string | null>(null);

  const handleFileRead = (
    file: File,
    contentSetter: (content: string) => void,
    nameSetter: (name: string | null) => void
  ) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      contentSetter(text);
      nameSetter(file.name);
    };
    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsText(file, 'UTF-8');
  };

  const onFileChange = (
    contentSetter: (content: string) => void,
    nameSetter: (name: string | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file, contentSetter, nameSetter);
    }
  };

  const clearPrompt = () => {
    onPromptChange('');
    setPromptFileName(null);
  };

  const clearGlossary = () => {
    onGlossaryChange('');
    setGlossaryFileName(null);
  };

  return (
    <div className="w-full mt-6 bg-gray-800/50 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-5 text-left font-bold text-gray-100 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="bg-purple-500/20 text-purple-400 p-1 rounded text-xs">ADVANCED</span>
          <span>번역 상세 설정 (API Key 포함)</span>
        </div>
        <ChevronDownIcon className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-5 border-t border-gray-700 space-y-8 bg-gray-900/30">

          {/* API Key 설정 */}
          <section>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
              Gemini API Key 설정
            </h3>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <div className="mb-2">
                <label className="block text-xs text-gray-500 mb-1.5">GEMINI API KEY (나만의 키 사용)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="기본값 사용 시 비워두세요"
                  className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white focus:ring-1 focus:ring-yellow-500 outline-none placeholder-gray-600"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                * 입력하지 않으면 서버에 설정된 공용 키가 사용됩니다. (트래픽 초과 시 사용 불가할 수 있음)
              </p>
            </div>
          </section>

          {/* 페이지 범위 설정 */}
          <section>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              슬라이드 범위 설정
            </h3>
            <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1.5">시작 페이지</label>
                <input
                  type="number"
                  min="1"
                  max={totalSlides || 9999}
                  value={startPage}
                  onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white text-center focus:ring-1 focus:ring-purple-500 outline-none"
                  disabled={isParsing}
                />
              </div>
              <span className="text-gray-600 mt-5">~</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1.5">종료 페이지</label>
                <input
                  type="number"
                  min="1"
                  max={totalSlides || 9999}
                  value={endPage}
                  onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white text-center focus:ring-1 focus:ring-purple-500 outline-none"
                  disabled={isParsing}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <p className="text-xs text-purple-400 font-medium">
                {totalSlides > 0
                  ? `총 ${totalSlides}페이지 중 ${Math.max(0, endPage - startPage + 1)}페이지 대상`
                  : "파일 분석 후 페이지 수가 표시됩니다."}
              </p>
            </div>
          </section>

          {/* 프롬프트 지침 */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                번역 프롬프트 지침
              </h3>
              <div className="flex items-center gap-2">
                {promptFileName && (
                  <button onClick={clearPrompt} className="text-[10px] text-red-400 hover:text-red-300">지우기</button>
                )}
                <label className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-md cursor-pointer text-gray-200 border border-gray-600 flex items-center gap-1.5 transition-colors">
                  <UploadCloudIcon className="w-3 h-3" />
                  파일 첨부
                  <input type="file" className="hidden" accept=".txt,.md"
                    onChange={onFileChange(onPromptChange, setPromptFileName)}
                    onClick={(e) => (e.target as HTMLInputElement).value = ''}
                  />
                </label>
              </div>
            </div>
            {promptFileName && (
              <div className="mb-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded text-[11px] text-blue-400 flex items-center gap-2">
                <span className="font-bold">첨부됨:</span> {promptFileName}
              </div>
            )}
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="예: '비즈니스 발표용이므로 격식 있는 표현을 써줘', 'IT 전문 용어는 유지해줘' 등"
              className="w-full p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500/50 outline-none text-gray-200 text-sm leading-relaxed"
            />
          </section>

          {/* 단어 사전 */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                나만의 단어 사전
              </h3>
              <div className="flex items-center gap-2">
                {glossaryFileName && (
                  <button onClick={clearGlossary} className="text-[10px] text-red-400 hover:text-red-300">지우기</button>
                )}
                <label className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-md cursor-pointer text-gray-200 border border-gray-600 flex items-center gap-1.5 transition-colors">
                  <UploadCloudIcon className="w-3 h-3" />
                  파일 첨부
                  <input type="file" className="hidden" accept=".txt,.csv"
                    onChange={onFileChange(onGlossaryChange, setGlossaryFileName)}
                    onClick={(e) => (e.target as HTMLInputElement).value = ''}
                  />
                </label>
              </div>
            </div>
            {glossaryFileName && (
              <div className="mb-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded text-[11px] text-green-400 flex items-center gap-2">
                <span className="font-bold">첨부됨:</span> {glossaryFileName}
              </div>
            )}
            <textarea
              rows={5}
              value={glossary}
              onChange={(e) => onGlossaryChange(e.target.value)}
              placeholder="단어 매핑 규칙을 입력하세요. (예: '사용자: User', '운영체제: OS')"
              className="w-full p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500/50 outline-none text-gray-200 font-mono text-sm"
            />
            <p className="mt-2 text-[11px] text-gray-500 italic">
              * 한 줄에 하나씩 입력하거나 .txt/.csv 파일을 첨부하세요.
            </p>
          </section>

        </div>
      )}
    </div>
  );
};