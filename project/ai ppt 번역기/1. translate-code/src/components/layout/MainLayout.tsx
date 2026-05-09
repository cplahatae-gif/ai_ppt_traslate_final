import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface MainLayoutProps {
    children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="bg-white text-black font-display min-h-screen relative flex flex-col">
            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />

                <main className="flex-1 flex flex-col w-full max-w-[1100px] mx-auto px-4 py-4">
                    <div className="flex-1 border-2 border-border-strong rounded-xl p-5 shadow-card bg-white">
                        {children}
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
};
