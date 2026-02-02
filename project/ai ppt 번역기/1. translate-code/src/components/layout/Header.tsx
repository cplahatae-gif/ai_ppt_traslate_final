import React from 'react';
import { authService } from '../../services/auth/AuthService';

interface HeaderProps {
    user?: any;
    onLogout?: () => void;
    onLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onLogin }) => {
    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error('Logout failed:', err);
        }
        if (onLogout) onLogout();
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b-2 border-black">
            <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
                {/* Logo Area */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
                    <div className="bg-primary p-2 rounded-lg text-white shadow-md">
                        <span className="material-symbols-outlined text-2xl block">terminal</span>
                    </div>
                    <h1 className="text-xl font-black tracking-tight text-black uppercase leading-none">
                        AI PPT <span className="text-primary">Translator</span>
                    </h1>
                </div>

                {/* Right Area (User / Login) */}
                <div className="flex items-center gap-3">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-black hidden sm:block">
                                {user.name}
                            </span>
                            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md border border-black">
                                {user.name[0]}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                                title="로그아웃"
                            >
                                <span className="material-symbols-outlined text-xl">logout</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLogin}
                            className="flex items-center justify-center rounded-lg h-9 px-4 bg-black text-white text-sm font-bold transition-all hover:bg-gray-800 active:scale-95"
                        >
                            로그인
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
