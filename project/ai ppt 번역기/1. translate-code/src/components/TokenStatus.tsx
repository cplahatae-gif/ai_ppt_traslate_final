import React from 'react';

interface TokenStatusProps {
    used: number;
    limit: number;
    estimated?: number;
    requests?: number;
    requestLimit?: number;
}

export const TokenStatus: React.FC<TokenStatusProps> = ({
    used,
    limit,
    estimated = 0,
    requests = 0,
    requestLimit = 1500
}) => {
    const percent = Math.min(100, Math.round((used / limit) * 100));
    const requestPercent = Math.min(100, Math.round((requests / requestLimit) * 100));
    const isExceeded = used >= limit;
    const willExceed = (used + estimated) > limit;
    const remaining = Math.max(0, limit - used);

    const getStatusColor = () => {
        if (isExceeded) return 'bg-red-500';
        if (percent > 80) return 'bg-yellow-500';
        return 'bg-primary';
    };

    const getStatusText = () => {
        if (isExceeded) return { text: '한도 초과', color: 'text-red-600' };
        if (percent > 80) return { text: '주의', color: 'text-yellow-600' };
        return { text: '정상', color: 'text-green-600' };
    };

    const status = getStatusText();

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-black transition-colors">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">token</span>
                    <span className="text-xs font-bold text-black">토큰 사용량</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status.color} bg-opacity-10`}>
                    {status.text}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                <div
                    className={`h-2 rounded-full transition-all duration-500 ${getStatusColor()}`}
                    style={{ width: `${percent}%` }}
                ></div>
            </div>

            {/* Stats */}
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500 font-medium">
                    {used.toLocaleString()} / {limit.toLocaleString()} 토큰
                </span>
                <span className="text-gray-400 font-bold">
                    남은 양: {remaining.toLocaleString()}
                </span>
            </div>

            {/* Estimated Warning */}
            {estimated > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">이번 작업 예상: +{estimated.toLocaleString()}</span>
                    {willExceed && (
                        <span className="text-red-500 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            한도 초과 예상
                        </span>
                    )}
                </div>
            )}

            {/* Requests (optional) */}
            {requests > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="text-gray-500">요청 횟수</span>
                        <span className="text-gray-400">{requests} / {requestLimit}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                            className="h-1 rounded-full bg-gray-400 transition-all duration-500"
                            style={{ width: `${requestPercent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Warning */}
            {!isExceeded && !willExceed && percent > 80 && (
                <p className="text-[9px] text-yellow-600 mt-2 font-medium flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">info</span>
                    오늘 사용 가능한 토큰이 얼마 남지 않았습니다.
                </p>
            )}
        </div>
    );
};

