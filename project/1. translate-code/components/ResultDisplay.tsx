
import React, { useState, useEffect } from 'react';
import { ClipboardIcon, CheckIcon } from './icons';

interface ResultDisplayProps {
  text: string;
  isLoading: boolean;
  error: string | null;
  label: string;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ text, isLoading, error, label }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
    });
  };
  
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-gray-400">AI가 번역을 생성하고 있습니다...</div>;
    }
    if (error) {
      return <div className="text-red-400">{error}</div>;
    }
    if (text) {
      return <div className="text-gray-200 whitespace-pre-wrap">{text}</div>;
    }
    return <div className="text-gray-500">번역 결과가 여기에 표시됩니다.</div>;
  };

  return (
    <div className="w-full h-full flex flex-col relative">
       <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-gray-400">{label}</label>
        {text && !isLoading && !error && (
          <button 
            onClick={handleCopy} 
            className="flex items-center gap-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
          >
            {isCopied ? <CheckIcon /> : <ClipboardIcon />}
            {isCopied ? '복사됨!' : '복사'}
          </button>
        )}
      </div>
      <div className="flex-grow w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-lg overflow-y-auto min-h-[300px] lg:min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  );
};
