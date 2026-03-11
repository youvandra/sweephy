"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary-light p-4 text-center">
      <div className="space-y-6 max-w-md w-full">
        {/* 404 Visual */}
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <h1 className="relative text-8xl font-bold text-primary font-mono tracking-tighter">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-secondary">Page Not Found</h2>
          <p className="text-gray-500">
            Oops! The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 transition-all font-medium group"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-secondary border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-center opacity-50">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">
          Sweephy
        </p>
      </div>
    </div>
  );
}
