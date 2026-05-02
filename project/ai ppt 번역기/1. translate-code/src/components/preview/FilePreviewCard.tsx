import React from 'react';

interface FilePreviewCardProps {
    file: File;
    slideCount?: number | null;
}

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, slideCount }) => {
    const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const uploadDate = new Date().toLocaleString();

    return (
        <aside className="w-full lg:w-[400px] flex flex-col gap-6 animate-scale-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center px-4 py-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Preview</span>
                    <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">verified</span> Verified
                    </span>
                </div>
                <div className="p-6">
                    {/* Placeholder Thumbnail */}
                    <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-6 relative group overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent"></div>
                        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">present_to_all</span>
                        <div className="absolute bottom-4 left-4 right-4 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="bg-primary h-full w-full animate-pulse"></div>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">파일명</label>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={file.name}>
                                {file.name}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">파일 크기</label>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{formattedSize}</p>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">총 슬라이드</label>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {slideCount !== null ? `${slideCount} 페이지` : '분석 중...'}
                                </p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-slate-500">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            <span className="text-xs">업로드: {uploadDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Context Info Box */}
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900/30">
                <div className="flex gap-3">
                    <span className="material-symbols-outlined text-primary text-xl">info</span>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        설정된 구성에 따라 인공지능이 맥락을 분석합니다. 전문 용어가 많은 경우 하단의 <span className="font-bold text-slate-800 dark:text-slate-200">추가 지시사항</span>에 입력해 주세요.
                    </p>
                </div>
            </div>
        </aside>
    );
};
