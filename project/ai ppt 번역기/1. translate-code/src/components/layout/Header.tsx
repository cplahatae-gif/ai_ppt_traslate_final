import React from 'react';

interface HeaderProps {
    user?: any;
    onLogout?: () => void;
    onLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onLogin }) => {
    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b-2 border-black transition-colors">
            <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo Area */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
                    <div className="bg-primary p-1.5 rounded-lg text-white shadow-lg shadow-primary/30">
                        <span className="material-symbols-outlined text-2xl block">terminal</span>
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-black uppercase leading-none">
                        AI PPT <span className="text-primary">Translator</span>
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-8">
                    <a href="#" className="text-sm font-bold text-gray-dark hover:text-black hover:underline transition-all">번역하기</a>
                    <a href="#" className="text-sm font-bold text-gray-dark hover:text-black hover:underline transition-all">기록</a>
                    <a href="#" className="text-sm font-bold text-gray-dark hover:text-black hover:underline transition-all">가이드</a>
                </nav>

                {/* Right Area (User / Login) */}
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <div className="flex items-center gap-3 pl-4 border-l-2 border-gray-200">
                                <span className="text-sm font-bold text-black hidden sm:block">
                                    {user.name}
                                </span>
                                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md border border-black">
                                    {user.name[0]}
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="로그아웃"
                                >
                                    <span className="material-symbols-outlined text-xl">logout</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={onLogin}
                            className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-black text-white text-sm font-bold transition-all hover:bg-gray-800 active:scale-95 shadow-lg"
                        >
                            로그인
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
