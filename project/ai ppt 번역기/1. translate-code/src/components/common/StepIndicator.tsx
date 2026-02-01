import React from 'react';

/**
 * 단계:
 * 1: 파일 선택 (Upload)
 * 2: 옵션 설정 (Config)
 * 3: 번역 진행 및 완료 (Process)
 */
interface StepIndicatorProps {
    currentStep: 1 | 2 | 3;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
    return (
        <div className="flex items-center gap-4 mb-8">
            {/* Step 1 */}
            <StepItem
                step={1}
                label="업로드"
                currentStep={currentStep}
            />

            <Separator />

            {/* Step 2 */}
            <StepItem
                step={2}
                label="번역 구성 설정"
                currentStep={currentStep}
            />

            <Separator />

            {/* Step 3 */}
            <StepItem
                step={3}
                label="번역 및 검수"
                currentStep={currentStep}
            />
        </div>
    );
};

const StepItem: React.FC<{ step: number; label: string; currentStep: number }> = ({ step, label, currentStep }) => {
    const isActive = step === currentStep;
    const isCompleted = step < currentStep;

    // 상태에 따른 스타일 정의
    let circleClass = "border border-slate-300 text-slate-400"; // 기본 (비활성)
    let textClass = "text-slate-400 font-medium";

    if (isActive) {
        circleClass = "bg-primary text-white border-primary shadow-lg shadow-primary/30";
        textClass = "text-primary font-bold";
    } else if (isCompleted) {
        circleClass = "bg-green-500 text-white border-green-500";
        textClass = "text-slate-600 dark:text-slate-300 font-medium";
    }

    return (
        <div className={`flex items-center gap-2 text-sm transition-all duration-300 ${isActive ? 'scale-105' : ''}`}>
            <span className={`size-6 rounded-full flex items-center justify-center text-xs transition-colors duration-300 ${circleClass}`}>
                {isCompleted ? <span className="material-symbols-outlined text-sm">check</span> : step}
            </span>
            <span className={textClass}>{label}</span>
        </div>
    );
};

const Separator: React.FC = () => (
    <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div>
);
