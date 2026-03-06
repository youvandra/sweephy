"use client";

import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#081819] text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm font-medium text-gray-400 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
