"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00332c] via-[#004d40] to-[#001a17] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center py-8 px-6 w-full max-w-[1920px] mx-auto 2xl:px-24">
        <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5 2xl:w-6 2xl:h-6" />
          <span className="2xl:text-lg">Back</span>
        </Link>
        <Image 
          src="/Logos/Logo_all-white.webp" 
          alt="Sweephy" 
          width={150} 
          height={42} 
          className="h-8 2xl:h-12 w-auto"
          priority
        />
        <div className="w-20" />
      </nav>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 2xl:px-24 py-12 2xl:py-24 space-y-16">
        
        {/* Header */}
        <section className="text-center space-y-6">
          <h1 className="text-5xl md:text-7xl 2xl:text-8xl font-bold tracking-tight">
            About <span className="text-primary">Sweephy</span>
          </h1>
          <p className="text-xl 2xl:text-3xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Redefining how you interact with your digital assets.
          </p>
        </section>

        {/* Mission */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 2xl:p-16 space-y-6">
          <h2 className="text-3xl 2xl:text-5xl font-bold">Our Mission</h2>
          <p className="text-lg 2xl:text-2xl text-gray-300 leading-relaxed">
            At Sweephy, we believe that staying connected to the crypto world shouldn't mean being glued to a screen. 
            Our mission is to create beautiful, dedicated hardware that integrates seamlessly into your workspace, 
            providing you with the information you need at a glance, without the distraction.
          </p>
        </section>

        {/* Story */}
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10">
             <Image 
              src="/landing/desk.png"
              alt="Sweephy Workspace" 
              fill
              className="object-cover"
            />
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl 2xl:text-5xl font-bold">The Story</h2>
            <p className="text-lg 2xl:text-2xl text-gray-300 leading-relaxed">
              Born from the frustration of constant tab-switching and phone-checking, Sweephy was designed by traders and engineers 
              who wanted a better way to track the market. We combined retro aesthetics with modern technology to build a device 
              that looks as good as it performs.
            </p>
            <Link href="/buy">
              <Button variant="primary" className="mt-4">
                Get Yours
              </Button>
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
