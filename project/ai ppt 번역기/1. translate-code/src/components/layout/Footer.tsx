import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="px-10 py-6 border-t-2 border-gray-200 flex items-center justify-between bg-gray-50 mt-auto">
            <div className="flex items-center gap-6">
                <span className="hidden sm:inline text-[11px] font-bold text-gray-500 tracking-widest uppercase">
                    Ready for upload
                </span>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[11px] text-black font-bold uppercase tracking-wider">
                        System Status: Optimal
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-500 font-medium">
                <span>VER: 2.4.0-STABLE</span>
                <div className="h-3 w-px bg-gray-300"></div>
                <span>© 2024 AI PPT TRANSLATOR</span>
            </div>
        </footer>
    );
};
