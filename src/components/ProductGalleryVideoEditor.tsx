import React, { useState } from 'react';
import {
  MAX_PRODUCT_VIDEOS,
  isValidProductVideoUrl,
  normalizeProductVideoUrls,
  videoHostLabel,
} from '../utils/productGallery';

type Props = {
  videoUrls: string[];
  onChange: (urls: string[]) => void;
  className?: string;
};

export default function ProductGalleryVideoEditor({ videoUrls, onChange, className = '' }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addVideo = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter a video URL.');
      return;
    }
    if (!isValidProductVideoUrl(trimmed)) {
      setError('Use a YouTube, Vimeo, or direct video link (https).');
      return;
    }
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    if (videoUrls.includes(normalized)) {
      setError('This video is already in the gallery.');
      return;
    }
    if (videoUrls.length >= MAX_PRODUCT_VIDEOS) {
      setError(`Maximum ${MAX_PRODUCT_VIDEOS} videos.`);
      return;
    }
    onChange(normalizeProductVideoUrls([...videoUrls, normalized]));
    setInput('');
    setError('');
  };

  const removeAt = (index: number) => {
    onChange(videoUrls.filter((_, i) => i !== index));
    setError('');
  };

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
        Videos (max {MAX_PRODUCT_VIDEOS})
      </label>
      <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
        YouTube, Vimeo, or direct video links appear in the store gallery with your images.
      </p>

      {videoUrls.length > 0 && (
        <ul className="mt-2 space-y-2">
          {videoUrls.map((url, idx) => (
            <li
              key={`${url}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/80"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900 text-white dark:bg-gray-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-gray-800 dark:text-gray-200">
                  {videoHostLabel(url)}
                </div>
                <div className="truncate text-[10px] text-gray-500 dark:text-gray-400">{url}</div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {videoUrls.length < MAX_PRODUCT_VIDEOS && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="url"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addVideo();
              }
            }}
            placeholder="https://youtube.com/watch?v=..."
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={addVideo}
            className="shrink-0 rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Add video
          </button>
        </div>
      )}

      {error ? <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
