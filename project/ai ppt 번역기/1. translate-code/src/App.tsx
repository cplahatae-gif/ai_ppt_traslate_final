import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { extractTextFromPptx, replaceTextInPptx, TextItem, countSlides } from './services/pptxService';
import { translateTexts } from './services/geminiService';
import { MainLayout } from './components/layout/MainLayout';
import { StepIndicator } from './components/common/StepIndicator';
import { FileUploadArea } from './components/upload/FileUploadArea';
import { FilePreviewCard } from './components/preview/FilePreviewCard';
import { TranslationOptions } from './components/config/TranslationOptions';
import { StatusDisplay } from './components/StatusDisplay';
import { DownloadIcon } from './components/icons';
import { useAuth } from './hooks/useAuth';
import { AuthOverlay } from './components/auth/AuthOverlay';
import { LimitStatus } from './types';

import { tokenManager } from './services/TokenManager';
import { jobService } from './services/JobService';
import { qualityService } from './services/QualityService';
import { QualityReport } from './components/QualityReport';
import { QualityResult } from './types';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { emailService } from './services/email/EmailService';
import { authService } from './services/auth/AuthService';
import { isSupabaseConfigured } from './lib/supabase';
import { ProviderId, getProviderConfig, getApiKeyFromStorage, saveApiKeyToStorage } from './services/modelCatalog';

type Status = 'idle' | 'analyzing' | 'translating' | 'building' | 'verifying' | 'done' | 'error';

