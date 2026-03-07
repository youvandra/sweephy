"use client";

import { X, ChevronRight, Facebook, Instagram, Twitter, Github } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  href: string;
  hasSub?: boolean;
}

const TikTok = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const menuItems: MenuItem[] = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/buy" },
    { label: "$SWEEP", href: "/$SWEEP" },
    { label: "Apps", href: "/dashboard" }, // Using dashboard as Apps/Setup
    { label: "About", href: "/about" },
  ];

  const footerLinks = [
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
    { label: "Return Policy", href: "/return-policy" },
    { label: "Terms of Service", href: "/terms" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Sidebar Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[300px] md:w-[400px] bg-[#081819] text-white z-50 flex flex-col p-8 shadow-2xl font-sans overflow-y-auto"
          >
            {/* Header: Logo & Close */}
            <div className="flex items-center justify-between mb-16 flex-row-reverse flex-shrink-0">
              <Image 
                src="/Logos/Logo_all-white.webp" 
                alt="Sweephy" 
                width={120} 
                height={32} 
                className="h-8 w-auto opacity-90"
              />
              <button 
                onClick={onClose}
                className="p-2 -ml-2 rounded-full transition-transform hover:rotate-90 duration-300 text-white/80 hover:text-white"
              >
                <X className="w-8 h-8 md:w-10 md:h-10" />
              </button>
            </div>

            {/* Main Menu */}
            <div className="space-y-6 text-right">
              {menuItems.map((item, index) => (
                <Link 
                  key={index} 
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-center justify-end gap-4 text-2xl md:text-3xl font-bold hover:text-primary transition-colors"
                >
                  {item.hasSub && (
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white/30 group-hover:text-primary transition-colors rotate-180" />
                  )}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Footer Links */}
            <div className="mt-auto pt-8 border-t border-white/10">
              <div className="flex flex-col gap-2 text-right">
                {footerLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    onClick={onClose}
                    className="text-sm text-gray-400 hover:text-white transition-colors font-medium tracking-wide"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Social Icons */}
              <div className="flex justify-end gap-6 pt-6">
                <Link href="#" className="text-gray-400 hover:text-primary transition-colors p-2 -mr-2">
                  <Facebook className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-primary transition-colors p-2">
                  <Instagram className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-primary transition-colors p-2">
                  <Twitter className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-primary transition-colors p-2">
                  <Github className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-primary transition-colors p-2">
                  <TikTok className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
