import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';

interface FilePreviewCardProps {
    file: File;
    slideCount?: number | null;
}

const THUMBNAIL_PATHS = [
    'docProps/thumbnail.jpeg',
    'docProps/thumbnail.jpg',
    'docProps/thumbnail.png',
    'ppt/media/thumbnail.jpeg',
    'ppt/media/thumbnail.jpg',
];

const mimeForPath = (path: string): string =>
    path.toLowerCase().endsWith('.png') ? 'image/png'
        : path.toLowerCase().endsWith('.gif') ? 'image/gif'
            : 'image/jpeg';

// MIME 타입을 명시한 Blob URL 생성 (타입 없는 Blob은 일부 브라우저에서 <img> 렌더 거부)
const entryToObjectUrl = async (zip: JSZip, path: string): Promise<string | null> => {
    const entry = zip.file(path);
    if (!entry) return null;
    const data = await entry.async('uint8array');
    if (data.length === 0) return null;
    return URL.createObjectURL(new Blob([data], { type: mimeForPath(path) }));
};

async function extractThumbnail(file: File): Promise<string | null> {
    try {
        const zip = await JSZip.loadAsync(file);

        // 1순위: PowerPoint가 저장한 문서 썸네일
        for (const path of THUMBNAIL_PATHS) {
            const url = await entryToObjectUrl(zip, path);
            if (url) return url;
        }

        // 2순위: 첫 슬라이드가 참조하는 이미지 중 가장 큰 것
        const rels = zip.file('ppt/slides/_rels/slide1.xml.rels');
        if (rels) {
            const relsXml = await rels.async('string');
            const candidates = Array.from(relsXml.matchAll(/Target="\.\.\/(media\/[^"]+\.(?:png|jpe?g|gif))"/gi))
                .map(m => `ppt/${m[1]}`)
                .slice(0, 5);
            let best: { path: string; size: number } | null = null;
            for (const path of candidates) {
                const entry = zip.file(path);
                if (!entry) continue;
                const data = await entry.async('uint8array');
                if (!best || data.length > best.size) best = { path, size: data.length };
            }
            if (best) return entryToObjectUrl(zip, best.path);
        }
    } catch {
        // ZIP 파싱 실패 시 무시
    }
    return null;
}

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, slideCount }) => {
    const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const uploadDate = new Date().toLocaleString();
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [thumbLoading, setThumbLoading] = useState(true);

    useEffect(() => {
        let objectUrl: string | null = null;
        setThumbLoading(true);
        setThumbnailUrl(null);
        extractThumbnail(file).then(url => {
            objectUrl = url;
            setThumbnailUrl(url);
            setThumbLoading(false);
        });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

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
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-6 relative overflow-hidden border border-slate-200 dark:border-slate-700">
                        {thumbLoading ? (
                            <span className="material-symbols-outlined text-5xl text-slate-300 animate-pulse">hourglass_top</span>
                        ) : thumbnailUrl ? (
                            <img
                                src={thumbnailUrl}
                                alt="슬라이드 미리보기"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent"></div>
                                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">present_to_all</span>
                            </>
                        )}
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
