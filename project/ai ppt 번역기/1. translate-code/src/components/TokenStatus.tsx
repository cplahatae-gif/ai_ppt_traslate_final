import React from 'react';

interface TokenStatusProps {
    used: number;
    limit: number;
    estimated?: number;
}

export const TokenStatus: React.FC<TokenStatusProps> = ({ used, limit, estimated = 0 }) => {
    const percent = Math.min(100, Math.round((used / limit) * 100));
    const isExceeded = used >= limit;
    const willExceed = (used + estimated) > limit;

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-400">일일 토큰 사용량</span>
                <span className={`text-sm font-bold ${isExceeded ? 'text-red-400' : 'text-purple-400'}`}>
                    {used.toLocaleString()} / {limit.toLocaleString()}
                </span>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${isExceeded ? 'bg-red-500' : 'bg-purple-600'}`}
                    style={{ width: `${percent}%` }}
                ></div>
            </div>

            {estimated > 0 && (
                <div className="text-xs text-gray-400 flex justify-between">
                    <span>이번 작업 예상: +{estimated.toLocaleString()}</span>
                    {willExceed && (
                        <span className="text-red-400 font-semibold">⚠️ 일일 한도를 초과할 수 있습니다.</span>
                    )}
                </div>
            )}

            {!isExceeded && !willExceed && percent > 80 && (
                <p className="text-xs text-yellow-500 mt-2 italic">
                    오늘 사용 가능한 토큰이 얼마 남지 않았습니다.
                </p>
            )}
        </div>
    );
};
