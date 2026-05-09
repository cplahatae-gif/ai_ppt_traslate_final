import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b-2 border-black">
            <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
                    <div className="bg-primary p-2 rounded-lg text-white shadow-md">
                        <span className="material-symbols-outlined text-2xl block">terminal</span>
                    </div>
                    <h1 className="text-xl font-black tracking-tight text-black uppercase leading-none">
                        AI PPT <span className="text-primary">Translator</span>
                    </h1>
                </div>
            </div>
        </header>
    );
};
