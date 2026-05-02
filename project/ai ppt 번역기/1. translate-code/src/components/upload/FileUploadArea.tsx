import React, { useRef, useState } from 'react';

interface FileUploadAreaProps {
    onFileSelect: (file: File) => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndSelect(e.dataTransfer.files[0]);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const validateAndSelect = (file: File) => {
        if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) {
            onFileSelect(file);
        } else {
            alert('PPT 파일(.pptx, .ppt)만 업로드 가능합니다.');
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[600px] animate-fade-in">
            {/* Headline */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-4">
                    <span className="material-symbols-outlined text-primary text-sm">bolt</span>
                    <span className="text-primary text-[10px] font-bold tracking-widest uppercase">Precision Engineering v2.0</span>
                </div>
                <h1 className="text-black tracking-tight text-[56px] font-black leading-[1.05] mb-4">
                    PPT 문서를 AI로 <span className="text-primary">정밀 번역</span>하세요
                </h1>
                <p className="text-gray-500 text-base font-medium leading-relaxed max-w-[550px] mx-auto">
                    레이아웃 유지, 전문 용어 최적화, 완벽한 폰트 보정.<br />
                    엔지니어링 수준의 정확도를 경험하십시오.
                </p>
            </div>

            {/* Drop Zone */}
            <div
                className={`w-full max-w-[520px] group relative flex flex-col items-center gap-5 rounded-xl border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 bg-white'} p-10 transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pptx,.ppt"
                    onChange={handleFileChange}
                />

                {/* Icon */}
                <div className="relative w-20 h-20 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 transition-transform duration-500 group-hover:-translate-y-1 group-hover:shadow-md">
                    <span className="material-symbols-outlined text-black text-4xl">present_to_all</span>
                    <div className="absolute -bottom-1 -right-1 size-7 rounded-md bg-primary flex items-center justify-center text-white shadow-md animate-bounce">
                        <span className="material-symbols-outlined text-sm">add</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                    <h3 className="text-black text-lg font-bold tracking-tight">
                        {isDragging ? '여기에 파일을 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
                    </h3>
                    <p className="text-gray-400 text-sm font-medium">.pptx, .ppt 지원 (최대 50MB)</p>
                </div>

                <button className="flex min-w-[160px] items-center justify-center rounded-lg h-10 px-6 bg-gray-100 text-black text-sm font-bold border border-gray-300 hover:bg-gray-200 transition-all">
                    파일 선택하기
                </button>

                {/* Security Badge */}
                <div className="absolute bottom-3 flex items-center gap-1.5 opacity-40">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    <span className="text-[10px] font-medium tracking-wide uppercase">End-to-end encrypted</span>
                </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[720px] mt-10 px-4">
                <FeatureItem icon="dashboard_customize" title="레이아웃 보존" desc="글상자 위치와 이미지 배치를 분석하여 원본 디자인을 유지합니다." />
                <FeatureItem icon="dictionary" title="용어 사전 적용" desc="전문 용어 사전을 통해 문맥에 가장 적합한 고품질 번역을 제공합니다." />
                <FeatureItem icon="text_fields" title="자동 폰트 최적화" desc="대상 언어에 가장 잘 어울리는 가독성 높은 폰트를 매칭합니다." />
            </div>
        </div>
    );
};

const FeatureItem: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div className="flex flex-col gap-2.5 p-4 rounded-lg border border-gray-200 bg-white transition-all hover:border-primary/30 hover:-translate-y-0.5">
        <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div className="flex flex-col gap-1">
            <h2 className="text-black text-sm font-bold">{title}</h2>
            <p className="text-gray-500 text-xs font-normal leading-relaxed">{desc}</p>
        </div>
    </div>
);
