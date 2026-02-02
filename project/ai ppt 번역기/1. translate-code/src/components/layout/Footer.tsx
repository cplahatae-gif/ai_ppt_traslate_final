import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="px-10 py-4 border-t-2 border-gray-200 flex items-center justify-between bg-white mt-auto">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-gray-600 font-medium">
                    시스템 정상 작동 중
                </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                <span>© 2026 AI PPT Translator</span>
            </div>
        </footer>
    );
};