const App: React.FC = () => {
  const { user, loading, checkUser, updateApiKey: saveApiKeyToDb } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [promptInstruction, setPromptInstruction] = useState('');
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

  const [tokenLimit, setTokenLimit] = useState<LimitStatus | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  const originalTextsRef = React.useRef<string[]>([]);
  const translatedTextsRef = React.useRef<string[]>([]);
  const textItemsRef = React.useRef<TextItem[]>([]);

  // Load initial data
  useEffect(() => {
    if (user?.apiKey) {
      setApiKey(user.apiKey);
    } else {
      const localKey = localStorage.getItem('gemini_api_key') || '';
      if (localKey) setApiKey(localKey);
    }
    if (user) {
      tokenManager.getLimitStatus(user.id).then(setTokenLimit);
    }
  }, [user]);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const promptRes = await fetch('/guide.md');
        if (promptRes.ok) setPromptInstruction(await promptRes.text());
        const glossaryRes = await fetch('/glossary.txt');
        if (glossaryRes.ok) setGlossary(await glossaryRes.text());
      } catch (err) {
        console.warn('Failed to load default resources:', err);
      }
    };
    loadResources();
  }, []);

  // Helper: Determine Current Step
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

  const handleApiKeyChange = useCallback(async (newKey: string) => {
    setApiKey(newKey);
    saveApiKeyToStorage(provider, newKey);
    if (user) await saveApiKeyToDb(newKey);
  }, [user, saveApiKeyToDb, provider]);

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
      setStatus('idle'); // 분석 완료 후 Config 단계로 전환
    } catch (e) {
      setError('파일을 분석하는 데 실패했습니다. 손상된 파일일 수 있습니다.');
      setStatus('error');
    }
  };

  const handleTranslate = useCallback(async () => {
    if (!file) return;

    let jobId: string | null = null;
    try {
      if (user) {
        const currentStatus = await tokenManager.getLimitStatus(user.id);
        setTokenLimit(currentStatus);
        if (!currentStatus.canProceed) throw new Error('일일 토큰 사용 한도에 도달했습니다.');
        jobId = await jobService.createJob(user.id, file.name);
      }

      // Step 3 진입
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
        if (jobId) await jobService.updateJob(jobId, 'failed');
        return;
      }

      if (jobId) await jobService.updateJob(jobId, 'translating', tokens);
      setStatus('translating');
      setProgressMessage(`AI 번역 시작... (예상 토큰: ${tokens.toLocaleString()})`);

      const onProgress = (completed: number, total: number) => {
        const percent = Math.round((completed / total) * 100);
        setProgressMessage(`번역 진행 중... ${percent}% 완료`);
      };

      const translatedTexts = await translateTexts(originalTexts, onProgress, promptInstruction, glossary, 20, apiKey, provider, model);

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

      if (user) {
        await tokenManager.logUsage(user.id, tokens);
        const updatedStatus = await tokenManager.getLimitStatus(user.id);
        setTokenLimit(updatedStatus);
      }

      if (jobId) await jobService.updateJob(jobId, 'completed', tokens);

      // Quality Check
      setStatus('verifying');
      setProgressMessage('AI 품질 분석 진행 중...');

      if (user) {
        const notifyEnabled = localStorage.getItem(`email_notify_${user.email}`) === 'true';
        if (notifyEnabled) {
          emailService.sendTranslationComplete(user.email, user.name, file.name, tokens).catch(console.error);
        }
      }

      const [qResponse] = await Promise.all([
        qualityService.verify(jobId!, originalTexts, translatedTexts, apiKey),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (qResponse) {
        setQualityResult(qResponse.result);
        if (user) {
          await tokenManager.logUsage(user.id, qResponse.tokens);
          setTokenLimit(await tokenManager.getLimitStatus(user.id));
        }
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
      if (jobId) await jobService.updateJob(jobId, 'failed');

      if (user) {
        const notifyEnabled = localStorage.getItem(`email_notify_${user.email}`) === 'true';
        if (notifyEnabled) {
          emailService.sendTranslationFailed(user.email, user.name, file.name, errorMsg).catch(console.error);
        }
      }
    }
  }, [file, user, promptInstruction, glossary, startPage, endPage, apiKey, provider, model]);

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

      // 자동 다운로드
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

  if (loading) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (isSupabaseConfigured() && !user) return <AuthOverlay onSuccess={checkUser} />;

  // Admin Dashboard (권한 없을 경우 대기 화면)
  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    window.location.reload();
  };

  if (user && !user.isApproved && !user.isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl border-2 border-black text-center shadow-float">
          <h2 className="text-2xl font-black text-black mb-4">승인 대기 중</h2>
          <p className="text-gray-600 mb-6">관리자가 계정을 승인할 때까지 잠시 기다려주세요.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={checkUser} className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg text-white font-bold transition-colors">새로고침</button>
            <button onClick={handleLogout} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-black font-bold transition-colors">로그아웃</button>
          </div>
        </div>
      </div>
    )
  }

  // 관리자 대시보드 표시
  if (showAdminDashboard && user?.isAdmin) {
    return <AdminDashboard currentUser={user} onLogout={handleLogout} onBack={() => setShowAdminDashboard(false)} />;
  }

  return (
    <MainLayout user={user} onLogout={handleLogout} onLogin={() => window.location.reload()}>
      {/* 관리자 버튼 */}
      {user?.isAdmin && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAdminDashboard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg font-bold text-sm transition-colors shadow-md"
          >
            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            관리자 대시보드
          </button>
        </div>
      )}
      <StepIndicator currentStep={currentStep} />

      {/* Step 1: Upload */}
      {currentStep === 1 && (
        <div className="animate-fade-in">
          <FileUploadArea onFileSelect={handleFileSelect} />
          {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-center">{error}</div>}
        </div>
      )}

      {/* Step 2: Config */}
      {currentStep === 2 && file && (
        <div className="flex flex-col lg:flex-row gap-8 grow animate-fade-in">
          <FilePreviewCard file={file} slideCount={totalSlides > 0 ? totalSlides : null} />
          <TranslationOptions
            prompt={promptInstruction}
            onPromptChange={setPromptInstruction}
            startPage={startPage} setStartPage={setStartPage}
            endPage={endPage} setEndPage={setEndPage}
            totalSlides={totalSlides}
            onTranslate={handleTranslate}
            isAnalyzing={status === 'analyzing'}
            userEmail={user?.email ?? ''}
            userName={user?.name ?? ''}
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

      {/* Step 3: Processing & Results */}
      {currentStep === 3 && (
        <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in">
          {/* Status Display Area */}
          {status !== 'done' && status !== 'error' && (
            <div className="bg-white dark:bg-surface-dark p-8 rounded-xl border border-border-light dark:border-border-dark shadow-lg text-center">
              <div className="mb-6 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              </div>
              <h3 className="text-xl font-bold mb-2">{status === 'translating' ? 'AI 번역 진행 중' : '작업 처리 중'}</h3>
              <p className="text-slate-500">{progressMessage}</p>
              {tokenLimit && (
                <div className="mt-4 text-xs text-slate-400">
                  일일 토큰 사용량: {tokenLimit.dailyUsed.toLocaleString()} / {tokenLimit.dailyLimit.toLocaleString()}
                </div>
              )}
            </div>
          )}
          {/* Error Display */}
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

              {/* Quality Report */}
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