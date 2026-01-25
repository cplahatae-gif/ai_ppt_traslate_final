import React, { useState, useCallback } from 'react';
import type { EvaluationOutput, EvaluationOptions } from './src/types';
import { evaluateTranslation, getDefaultOptions, generateMarkdownReport, exportAsJSON } from './src/index';

// 상태 아이콘
const StatusIcon = ({ status }: { status: 'pass' | 'warning' | 'fail' }) => {
    const icons = { pass: '✅', warning: '⚠️', fail: '❌' };
    return <span>{icons[status]}</span>;
};

// 등급 색상
const getGradeColor = (grade: string): string => {
    const colors: { [key: string]: string } = {
        'A+': '#10b981', 'A': '#22c55e', 'B+': '#84cc16', 'B': '#a3e635',
        'C+': '#facc15', 'C': '#fbbf24', 'D': '#f97316', 'F': '#ef4444',
    };
    return colors[grade] || '#6b7280';
};

// 진행률 바
const ProgressBar = ({ progress, label }: { progress: number; label: string }) => (
    <div className="w-full">
        <div className="flex justify-between mb-1">
            <span className="text-sm text-gray-600">{label}</span>
            <span className="text-sm text-gray-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
            <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
            />
        </div>
    </div>
);

// 점수 링
const ScoreRing = ({ score, grade }: { score: number; grade: string }) => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-40 h-40 mx-auto">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="80" cy="80" r={radius}
                    fill="none" stroke="#e5e7eb" strokeWidth="12"
                />
                <circle
                    cx="80" cy="80" r={radius}
                    fill="none" stroke={getGradeColor(grade)} strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" style={{ color: getGradeColor(grade) }}>{score}</span>
                <span className="text-2xl font-semibold text-gray-600">{grade}</span>
            </div>
        </div>
    );
};

// 파일 업로드 컴포넌트
const FileUpload = ({
    label,
    required,
    accept,
    file,
    onFileChange
}: {
    label: string;
    required?: boolean;
    accept: string;
    file: File | null;
    onFileChange: (file: File | null) => void;
}) => (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
        <label className="block cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📁</span>
                <span className="font-medium">{label}</span>
                {required && <span className="text-red-500">*</span>}
            </div>
            <input
                type="file"
                accept={accept}
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                className="hidden"
            />
            {file ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                    <span>✓</span>
                    <span className="truncate">{file.name}</span>
                    <button
                        onClick={(e) => { e.preventDefault(); onFileChange(null); }}
                        className="text-red-500 hover:text-red-700"
                    >
                        ×
                    </button>
                </div>
            ) : (
                <div className="text-sm text-gray-500">클릭하여 파일 선택</div>
            )}
        </label>
    </div>
);

