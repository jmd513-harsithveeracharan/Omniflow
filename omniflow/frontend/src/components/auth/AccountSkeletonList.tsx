import React from 'react';

export const AccountSkeletonList: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2].map((idx) => (
        <div
          key={idx}
          className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex-shrink-0" />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-32 bg-white/[0.08] rounded" />
                <div className="h-3 w-16 bg-white/[0.05] rounded-full" />
              </div>
              <div className="h-2.5 w-48 bg-white/[0.04] rounded" />
              <div className="h-2 w-28 bg-white/[0.03] rounded" />
            </div>
          </div>
          <div className="h-7 w-16 bg-white/[0.06] rounded-lg flex-shrink-0 ml-3" />
        </div>
      ))}
    </div>
  );
};

