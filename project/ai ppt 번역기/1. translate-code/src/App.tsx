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
import { auditDocument, remediateOverflows, AuditReport } from './services/documentAudit';
import { AuditReportCard } from './components/AuditReportCard';
import { validateTagPreservation, repairColorTags } from './services/aiProvider';
import { ProviderId, getProviderConfig, getApiKeyFromStorage, saveApiKeyToStorage } from './services/modelCatalog';

type Status = 'idle' | 'analyzing' | 'translating' | 'fixing' | 'building' | 'verifying' | 'done' | 'error';

interface FixSummary {
    retranslated: number;
    suggestionsApplied: number;
    boxesAdjusted: number;
    shortened: number;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [promptInstruction, setPromptInstruction] = useState('');
  const [guidePrompt, setGuidePrompt] = useState('');
  const [guideLoaded, setGuideLoaded] = useState(false);
  const [glossary, setGlossary] = useState('');

  const [provider, setProvider] = useState<ProviderId>(() =>
    (localStorage.getItem('ai_provider') as ProviderId) || 'gemini'
  );
  const [model, setModel] = useState<string>(() => {
    const storedProvider = (localStorage.getItem('ai_provider') as ProviderId) || 'gemini';
    const storedModel = localStorage.getItem('ai_model');
    const config = getProviderConfig(storedProvider);
    const isValid = config.models.some(m => m.id === storedModel);
    return isValid ? storedModel! : config.defaultModel;
  });
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

  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [fixSummary, setFixSummary] = useState<FixSummary | null>(null);

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
    if (status === 'analyzing' || status === 'translating' || status === 'fixing' || status === 'building' || status === 'verifying' || status === 'done' || status === 'error') return 3;
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
    setAuditReport(null);
    setFixSummary(null);
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
    setAuditReport(null);
    setFixSummary(null);
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
      // ---- 1. 추출 ----
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

      // ---- 2. 번역 ----
      setStatus('translating');
      setProgressMessage(`AI 번역 시작... (예상 토큰: ${tokens.toLocaleString()})`);

      const onProgress = (completed: number, total: number) => {
        const percent = Math.round((completed / total) * 100);
        setProgressMessage(`번역 진행 중... ${percent}% 완료`);
      };

      const combinedPrompt = [guidePrompt, promptInstruction].filter(s => s.trim()).join('\n\n');
      const translatedTexts = await translateTexts(originalTexts, onProgress, combinedPrompt, glossary, 20, apiKey, provider, model);

      // ---- 3. 자동 수정 1: 미번역(한글 잔존)·태그 소실 항목 재번역 ----
      setStatus('fixing');
      setProgressMessage('번역 결과 검사 중...');

      const needsRetranslation: number[] = [];
      for (let i = 0; i < translatedTexts.length; i++) {
        const plain = (translatedTexts[i] ?? '').replace(/<[^>]*>/g, '');
        const hasKorean = /[가-힣]/.test(plain);
        const tagLost = !validateTagPreservation([originalTexts[i]], [translatedTexts[i] ?? '']);
        if (hasKorean || tagLost) needsRetranslation.push(i);
      }

      let retranslated = 0;
      if (needsRetranslation.length > 0) {
        setProgressMessage(`미흡 항목 ${needsRetranslation.length}건 재번역 중...`);
        try {
          const subset = needsRetranslation.map(i => originalTexts[i]);
          const fixedTexts = await translateTexts(subset, undefined, combinedPrompt, glossary, 20, apiKey, provider, model);
          needsRetranslation.forEach((origIdx, k) => {
            const fixed = fixedTexts[k];
            if (!fixed) return;
            const fixedPlain = fixed.replace(/<[^>]*>/g, '');
            const wasImproved =
              (!/[가-힣]/.test(fixedPlain) || /[가-힣]/.test(translatedTexts[origIdx]?.replace(/<[^>]*>/g, '') ?? '')) &&
              validateTagPreservation([originalTexts[origIdx]], [fixed]);
            if (wasImproved && fixed !== translatedTexts[origIdx]) {
              translatedTexts[origIdx] = fixed;
              retranslated++;
            }
          });
        } catch (retryErr) {
          console.warn('재번역 실패 — 1차 번역 결과 사용:', retryErr);
        }
      }

      // ---- 4. 자동 수정 2: LLM 품질 분석 후 수정 제안 자동 적용 ----
      setProgressMessage('AI 품질 분석 및 수정사항 적용 중...');
      let suggestionsApplied = 0;
      try {
        const qResponse = await qualityService.verify('local', originalTexts, translatedTexts);
        if (qResponse?.result?.issues) {
          for (const issue of qResponse.result.issues) {
            const idx = issue.index;
            if (idx === undefined || idx < 0 || idx >= translatedTexts.length) continue;
            const suggestion = issue.suggestion?.trim();
            if (!suggestion) continue;
            // 제안이 색상 태그를 보존하고, 한글을 새로 들여오지 않을 때만 적용
            const safe = validateTagPreservation([originalTexts[idx]], [suggestion])
              && !/[가-힣]/.test(suggestion.replace(/<[^>]*>/g, ''));
            if (safe && suggestion !== translatedTexts[idx]) {
              translatedTexts[idx] = suggestion;
              suggestionsApplied++;
            }
          }
        }
      } catch (qErr) {
        console.warn('품질 분석 실패 — 건너뜀:', qErr);
      }

