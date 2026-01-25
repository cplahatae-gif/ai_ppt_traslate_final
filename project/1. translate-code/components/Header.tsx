import React from 'react';
import { LogoIcon } from './icons';

export const Header: React.FC = () => {
  return (
    <header className="text-center">
      <div className="inline-flex items-center justify-center gap-3 bg-gray-800 px-6 py-3 rounded-full">
        <LogoIcon />
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          AI PPT 번역기
        </h1>
      </div>
      <p className="mt-4 text-md sm:text-lg text-gray-400 max-w-2xl mx-auto">
        PPTX 파일을 업로드하면 AI가 내용을 영어로 번역하여 새로운 파일로 만들어 드립니다.
      </p>
    </header>
  );
};
