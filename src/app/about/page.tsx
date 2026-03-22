"use client";

import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const TEAM = [
  {
    name: "Youvandra Febrial",
    tag: "Founder",
    subtitle: "Lead Architect and Developer",
    image: "/team/youvan.png",
  },
  {
    name: "Fadjar Dwi Laksono",
    tag: "Co-founder",
    subtitle: "Lead Product",
    image: "/team/fadjar.png",
  },
  {
    name: "Mochamad Fainel Filosof",
    tag: "Co-founder",
    subtitle: "Lead Designer",
    image: "/team/filo.png",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-secondary-light font-sans text-secondary">
      
      {/* 1. Hero Section (Black) */}
      <section className="bg-secondary-darkest text-white relative">
        <Navbar variant="transparent" />
        
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 2xl:px-24 pt-32 md:pt-40 pb-20 2xl:pb-32">
          <h1 className="text-4xl md:text-6xl 2xl:text-7xl font-bold tracking-tight max-w-4xl leading-tight mb-16 md:mb-24">
            We&apos;ve built a new way to keep up with the things you care about.
          </h1>

          {/* Video Placeholder */}
          <div className="w-full aspect-video bg-white/10 rounded-none relative overflow-hidden">
             {/* Use existing landing video or placeholder */}
             <video 
              autoPlay
              loop
              muted
              playsInline
              className="object-cover w-full h-full opacity-80"
            >
              <source src="/landing/lp.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 flex items-center justify-center">
                {/* Optional Play Icon or Overlay */}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Story Section (Light/Cream equivalent) */}
      <section className="bg-[#FDFBF7] text-secondary py-20 md:py-32 px-6 md:px-12 2xl:px-24">
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-5xl font-bold leading-tight">
            Hey, we&apos;re the creators of Sweephy.
          </h2>
          
          <div className="space-y-8 text-lg md:text-xl leading-relaxed font-medium text-secondary/90">
            <p>
              The original idea for Sweephy was to make a device that simplified our daily crypto routines. 
            </p>
            <p>
              Our solution? A simple, dedicated display device that cycles through our most important 
              assets and metrics, so we could spend less time looking at our phones and more time doing... anything else.
            </p>
            <p>
              Born from the frustration of constant tab-switching, Sweephy combines retro aesthetics 
              with modern Hedera technology to build a device that looks as good as it performs.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Team Section */}
      <section className="bg-secondary-darkest text-white py-20 md:py-28 px-6 md:px-12 2xl:px-24">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-12 md:mb-16">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight">
              Our <span className="text-primary">Team</span>
            </h2>
            <p className="text-white/70 max-w-xl text-base md:text-lg leading-relaxed">
              We build hardware and software that makes swaps feel effortless, from your desk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {TEAM.map((member) => (
              <div key={member.name} className="relative rounded-[28px] overflow-hidden">
                <div className="relative aspect-[4/5] w-full">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/55 border border-white/15 backdrop-blur-md px-4 py-3">
                  <div className="text-sm font-bold text-white">
                    {member.name} <span className="text-primary">/ {member.tag}</span>
                  </div>
                  <div className="text-sm italic text-white/80">{member.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Location / Hardware Section */}
      <section className="flex flex-col lg:flex-row min-h-[600px]">
        {/* Left: Dark Text Area */}
        <div className="flex-1 bg-black text-white flex items-center justify-center p-12 md:p-24 lg:p-32">
          <h2 className="text-4xl md:text-6xl font-bold leading-tight text-center lg:text-left">
            We design and build hardware in <br className="hidden lg:block" />
            <span className="text-gray-400">Malang, ID.</span>
          </h2>
        </div>

        {/* Right: Map Placeholder */}
        <div className="flex-1 relative bg-gray-200 min-h-[400px] lg:min-h-auto">
          <iframe 
            src="https://maps.google.com/maps?q=-7.945390,112.608260&z=15&output=embed"
            width="100%" 
            height="100%" 
            style={{ border: 0, filter: "grayscale(100%)" }} 
            allowFullScreen 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}
