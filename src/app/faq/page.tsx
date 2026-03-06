"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";

const faqs = [
  {
    question: "How does Sweephy connect to my data?",
    answer: "Sweephy connects securely via WiFi to fetch real-time data from trusted APIs. You can configure your preferences through our simple setup process."
  },
  {
    question: "Do I need a computer to use it?",
    answer: "You only need a computer or smartphone for the initial setup. Once connected to WiFi, Sweephy operates independently."
  },
  {
    question: "Is my wallet secure?",
    answer: "Absolutely. Sweephy is a read-only device for monitoring. Any transaction signing (like swaps) requires confirmation through your secure wallet app on your phone."
  },
  {
    question: "What currencies are supported?",
    answer: "We support major cryptocurrencies including HBAR, BTC, ETH, and SOL. More tokens are added regularly based on community feedback."
  },
  {
    question: "Can I customize the display?",
    answer: "Yes! You can choose from various watch faces, data layouts, and color themes to match your setup."
  }
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00332c] via-[#004d40] to-[#001a17] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navbar */}
      <Navbar variant="dark" />

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-6 2xl:px-24 py-12 2xl:py-24 space-y-12">
        
        {/* Header */}
        <section className="text-center space-y-6">
          <h1 className="text-5xl md:text-7xl 2xl:text-8xl font-bold tracking-tight">
            FAQ
          </h1>
          <p className="text-xl 2xl:text-3xl text-gray-300 max-w-xl mx-auto leading-relaxed">
            Common questions about setting up and using your Sweephy device.
          </p>
        </section>

        {/* FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm transition-all duration-300">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex justify-between items-center p-6 md:p-8 text-left focus:outline-none hover:bg-white/5 transition-colors"
              >
                <span className="text-lg md:text-xl font-bold text-white pr-8">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-6 h-6 text-primary flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-400 flex-shrink-0" />
                )}
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="p-6 md:p-8 pt-0 text-gray-300 text-lg leading-relaxed border-t border-white/5">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center pt-12 space-y-6">
          <p className="text-xl text-gray-300">Still have questions?</p>
          <Link href="/contact">
            <Button variant="outline-dark" className="border-white text-white hover:bg-white hover:text-secondary-darker!">
              <MessageSquare className="w-4 h-4" />
              Contact Support
            </Button>
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
