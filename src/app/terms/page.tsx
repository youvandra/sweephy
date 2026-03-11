"use client";

import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-secondary-darker overflow-hidden relative">
      {/* Navbar */}
      <Navbar variant="light" />

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 2xl:px-24 py-12 2xl:py-24 space-y-12">
        
        {/* Header */}
        <section className="space-y-6 text-center">
          <h1 className="text-4xl md:text-5xl 2xl:text-6xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-lg text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
        </section>

        {/* Policy Content */}
        <div className="prose prose-lg max-w-none text-gray-600 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Agreement to Terms</h2>
            <p>
              By accessing or using our website and services, you agree to be bound by these Terms of Service. 
              If you do not agree to all the terms and conditions, then you may not access the website or use any services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on Sweephy&apos;s 
              website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Disclaimer</h2>
            <p>
              The materials on Sweephy&apos;s website are provided on an &apos;as is&apos; basis. Sweephy makes no warranties, expressed or implied, 
              and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions 
              of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Limitations</h2>
            <p>
              In no event shall Sweephy or its suppliers be liable for any damages (including, without limitation, damages for loss 
              of data or profit, or due to business interruption) arising out of the use or inability to use the materials on 
              Sweephy&apos;s website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of Switzerland and you irrevocably 
              submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>
        </div>

      </main>

      <Footer />
    </div>
  );
}
