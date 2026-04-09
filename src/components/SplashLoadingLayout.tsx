import React from 'react';

/** Same visual as auth loading / native splash (logo, tagline, dots). */
export const SplashLoadingLayout: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`min-h-screen flex flex-col items-center justify-center bg-white ${className}`.trim()}
  >
    <img
      src="/CatShare_logo.png"
      alt="CatShare"
      className="w-28 h-28 mb-6 animate-[fadeInScale_0.5s_ease-out_both]"
    />
    <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">CatShare</h1>
    <p className="text-sm text-gray-400 mb-8">Share Faster, Sell Quicker</p>
    <div className="flex gap-1.5">
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_infinite]" />
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
    </div>
  </div>
);
