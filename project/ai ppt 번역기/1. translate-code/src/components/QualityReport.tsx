import React from 'react';
import type { QualityResult, QualityIssue } from '../types';

interface QualityReportProps {
    result: QualityResult;
    onApplyFixes: (selectedIndices: number[]) => void;
    onDownloadOriginal: () => void;
}

export const QualityReport: React.FC<QualityReportProps> = ({ result, onApplyFixes, onDownloadOriginal }) => {
    const [selectedIndices, setSelectedIndices] = React.useState<number[]>([]);

    // 초기화: 모든 제안이 있는 이슈는 기본적으로 체크
    // React.useEffect(() => {
    //     if (result.issues) {
    //         const indices = result.issues
    //             .filter(issue => issue.suggestion && issue.index !== undefined)
    //             .map(issue => issue.index!)
    //             // 중복 제거
    //             .filter((value, index, self) => self.indexOf(value) === index);
    //         setSelectedIndices(indices);
    //     }
    // }, [result]);

    // --> 사용자가 직접 선택하는 것이 좋으므로 기본값은 빈 배열로 시작하거나, 전체 선택을 위한 버튼을 두는 것이 좋음.
    // 일단은 사용자 선택 유도로 빈 배열 시작.

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleApply = () => {
        onApplyFixes(selectedIndices);
    };
    const scorePercent = Math.round(result.overallScore * 100);

    const getGrade = (score: number) => {
        if (score >= 0.9) return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-400/10' };
        if (score >= 0.8) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/10' };
        if (score >= 0.7) return { label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
        return { label: 'Needs Review', color: 'text-red-400', bg: 'bg-red-400/10' };
    };

    const grade = getGrade(result.overallScore);

    const getSeverityBadge = (severity: QualityIssue['severity']) => {
        const colors = {
            high: 'bg-red-500/20 text-red-400 border-red-500/50',
            medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            low: 'bg-blue-500/20 text-blue-400 border-blue-500/50'
        };
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colors[severity]}`}>
                {severity.toUpperCase()}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-8 shadow-xl animate-fade-in text-left">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">verified_user</span> AI 품질 분석 리포트
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">AI가 번역 결과의 일관성과 정확도를 검증했습니다.</p>
                </div>
                <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${grade.color.replace('text-', 'border-').replace('400', '200')} ${grade.bg}`}>
                    <span className={`text-3xl font-black ${grade.color}`}>{scorePercent}점</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${grade.color}`}>{grade.label}</span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {result.issues && result.issues.length > 0 ? (
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wide">
                            주요 발견 사항 <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs">{result.issues.length}</span>
                        </h4>
                        <div className="grid gap-3">
                            {result.issues.map((issue, idx) => {
                                const hasSuggestion = !!issue.suggestion && issue.index !== undefined;
                                const isSelected = hasSuggestion && selectedIndices.includes(issue.index!);

                                return (
                                    <div key={idx} className={`bg-slate-50 dark:bg-slate-900/50 border ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-600`}>
                                        <div className="flex gap-4">
                                            {hasSuggestion && (
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelection(issue.index!)}
                                                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex gap-2 items-center">
                                                        {getSeverityBadge(issue.severity)}
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{issue.type}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{issue.location}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                                    {issue.description}
                                                </p>
                                                {issue.suggestion && (
                                                    <div
                                                        className={`cursor-pointer rounded-lg p-3 border transition-colors ${isSelected ? 'bg-white dark:bg-slate-800 border-primary/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                                                        onClick={() => hasSuggestion && toggleSelection(issue.index!)}
                                                    >
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                                                            <span className="font-bold whitespace-nowrap text-primary">💡 추천 개선안:</span>
                                                            <span className="font-medium">{issue.suggestion}</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center bg-green-50/50 dark:bg-green-900/10 rounded-2xl border border-dashed border-green-200 dark:border-green-800">
                        <span className="material-symbols-outlined text-4xl text-green-500 mb-2">verified</span>
                        <p className="text-green-700 dark:text-green-400 font-bold">완벽합니다!</p>
                        <p className="text-sm text-green-600 dark:text-green-500">특별한 품질 이슈가 발견되지 않았습니다.</p>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-400 italic">
                    * AI가 문서의 모든 텍스트를 전수 검사하였습니다. 선택한 항목만 수정되어 다운로드됩니다.
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onDownloadOriginal}
                        className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                        수정 없이 원본 다운로드
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-5 py-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                        {selectedIndices.length > 0 ? `${selectedIndices.length}개 수정사항 적용 및 다운로드` : '수정사항 적용 및 다운로드'}
                    </button>
                </div>
            </div>
        </div>
    );
};
