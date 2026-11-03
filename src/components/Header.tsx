import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <img
            src="/assets/aistudio/image_32a8bc33.png"
            alt="Tech Labs"
            className="w-8 h-8 object-contain"
          />
          <span className="text-sm font-semibold text-slate-900 tracking-tight">
            Tech Labs
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-600">
            Assignment Submission
          </span>
        </div>
      </div>
    </header>
  );
};
