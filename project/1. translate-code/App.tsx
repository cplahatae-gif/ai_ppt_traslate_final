import React, { useState, useCallback, useEffect } from 'react';
import { extractTextFromPptx, replaceTextInPptx, TextItem, countSlides } from './services/pptxService';
import { translateTexts, estimateTokens } from './services/geminiService';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { StatusDisplay } from './components/StatusDisplay';
import { DownloadIcon } from './components/icons';
import { AdvancedOptions } from './components/AdvancedOptions';

type Status = 'idle' | 'analyzing' | 'translating' | 'building' | 'done' | 'error';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [promptInstruction, setPromptInstruction] = useState('');
  const [glossary, setGlossary] = useState('');
  // Load API Key from localStorage if available
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

  const [status, setStatus] = useState<Status>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [totalSlides, setTotalSlides] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);

  // Save API Key to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  // Auto-load prompt and glossary from public folder
  useEffect(() => {
    const loadResources = async () => {
      try {
        // Load prompt file
        const promptRes = await fetch('/prompt.txt');
        if (promptRes.ok) {
          const promptText = await promptRes.text();
          setPromptInstruction(promptText);
        }

        // Load glossary file
        const glossaryRes = await fetch('/glossary.txt');
        if (glossaryRes.ok) {
          const glossaryText = await glossaryRes.text();
          setGlossary(glossaryText);
        }
      } catch (err) {
        console.warn('Failed to load default resources:', err);
      }
    };
    loadResources();
  }, []);

  const resetState = () => {
    setFile(null);
    setPromptInstruction('');
    setGlossary('');
    // Don't reset apiKey
    setStatus('idle');
    setProgressMessage('');
    setError(null);
    setTotalSlides(0);
    setStartPage(1);
    setEndPage(1);
    setEstimatedTokens(0);
    setExtractedCount(0);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      setError('올바른 PPTX 파일을 선택해주세요.');
      return;
    }

    // 이전 파일의 설정값(프롬프트, 단어장)은 유지하고 파일 관련 상태만 초기화합니다.
    setStatus('analyzing');
    setProgressMessage('파일 구조 분석 중...');
    setError(null);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);

    try {
      setFile(selectedFile);
      const count = await countSlides(selectedFile);
      setTotalSlides(count);
      setEndPage(count);
      setStartPage(1);
      setStatus('idle');
    } catch (e) {
      setError('파일을 분석하는 데 실패했습니다. 손상된 파일일 수 있습니다.');
      setStatus('error');
    }
  };

  const handleTranslate = useCallback(async () => {
    if (!file) return;

    try {
      setStatus('analyzing');
      setProgressMessage(`${startPage}~${endPage}페이지 텍스트 추출 중...`);

      const textItems = await extractTextFromPptx(file, startPage, endPage);
      const originalTexts = textItems.map(item => item.text);

      setExtractedCount(originalTexts.length);
      const tokens = estimateTokens(originalTexts);
      setEstimatedTokens(tokens);

      if (originalTexts.length === 0) {
        setError('선택한 범위에서 번역할 텍스트를 찾을 수 없습니다.');
        setStatus('error');
        return;
      }

      setStatus('translating');
      setProgressMessage(`AI 번역 시작... (예상 토큰: ${tokens.toLocaleString()}, 텍스트: ${originalTexts.length}개)`);

      const onProgress = (completed: number, total: number) => {
        const percent = Math.round((completed / total) * 100);
        setProgressMessage(`번역 진행 중... ${percent}% 완료 (${completed}/${total} 배치)`);
      };

      const translatedTexts = await translateTexts(originalTexts, onProgress, promptInstruction, glossary, 20, apiKey);

      if (originalTexts.length !== translatedTexts.length) {
        throw new Error(`번역 개수 불일치 오류가 발생했습니다.`);
      }

      const translatedItems: TextItem[] = textItems.map((item, index) => ({
        ...item,
        text: translatedTexts[index],
        originalLength: originalTexts[index].replace(/<[^>]*>/g, '').length // 원본 길이 저장 (태그 제외)
      }));

      setStatus('building');
      setProgressMessage('PPTX 파일 생성 중...');
      const translatedBlob = await replaceTextInPptx(file, translatedItems);

      const url = URL.createObjectURL(translatedBlob);
      setDownloadUrl(url);
      setStatus('done');
      setProgressMessage(`${startPage}~${endPage}페이지 번역 완료!`);

    } catch (err) {
      console.error(err);
      setError(`오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setStatus('error');
    }
  }, [file, promptInstruction, glossary, startPage, endPage, apiKey]);

  const getOutputFilename = () => {
    if (!file) return 'translated.pptx';
    const name = file.name.replace(/\.pptx$/, '');
    return `${name}_p${startPage}-${endPage}_en.pptx`;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans text-gray-100">
      <div className="w-full max-w-3xl mx-auto">
        <Header />
        <main className="mt-8">
          {status === 'idle' || status === 'error' || (status === 'analyzing' && !estimatedTokens) ? (
            <div className="space-y-6">
              <FileUpload onFileSelect={handleFileSelect} file={file} />

              {file && (
                <AdvancedOptions
                  prompt={promptInstruction}
                  onPromptChange={setPromptInstruction}
                  glossary={glossary}
                  onGlossaryChange={setGlossary}
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                  startPage={startPage}
                  setStartPage={setStartPage}
                  endPage={endPage}
                  setEndPage={setEndPage}
                  totalSlides={totalSlides}
                  isParsing={status === 'analyzing'}
                />
              )}

              {error && (
                <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <button
                onClick={handleTranslate}
                disabled={!file || status === 'analyzing'}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01]"
              >
                {status === 'analyzing' ? '파일 분석 중...' : '번역 시작하기'}
              </button>
            </div>
          ) : status === 'done' && downloadUrl ? (
            <div className="flex flex-col items-center gap-6 p-10 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
              <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
                <DownloadIcon />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">{progressMessage}</h2>
                <p className="text-gray-400">
                  총 {extractedCount}개의 텍스트 블록이 번역되었습니다.
                </p>
              </div>
              <a
                href={downloadUrl}
                download={getOutputFilename()}
                className="flex items-center gap-3 px-8 py-4 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 transition-all transform hover:scale-105"
              >
                <DownloadIcon />
                <span>번역된 PPT 다운로드</span>
              </a>
              <button onClick={() => setStatus('idle')} className="text-purple-400 hover:text-purple-300 font-semibold mt-4">
                돌아가서 추가 번역하기
              </button>
            </div>
          ) : (
            <StatusDisplay message={progressMessage} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;