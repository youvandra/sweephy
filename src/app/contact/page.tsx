"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0E1E1F] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navbar */}
      <Navbar variant="dark" />

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-6 2xl:px-24 py-12 2xl:py-24 flex flex-col lg:flex-row gap-12 lg:gap-24 items-start">
        
        {/* Left: Info */}
        <div className="flex-1 space-y-12">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl 2xl:text-8xl font-bold tracking-tight">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="text-xl 2xl:text-3xl text-gray-300 max-w-lg leading-relaxed">
              Have questions about your order, shipping, or setup? We&apos;re here to help.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-primary">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Email Us</h3>
                <p className="text-gray-400">support@sweephy.com</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-primary">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Call Us</h3>
                <p className="text-gray-400">+1 (555) 123-4567</p>
              </div>
            </div>

             <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-primary">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Visit Us</h3>
                <p className="text-gray-400">123 Crypto Valley, Suite 404<br/>Zug, Switzerland</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 2xl:p-16">
          <form className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-400">First Name</label>
                <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-primary focus:outline-none transition-colors" placeholder="John" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Last Name</label>
                <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-primary focus:outline-none transition-colors" placeholder="Doe" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Email</label>
              <input type="email" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:border-primary focus:outline-none transition-colors" placeholder="john@example.com" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Message</label>
              <textarea className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 h-32 focus:border-primary focus:outline-none transition-colors resize-none" placeholder="How can we help you?" />
            </div>

            <Button variant="primary" fullWidth>
              <Send className="w-4 h-4" />
              Send Message
            </Button>
          </form>
        </div>

      </main>

      <Footer />
    </div>
  );
}
