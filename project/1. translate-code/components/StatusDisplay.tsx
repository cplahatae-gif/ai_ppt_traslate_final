import React from 'react';
import { LoadingSpinnerIcon } from './icons';

interface StatusDisplayProps {
  message: string;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg">
      <LoadingSpinnerIcon />
      <p className="mt-6 text-xl font-semibold text-gray-300 animate-pulse">
        {message}
      </p>
      <p className="mt-2 text-sm text-gray-500">
        파일 크기에 따라 시간이 걸릴 수 있습니다. 페이지를 닫지 마세요.
      </p>
    </div>
  );
};
