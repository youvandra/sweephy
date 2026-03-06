"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavbarProps {
  variant?: 'transparent' | 'dark' | 'light'; // 'light' for white background pages
}

export function Navbar({ variant = 'dark' }: NavbarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Determine styles based on variant and scroll state
  const isLightMode = variant === 'light' && !isScrolled;
  const isTransparent = variant === 'transparent';

  return (
    <>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Spacer for non-transparent variants to prevent content overlap */}
      {!isTransparent && (
        <div className="w-full h-32 md:h-40 2xl:h-56" aria-hidden="true" />
      )}

      <nav 
        className={cn(
          "fixed top-0 left-0 w-full z-40 transition-all duration-300",
          isScrolled ? "bg-[#081819]/90 backdrop-blur-md py-4 shadow-lg" : "bg-transparent py-8"
        )}
      >
        <div className="relative w-full max-w-[1920px] mx-auto px-6 md:px-12 2xl:px-24 flex items-center justify-center">
          
          {/* Hamburger Menu - Always visible, fixed position relative to container */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-6 md:right-12 2xl:right-24 top-1/2 -translate-y-1/2 p-2 rounded-full transition-transform hover:scale-110 active:scale-95 duration-200"
          >
            <Menu className={cn(
              "w-8 h-8 md:w-10 md:h-10 transition-colors duration-300",
              isLightMode ? "text-[#081819]" : "text-white"
            )} />
          </button>

          {/* Logo - Centered */}
          <Link href="/">
            <Image 
              src={isLightMode ? "/Logos/Logo_mark-green_text-black.webp" : "/Logos/Logo_all-white.webp"}
              alt="Sweephy" 
              width={300} 
              height={80} 
              className={cn(
                "w-auto transition-all duration-300",
                isScrolled ? "h-6 md:h-8 2xl:h-12" : "h-10 md:h-12 2xl:h-20"
              )}
              priority
            />
          </Link>
        </div>
      </nav>
    </>
  );
}
