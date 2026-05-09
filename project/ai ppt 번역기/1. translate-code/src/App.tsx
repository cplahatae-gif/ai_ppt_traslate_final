import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { extractTextFromPptx, replaceTextInPptx, TextItem, countSlides } from './services/pptxService';
import { translateTexts } from './services/geminiService';
import { MainLayout } from './components/layout/MainLayout';
import { StepIndicator } from './components/common/StepIndicator';
import { FileUploadArea } from './components/upload/FileUploadArea';
import { FilePreviewCard } from './components/preview/FilePreviewCard';
import { TranslationOptions } from './components/config/TranslationOptions';
import { DownloadIcon } from './components/icons';

import { tokenManager } from './services/TokenManager';
import { qualityService } from './services/QualityService';
import { QualityReport } from './components/QualityReport';
import { QualityResult } from './types';
import { ProviderId, getProviderConfig, getApiKeyFromStorage, saveApiKeyToStorage } from './services/modelCatalog';

type Status = 'idle' | 'analyzing' | 'translating' | 'building' | 'verifying' | 'done' | 'error';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [promptInstruction, setPromptInstruction] = useState('');
  const [guidePrompt, setGuidePrompt] = useState('');
  const [guideLoaded, setGuideLoaded] = useState(false);
  const [glossary, setGlossary] = useState('');

  const [provider, setProvider] = useState<ProviderId>(() =>
    (localStorage.getItem('ai_provider') as ProviderId) || 'gemini'
  );
  const [model, setModel] = useState<string>(() =>
    localStorage.getItem('ai_model') || 'gemini-2.5-flash'
  );
  const [apiKey, setApiKey] = useState(() => getApiKeyFromStorage(
    (localStorage.getItem('ai_provider') as ProviderId) || 'gemini'
  ));

  const [status, setStatus] = useState<Status>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [totalSlides, setTotalSlides] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);

  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);

  const originalTextsRef = React.useRef<string[]>([]);
  const translatedTextsRef = React.useRef<string[]>([]);
  const textItemsRef = React.useRef<TextItem[]>([]);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const promptRes = await fetch('/guide.md');
        if (promptRes.ok) {
          setGuidePrompt(await promptRes.text());
          setGuideLoaded(true);
        }
        const glossaryRes = await fetch('/glossary.txt');
        if (glossaryRes.ok) setGlossary(await glossaryRes.text());
      } catch (err) {
        console.warn('Failed to load default resources:', err);
      }
    };
    loadResources();
  }, []);

  const currentStep = useMemo(() => {
    if (status === 'analyzing' || status === 'translating' || status === 'building' || status === 'verifying' || status === 'done' || status === 'error') return 3;
    if (file) return 2;
    return 1;
  }, [status, file]);

  const handleProviderChange = useCallback((newProvider: ProviderId) => {
    const config = getProviderConfig(newProvider);
    setProvider(newProvider);
    setModel(config.defaultModel);
    setApiKey(getApiKeyFromStorage(newProvider));
    localStorage.setItem('ai_provider', newProvider);
    localStorage.setItem('ai_model', config.defaultModel);
  }, []);

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    localStorage.setItem('ai_model', newModel);
  }, []);

  const handleApiKeyChange = useCallback((newKey: string) => {
    setApiKey(newKey);
    saveApiKeyToStorage(provider, newKey);
  }, [provider]);

  const resetState = () => {
    setFile(null);
    setPromptInstruction('');
    setGlossary('');
    setStatus('idle');
    setProgressMessage('');
    setError(null);
    setTotalSlides(0);
    setStartPage(1);
    setEndPage(1);
    setEstimatedTokens(0);
    setExtractedCount(0);
    setQualityResult(null);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      setError('올바른 PPTX 파일을 선택해주세요.');
      return;
    }

    setStatus('analyzing');
    setProgressMessage('파일 구조 분석 중...');
    setError(null);
    setQualityResult(null);
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
      const tokens = tokenManager.estimateTokens(originalTexts);
      setEstimatedTokens(tokens);
      setExtractedCount(originalTexts.length);

      if (originalTexts.length === 0) {
        setError('선택한 범위에서 번역할 텍스트를 찾을 수 없습니다.');
        setStatus('error');
        return;
      }

      setStatus('translating');
      setProgressMessage(`AI 번역 시작... (예상 토큰: ${tokens.toLocaleString()})`);

      const onProgress = (completed: number, total: number) => {
        const percent = Math.round((completed / total) * 100);
        setProgressMessage(`번역 진행 중... ${percent}% 완료`);
      };

      const combinedPrompt = [guidePrompt, promptInstruction].filter(s => s.trim()).join('\n\n');
      const translatedTexts = await translateTexts(originalTexts, onProgress, combinedPrompt, glossary, 20, apiKey, provider, model);

      const translatedItems: TextItem[] = textItems.map((item, index) => ({
        ...item,
        text: translatedTexts[index],
        originalLength: originalTexts[index].replace(/<[^>]*>/g, '').length
      }));

      originalTextsRef.current = originalTexts;
      translatedTextsRef.current = translatedTexts;
      textItemsRef.current = textItems;

      setStatus('building');
      setProgressMessage('PPTX 파일 생성 중...');
      const translatedBlob = await replaceTextInPptx(file, translatedItems);

      setStatus('verifying');
      setProgressMessage('AI 품질 분석 진행 중...');

      const [qResponse] = await Promise.all([
        qualityService.verify('local', originalTexts, translatedTexts),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (qResponse) {
        setQualityResult(qResponse.result);
      }

      const url = URL.createObjectURL(translatedBlob);
      setDownloadUrl(url);
      setStatus('done');
      setProgressMessage(`${startPage}~${endPage}페이지 번역 완료!`);

    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(`오류: ${errorMsg}`);
      setStatus('error');
    }
  }, [file, promptInstruction, glossary, startPage, endPage, apiKey, provider, model, guidePrompt]);

  const handleApplyFixes = async (selectedIndices: number[]) => {
    if (!file || !qualityResult || selectedIndices.length === 0) return;
    try {
      setStatus('building');
      setProgressMessage('수정사항 적용 중...');

      const newTranslatedTexts = [...translatedTextsRef.current];
      selectedIndices.forEach(idx => {
        const issue = qualityResult.issues.find(i => i.index === idx);
        if (issue && issue.suggestion) newTranslatedTexts[idx] = issue.suggestion;
      });

      const updatedItems: TextItem[] = textItemsRef.current.map((item, index) => ({
        ...item,
        text: newTranslatedTexts[index],
        originalLength: originalTextsRef.current[index].replace(/<[^>]*>/g, '').length
      }));

      const newBlob = await replaceTextInPptx(file, updatedItems);
      const newUrl = URL.createObjectURL(newBlob);

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(newUrl);
      translatedTextsRef.current = newTranslatedTexts;
      setStatus('done');

      const link = document.createElement('a');
      link.href = newUrl;
      link.download = getOutputFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      setError('수정 중 오류 발생');
      setStatus('error');
    }
  };

  const getOutputFilename = () => {
    if (!file) return 'translated.pptx';
    const name = file.name.replace(/\.pptx$/, '');
    return `${name}_p${startPage}-${endPage}_en.pptx`;
  };

  return (
    <MainLayout>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 && (
        <div className="animate-fade-in">
          <FileUploadArea onFileSelect={handleFileSelect} />
          {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-center">{error}</div>}
        </div>
      )}

      {currentStep === 2 && file && (
        <div className="flex flex-col lg:flex-row gap-8 grow animate-fade-in">
          <FilePreviewCard file={file} slideCount={totalSlides > 0 ? totalSlides : null} />
          <TranslationOptions
            prompt={promptInstruction}
            onPromptChange={setPromptInstruction}
            guideLoaded={guideLoaded}
            startPage={startPage} setStartPage={setStartPage}
            endPage={endPage} setEndPage={setEndPage}
            totalSlides={totalSlides}
            onTranslate={handleTranslate}
            isAnalyzing={status === 'analyzing'}
            glossary={glossary}
            onGlossaryChange={setGlossary}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            provider={provider}
            onProviderChange={handleProviderChange}
            model={model}
            onModelChange={handleModelChange}
          />
        </div>
      )}

      {currentStep === 3 && (
        <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in">
          {status !== 'done' && status !== 'error' && (
            <div className="bg-white dark:bg-surface-dark p-8 rounded-xl border border-border-light dark:border-border-dark shadow-lg text-center">
              <div className="mb-6 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              </div>
              <h3 className="text-xl font-bold mb-2">{status === 'translating' ? 'AI 번역 진행 중' : '작업 처리 중'}</h3>
              <p className="text-slate-500">{progressMessage}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="bg-white dark:bg-surface-dark p-8 rounded-xl border-2 border-red-400 shadow-lg text-center">
              <div className="mb-4 flex justify-center">
                <span className="material-symbols-outlined text-5xl text-red-500">error</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-red-600">오류가 발생했습니다</h3>
              <p className="text-slate-500 mb-6">{error || '알 수 없는 오류가 발생했습니다.'}</p>
              <button onClick={resetState} className="px-6 py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-colors">
                처음으로 돌아가기
              </button>
            </div>
          )}

          {status === 'done' && downloadUrl && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-surface-dark border-2 border-green-500/50 rounded-2xl p-8 text-center shadow-2xl animate-scale-in">
                <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6">
                  <DownloadIcon />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">번역이 완료되었습니다!</h2>
                <p className="text-slate-500 mb-8">성공적으로 번역된 파일을 아래 버튼을 눌러 다운로드하세요.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={downloadUrl}
                    download={getOutputFilename()}
                    className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">download</span>
                    다운로드
                  </a>
                  <button
                    onClick={resetState}
                    className="px-8 py-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl transition-all active:scale-95"
                  >
                    처음으로
                  </button>
                </div>
              </div>

              {qualityResult && (
                <QualityReport
                  result={qualityResult}
                  onApplyFixes={handleApplyFixes}
                  onDownloadOriginal={() => { }}
                />
              )}
            </div>
          )}

        </div>
      )}
    </MainLayout>
  );
};

export default App;
