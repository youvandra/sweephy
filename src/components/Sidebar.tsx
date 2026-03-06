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

  const menuItems = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/buy", hasSub: true },
    { label: "Tokenomics", href: "/tokenomics" },
    { label: "Apps", href: "/dashboard", hasSub: true }, // Using dashboard as Apps/Setup
    { label: "Learn", href: "/about" },
    { label: "For Business", href: "#", hasSub: true },
    { label: "Reviews", href: "/buy#reviews" },
  ];

  const footerLinks = [
    { label: "About", href: "/about" },
    { label: "Community", href: "#" },
    { label: "Contact Us", href: "/contact" },
    { label: "FAQ", href: "/faq" },
    { label: "Support", href: "#" },
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

            {/* Divider */}
            <div className="my-8 border-t border-white/10" />

            {/* Footer Links */}
            <div className="space-y-4 text-right">
              {footerLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={onClose}
                  className="block text-lg text-gray-400 hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Social Icons */}
            <div className="mt-auto flex justify-end gap-6 pt-8">
              <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
                <Facebook className="w-6 h-6" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
                <Instagram className="w-6 h-6" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
                <Twitter className="w-6 h-6" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
                <Github className="w-6 h-6" />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
