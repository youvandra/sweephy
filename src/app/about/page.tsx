"use client";

import { useRef } from "react";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

const TEAM = [
  {
    name: "Youvandra Febrial",
    role: "Engineering Lead",
    image: "/landing/desk.png", // Using desk.png as placeholder for now
  },
  {
    name: "Fadjar Dwi.L",
    role: "Product Lead",
    image: "/landing/desk.png",
  },
  {
    name: "Fainel Filo",
    role: "Design Lead",
    image: "/landing/desk.png",
  },
];

export default function AboutPage() {
  // Scroll Animation for Marquee
  const marqueeRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: marqueeRef,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 30,
    damping: 30,
    restDelta: 0.001
  });

  // Marquee moves left as you scroll down
  const x = useTransform(smoothProgress, [0, 1], ["0%", "-25%"]);

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
              What&apos;s the price of HBAR? How is my portfolio doing? When is the next governance vote? 
              Having to reach for our phones over and over again to answer these questions was a pain.
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
      <section className="bg-[#FDFBF7] border-t border-secondary/10 overflow-hidden">
        {/* Marquee Divider */}
        <div className="py-6 md:py-8 border-b border-secondary/10 bg-white" ref={marqueeRef}>
          <motion.div style={{ x }} className="flex whitespace-nowrap w-max overflow-visible">
            {[...Array(8)].map((_, i) => (
              <span key={i} className="text-xl md:text-2xl font-bold text-secondary uppercase tracking-[0.2em] mx-8">
                About Us
              </span>
            ))}
          </motion.div>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-secondary/10 border-b border-secondary/10">
          {TEAM.map((member, index) => (
            <div key={index} className="flex flex-col items-center text-center p-8 md:p-12 2xl:p-16 bg-[#FDFBF7] hover:bg-white transition-colors duration-300">
              {/* Image Container */}
              <div className="relative w-full aspect-[4/5] mb-8 overflow-hidden bg-gray-100">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>
              
              {/* Name */}
              <h3 className="text-3xl md:text-4xl font-bold text-secondary mb-4 leading-none">
                {member.name.split(" ").map((n, i) => (
                  <span key={i} className="block">{n}</span>
                ))}
              </h3>

              {/* Role Pill */}
              <span className="inline-block bg-primary text-secondary text-xs md:text-sm font-bold px-6 py-2 rounded-full uppercase tracking-wider mt-auto">
                {member.role}
              </span>
            </div>
          ))}
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
