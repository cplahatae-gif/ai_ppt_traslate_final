import React, { useState, useCallback } from 'react';
import { UploadCloudIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  file: File | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, file }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`w-full p-8 border-2 border-dashed rounded-lg transition-colors duration-300 ${isDragging ? 'border-purple-500 bg-gray-800' : 'border-gray-600 bg-gray-800/50'}`}
    >
        <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={handleFileChange}
        />
        <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
            <UploadCloudIcon />
            <p className="mt-4 text-lg font-semibold text-gray-300">
                PPTX 파일을 여기에 드래그하거나 클릭하여 업로드하세요
            </p>
            <p className="mt-1 text-sm text-gray-500">
                (최대 파일 크기: 50MB)
            </p>
        </label>
        {file && (
            <div className="mt-6 text-center bg-gray-700 p-3 rounded-md">
                <p className="text-sm text-gray-300">선택된 파일: <span className="font-medium text-purple-400">{file.name}</span></p>
            </div>
        )}
    </div>
  );
};