// 상세 점수 테이블
const ScoreTable = ({
    title,
    total,
    maxTotal,
    items
}: {
    title: string;
    total: number;
    maxTotal: number;
    items: { item: string; score: number; maxScore: number; status: 'pass' | 'warning' | 'fail'; description: string }[];
}) => (
    <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {title}
            <span className="text-sm font-normal text-gray-500">({total}/{maxTotal})</span>
        </h3>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b">
                    <th className="text-left py-2">항목</th>
                    <th className="text-center py-2">점수</th>
                    <th className="text-center py-2">상태</th>
                    <th className="text-left py-2">설명</th>
                </tr>
            </thead>
            <tbody>
                {items.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{row.item}</td>
                        <td className="text-center py-2">{row.score}/{row.maxScore}</td>
                        <td className="text-center py-2"><StatusIcon status={row.status} /></td>
                        <td className="py-2 text-gray-600 text-xs">{row.description}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// 이슈 목록
const IssueList = ({ issues }: { issues: EvaluationOutput['issues'] }) => {
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3">⚠️ 상세 이슈 ({issues.length}건)</h3>

            {highIssues.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-medium text-red-600 mb-2">🔴 High ({highIssues.length})</h4>
                    <ul className="space-y-1 text-sm">
                        {highIssues.slice(0, 10).map((issue, i) => (
                            <li key={i} className="text-gray-700">
                                • <strong>Slide {issue.slideNumber}</strong> {issue.location}: {issue.description}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {mediumIssues.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-medium text-yellow-600 mb-2">🟡 Medium ({mediumIssues.length})</h4>
                    <ul className="space-y-1 text-sm">
                        {mediumIssues.slice(0, 10).map((issue, i) => (
                            <li key={i} className="text-gray-700">
                                • <strong>Slide {issue.slideNumber}</strong> {issue.location}: {issue.description}
                            </li>
                        ))}
                        {mediumIssues.length > 10 && (
                            <li className="text-gray-500 italic">... 외 {mediumIssues.length - 10}건</li>
                        )}
                    </ul>
                </div>
            )}

            {lowIssues.length > 0 && (
                <div>
                    <h4 className="font-medium text-green-600 mb-2">🟢 Low ({lowIssues.length})</h4>
                    <ul className="space-y-1 text-sm">
                        {lowIssues.slice(0, 5).map((issue, i) => (
                            <li key={i} className="text-gray-700">
                                • <strong>Slide {issue.slideNumber}</strong> {issue.location}: {issue.description}
                            </li>
                        ))}
                        {lowIssues.length > 5 && (
                            <li className="text-gray-500 italic">... 외 {lowIssues.length - 5}건</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

// 메인 앱
export default function App() {
    // 파일 상태
    const [koreanFile, setKoreanFile] = useState<File | null>(null);
    const [englishFile, setEnglishFile] = useState<File | null>(null);
    const [glossaryFile, setGlossaryFile] = useState<File | null>(null);
    const [referenceFile, setReferenceFile] = useState<File | null>(null);

    // 평가 상태
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [result, setResult] = useState<EvaluationOutput | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 옵션
    const [options, setOptions] = useState<EvaluationOptions>(getDefaultOptions());

    // 평가 실행
    const handleEvaluate = useCallback(async () => {
        if (!koreanFile || !englishFile) {
            setError('한글 원본과 영어 번역본 파일이 필요합니다.');
            return;
        }

        setIsEvaluating(true);
        setError(null);
        setProgress(0);
        setResult(null);

        try {
            const output = await evaluateTranslation(
                {
                    koreanFile,
                    translatedFile: englishFile,
                    glossaryFile: glossaryFile || undefined,
                    referenceFile: referenceFile || undefined,
                    options,
                },
                (step, prog) => {
                    setProgressLabel(step);
                    setProgress(prog);
                }
            );

            setResult(output);
        } catch (err) {
            setError(err instanceof Error ? err.message : '평가 중 오류가 발생했습니다.');
        } finally {
            setIsEvaluating(false);
        }
    }, [koreanFile, englishFile, glossaryFile, referenceFile, options]);

    // 결과 다운로드
    const handleDownload = (type: 'json' | 'md') => {
        if (!result) return;

        const content = type === 'json'
            ? exportAsJSON(result)
            : generateMarkdownReport(result);

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translation_quality_report.${type}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-6xl mx-auto p-6">
                {/* 헤더 */}
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        🎯 PPTX 번역 품질 평가기
                    </h1>
                    <p className="text-gray-600">
                        한글 원본과 영어 번역본을 비교하여 품질 점수를 제공합니다
                    </p>
                </header>

                {/* 파일 업로드 섹션 */}
                <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">📁 파일 업로드</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FileUpload
                            label="한글 원본 (KR)"
                            required
                            accept=".pptx"
                            file={koreanFile}
                            onFileChange={setKoreanFile}
                        />
                        <FileUpload
                            label="영어 번역본 (EN)"
                            required
                            accept=".pptx"
                            file={englishFile}
                            onFileChange={setEnglishFile}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FileUpload
                            label="단어장 (선택)"
                            accept=".txt"
                            file={glossaryFile}
                            onFileChange={setGlossaryFile}
                        />
                        <FileUpload
                            label="참조본 (선택)"
                            accept=".pptx"
                            file={referenceFile}
                            onFileChange={setReferenceFile}
                        />
                    </div>
                </section>

                {/* 옵션 섹션 */}
                <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">⚙️ 평가 설정</h2>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={options.enableVisualScore}
                                onChange={(e) => setOptions({ ...options, enableVisualScore: e.target.checked })}
                                className="rounded"
                            />
                            <span>시각적 평가 (80점)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={options.enableTranslationScore}
                                onChange={(e) => setOptions({ ...options, enableTranslationScore: e.target.checked })}
                                className="rounded"
                            />
                            <span>번역 평가 (20점)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={options.enableGlossaryCheck}
                                onChange={(e) => setOptions({ ...options, enableGlossaryCheck: e.target.checked })}
                                disabled={!glossaryFile}
                                className="rounded"
                            />
                            <span className={!glossaryFile ? 'text-gray-400' : ''}>단어장 준수 평가</span>
                        </label>
                    </div>
                </section>

                {/* 평가 버튼 */}
                <div className="text-center mb-6">
                    <button
                        onClick={handleEvaluate}
                        disabled={!koreanFile || !englishFile || isEvaluating}
                        className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${!koreanFile || !englishFile || isEvaluating
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                            }`}
                    >
                        {isEvaluating ? '평가 중...' : '🔍 평가 시작'}
                    </button>
                </div>

                {/* 진행률 */}
                {isEvaluating && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <ProgressBar progress={progress} label={progressLabel} />
                    </div>
                )}

                {/* 에러 */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                        ❌ {error}
                    </div>
                )}

                {/* 결과 */}
                {result && (
                    <div className="space-y-6">
                        {/* 종합 점수 */}
                        <section className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <ScoreRing score={result.score.total} grade={result.score.grade} />
                                <div className="flex-1 text-center md:text-left">
                                    <h2 className="text-2xl font-bold mb-2">종합 점수</h2>
                                    <p className="text-gray-600 mb-4">
                                        {result.metadata.koreanFileName} → {result.metadata.translatedFileName}
                                    </p>
                                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                        <div className="text-sm">
                                            <span className="text-gray-500">슬라이드:</span>
                                            <span className="font-medium ml-1">{result.metadata.slideCount}개</span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-gray-500">텍스트 항목:</span>
                                            <span className="font-medium ml-1">{result.metadata.totalTextItems}개</span>
                                        </div>
                                        {result.metadata.glossaryTermCount > 0 && (
                                            <div className="text-sm">
                                                <span className="text-gray-500">단어장 용어:</span>
                                                <span className="font-medium ml-1">{result.metadata.glossaryTermCount}개</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleDownload('md')}
                                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                    >
                                        📄 MD 다운로드
                                    </button>
                                    <button
                                        onClick={() => handleDownload('json')}
                                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                                    >
                                        📊 JSON 다운로드
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* 점수 상세 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ScoreTable
                                title="📊 시각적 품질"
                                total={result.score.visual.total}
                                maxTotal={80}
                                items={result.report.visualDetails}
                            />
                            <ScoreTable
                                title="📝 번역 품질"
                                total={result.score.translation.total}
                                maxTotal={20}
                                items={result.report.translationDetails}
                            />
                        </div>

                        {/* 단어장 미준수 목록 */}
                        {result.report.glossaryMismatches.length > 0 && (
                            <section className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-lg font-semibold mb-3">
                                    📖 단어장 미준수 ({result.report.glossaryMismatches.length}건)
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-gray-50">
                                                <th className="text-left py-2 px-3">원문</th>
                                                <th className="text-left py-2 px-3">기대 번역</th>
                                                <th className="text-left py-2 px-3">실제 번역</th>
                                                <th className="text-center py-2 px-3">슬라이드</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.report.glossaryMismatches.slice(0, 20).map((m, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="py-2 px-3 font-medium">{m.korean}</td>
                                                    <td className="py-2 px-3 text-green-600">{m.expectedEnglish[0]}</td>
                                                    <td className="py-2 px-3 text-red-600 truncate max-w-xs">
                                                        {m.actualEnglish.substring(0, 40)}{m.actualEnglish.length > 40 ? '...' : ''}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">{m.slideNumber}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {result.report.glossaryMismatches.length > 20 && (
                                        <p className="text-gray-500 text-sm mt-2 text-center">
                                            ... 외 {result.report.glossaryMismatches.length - 20}건
                                        </p>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* 이슈 목록 */}
                        {result.issues.length > 0 && (
                            <IssueList issues={result.issues} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
