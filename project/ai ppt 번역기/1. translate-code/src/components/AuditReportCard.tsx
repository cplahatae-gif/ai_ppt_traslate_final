import React from 'react';
import { AuditReport, AuditIssueType } from '../services/documentAudit';

interface AuditReportCardProps {
    report: AuditReport;
}

const TYPE_LABEL: Record<AuditIssueType, string> = {
    'color-loss': '색상 미적용',
    'untranslated': '미번역',
    'overflow': '박스 넘침',
};

const TYPE_ICON: Record<AuditIssueType, string> = {
    'color-loss': 'palette',
    'untranslated': 'translate',
    'overflow': 'expand_content',
};

const SEVERITY_STYLE: Record<string, string> = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-slate-50 border-slate-200 text-slate-600',
};

export const AuditReportCard: React.FC<AuditReportCardProps> = ({ report }) => {
    const clean = report.issues.length === 0;

    return (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${clean ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                    <span className="material-symbols-outlined">{clean ? 'task_alt' : 'fact_check'}</span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">문서 감사 결과</h3>
                    <p className="text-xs text-slate-500">
                        {report.checkedSlides}개 슬라이드 검사 — 색상 보존 · 번역 완성도 · 박스 넘침
                    </p>
                </div>
            </div>

            {/* 요약 배지 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                {([
                    ['색상 미적용', report.colorLossCount],
                    ['미번역', report.untranslatedCount],
                    ['박스 넘침 가능', report.overflowCount],
                ] as const).map(([label, count]) => (
                    <div key={label} className={`rounded-lg border p-3 text-center ${count === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className={`text-xl font-black ${count === 0 ? 'text-green-600' : 'text-amber-600'}`}>{count}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
                    </div>
                ))}
            </div>

            {clean ? (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    이상 없음 — 색상이 모두 적용되었고, 한글 잔존과 심각한 박스 넘침이 감지되지 않았습니다.
                </p>
            ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {report.issues.map((issue, i) => (
                        <li key={i} className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs ${SEVERITY_STYLE[issue.severity]}`}>
                            <span className="material-symbols-outlined text-sm mt-0.5">{TYPE_ICON[issue.type]}</span>
                            <div>
                                <span className="font-bold">[슬라이드 {issue.slideNumber}] {TYPE_LABEL[issue.type]}</span>
                                <span className="ml-1.5">{issue.detail}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
