import React from 'react';
import { UploadCloud } from 'lucide-react';

interface ContextUploadTabProps {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  onProcessFile: (file: File) => void;
}

export const ContextUploadTab: React.FC<ContextUploadTabProps> = ({
  isDragging,
  setIsDragging,
  onProcessFile,
}) => {
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onProcessFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onProcessFile(file);
    }
  };

  return (
    <div className="py-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all group ${
          isDragging
            ? 'border-emerald-500 bg-emerald-500/[0.07]'
            : 'border-white/10 hover:border-emerald-500/40 bg-[#141418] hover:bg-[#18181e]'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all mb-4 shadow-inner">
          <UploadCloud size={26} />
        </div>
        <span className="text-[14px] font-semibold text-zinc-200 group-hover:text-white transition-colors">
          Choose a file to upload or drag & drop
        </span>
        <span className="text-[12px] text-zinc-400 mt-1.5 text-center max-w-md leading-relaxed">
          Attach intake specs, DDL schemas, Great Expectations suites, or architectural documentation
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {['.JSON', '.SQL', '.MD', '.TXT', '.PDF'].map((ext) => (
            <span
              key={ext}
              className="text-[10.5px] font-mono px-2.5 py-1 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.08]"
            >
              {ext}
            </span>
          ))}
        </div>
        <input
          type="file"
          accept=".json,.sql,.md,.txt,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </label>
    </div>
  );
};
