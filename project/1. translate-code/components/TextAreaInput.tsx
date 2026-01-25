
import React from 'react';

interface TextAreaInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  label: string;
  isDisabled: boolean;
}

export const TextAreaInput: React.FC<TextAreaInputProps> = ({ value, onChange, placeholder, label, isDisabled }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <label className="text-sm font-semibold text-gray-400 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={isDisabled}
        className="flex-grow w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 text-gray-200 disabled:opacity-50 min-h-[300px] lg:min-h-[500px]"
      />
    </div>
  );
};