      // ---- 4.5 색상 태그 결정적 복원 (재번역으로도 못 고친 경우의 최종 방어선) ----
      // LLM이 색을 발명(※·① 등 경고 문장에 임의 빨간색)하거나 소실한 항목을
      // 원본 토큰 기준으로 강제 정합화
      for (let i = 0; i < translatedTexts.length; i++) {
        translatedTexts[i] = repairColorTags(originalTexts[i], translatedTexts[i] ?? '');
      }

      // ---- 5. 빌드 ----
      setStatus('building');
      setProgressMessage('PPTX 파일 생성 중...');

      const buildItems = (): TextItem[] => textItems.map((item, index) => ({
        ...item,
        text: translatedTexts[index],
        originalLength: originalTexts[index].replace(/<[^>]*>/g, '').length
      }));
      let finalItems = buildItems();
      let finalBlob = await replaceTextInPptx(file, finalItems);

      // ---- 6. 오버플로우 보정: 글자크기 → 박스크기 → 축약 재번역 병행 ----
      let boxesAdjusted = 0;
      let shortened = 0;
      try {
        setStatus('fixing');
        setProgressMessage('박스 넘침 보정 중 (글자크기·박스크기 조정)...');
        const rem = await remediateOverflows(finalBlob, finalItems, startPage, endPage);
        finalBlob = rem.blob;
        boxesAdjusted = rem.boxesAdjusted;

        // 조정만으로 부족한 박스만 축약 재번역 (최후 수단)
        if (rem.shortenItemIndexes.length > 0) {
          setProgressMessage(`심한 넘침 ${rem.shortenItemIndexes.length}건 축약 재번역 중...`);
          const shortenPrompt = combinedPrompt +
            '\n\n# Length Constraint (CRITICAL)\nThese texts overflow their shapes even after resizing. Produce the SHORTEST faithful translation: telegraphic style, drop articles, use standard abbreviations. Never change the meaning. Preserve ALL tags exactly.';
          const subset = rem.shortenItemIndexes.map(i => originalTexts[i]);
          const shortTexts = await translateTexts(subset, undefined, shortenPrompt, glossary, 20, apiKey, provider, model);

          rem.shortenItemIndexes.forEach((origIdx, k) => {
            const candidate = shortTexts[k];
            if (!candidate) return;
            const candPlain = candidate.replace(/<[^>]*>/g, '');
            const currPlain = (translatedTexts[origIdx] ?? '').replace(/<[^>]*>/g, '');
            const safe = candPlain.length < currPlain.length
              && !/[가-힣]/.test(candPlain)
              && validateTagPreservation([originalTexts[origIdx]], [candidate]);
            if (safe) {
              translatedTexts[origIdx] = candidate;
              shortened++;
            }
          });

          if (shortened > 0) {
            setProgressMessage('축약 반영하여 재생성 중...');
            finalItems = buildItems();
            const blob2 = await replaceTextInPptx(file, finalItems);
            const rem2 = await remediateOverflows(blob2, finalItems, startPage, endPage);
            finalBlob = rem2.blob;
            boxesAdjusted = rem2.boxesAdjusted;
          }
        }
      } catch (remErr) {
        console.warn('오버플로우 보정 실패 — 보정 전 결과 사용:', remErr);
      }

      setFixSummary({ retranslated, suggestionsApplied, boxesAdjusted, shortened });

      // ---- 7. 최종 문서 감사 ----
      setStatus('verifying');
      setProgressMessage('최종 문서 감사 중...');
      try {
        const audit = await auditDocument(finalBlob, finalItems, startPage, endPage);
        setAuditReport(audit);
      } catch (auditErr) {
        console.warn('문서 감사 실패 (번역 결과에는 영향 없음):', auditErr);
      }

      const url = URL.createObjectURL(finalBlob);
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
              <h3 className="text-xl font-bold mb-2">
                {status === 'translating' ? 'AI 번역 진행 중'
                  : status === 'fixing' ? '품질 검사 및 자동 수정 중'
                    : status === 'verifying' ? '최종 문서 감사 중'
                      : '작업 처리 중'}
              </h3>
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
                <p className="text-slate-500 mb-2">감사·품질 분석·자동 수정을 거친 최종본입니다.</p>
                {fixSummary && (fixSummary.retranslated > 0 || fixSummary.suggestionsApplied > 0 || fixSummary.boxesAdjusted > 0 || fixSummary.shortened > 0) ? (
                  <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 inline-block mb-6">
                    자동 수정 적용: 재번역 {fixSummary.retranslated}건 · 표현 개선 {fixSummary.suggestionsApplied}건 · 글자/박스 크기 보정 {fixSummary.boxesAdjusted}건 · 축약 {fixSummary.shortened}건
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mb-6">자동 수정이 필요한 항목이 없었습니다.</p>
                )}
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

              {auditReport && <AuditReportCard report={auditReport} />}
            </div>
          )}

        </div>
      )}
    </MainLayout>
  );
};

export default App;
