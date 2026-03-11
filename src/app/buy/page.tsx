"use client";

import Image from "next/image";
import { Star, User, Quote, Hourglass } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";

export default function BuyPage() {
  const reviews = [
    {
      name: "Alex M.",
      role: "Crypto Trader",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
      text: "The best desk accessory I've bought this year. Being able to see HBAR prices at a glance without unlocking my phone has been a game changer for my focus.",
      rating: 5
    },
    {
      name: "Sarah K.",
      role: "DeFi Enthusiast",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
      text: "Setup was incredibly easy. It connects seamlessly to my wallet and the display is crisp and beautiful. Swapping tokens literally takes one tap.",
      rating: 5
    },
    {
      name: "David R.",
      role: "Software Engineer",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop",
      text: "Love the retro aesthetic! It fits perfectly with my workspace setup. The build quality feels premium and the software updates have been consistent.",
      rating: 4
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00332c] via-[#004d40] to-[#001a17] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navbar */}
      <Navbar variant="dark" />

      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-6 2xl:px-24 py-12 2xl:py-24 flex flex-col lg:flex-row gap-12 lg:gap-24 2xl:gap-40 items-center">
        {/* Left: Product Image */}
        <div className="flex-1 w-full relative aspect-square max-w-xl 2xl:max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-white/10">
           <Image 
            src="/landing/desk.png"
            alt="Sweephy Device" 
            fill
            className="object-cover"
          />
        </div>

        {/* Right: Product Details */}
        <div className="flex-1 space-y-8 2xl:space-y-12">
          <div>
            <h1 className="text-5xl md:text-7xl 2xl:text-9xl font-bold tracking-tight mb-4 2xl:mb-8">Sweephy <span className="text-primary">One</span></h1>
            <p className="text-xl 2xl:text-3xl text-gray-300 max-w-lg 2xl:max-w-2xl leading-relaxed">
              The dedicated crypto companion for your desk. Monitor prices, track portfolio, and swap instantly.
            </p>
          </div>

          <div className="space-y-4 2xl:space-y-6 border-t border-white/10 pt-8 2xl:pt-12">
            <div className="flex justify-between items-center text-2xl 2xl:text-4xl font-bold">
              <span>Price</span>
              <span>$199.00</span>
            </div>
            <p className="text-sm 2xl:text-xl text-gray-400">Includes device, USB-C cable, and lifetime updates.</p>
          </div>

          <div className="space-y-4 2xl:space-y-6 pt-4">
             <Button 
                variant="primary" 
                fullWidth 
                className="cursor-not-allowed"
              >
                <Hourglass className="w-4 h-4" />
                Coming Soon
              </Button>
              <p className="text-center text-xs 2xl:text-base text-gray-500 uppercase tracking-widest">Free Shipping Worldwide</p>
          </div>

          <div className="grid grid-cols-2 gap-4 2xl:gap-8 pt-8 2xl:pt-12">
            <div className="bg-white/5 p-4 2xl:p-8 rounded-xl border border-white/5">
              <h3 className="font-bold text-primary mb-1 2xl:text-2xl 2xl:mb-3">Real-time</h3>
              <p className="text-sm 2xl:text-lg text-gray-400">Live price updates via WiFi</p>
            </div>
             <div className="bg-white/5 p-4 2xl:p-8 rounded-xl border border-white/5">
              <h3 className="font-bold text-primary mb-1 2xl:text-2xl 2xl:mb-3">Secure</h3>
              <p className="text-sm 2xl:text-lg text-gray-400">Hardware-level security</p>
            </div>
          </div>
        </div>
      </main>

      {/* Reviews Section */}
      <section className="relative z-10 bg-white text-secondary-darker py-24 2xl:py-40 px-6 2xl:px-24">
        <div className="w-full max-w-[1920px] mx-auto">
          <div className="text-center mb-16 2xl:mb-24 space-y-4 2xl:space-y-6">
            <h2 className="text-4xl md:text-5xl 2xl:text-7xl font-bold tracking-tight">Loved by the Community</h2>
            <p className="text-lg 2xl:text-2xl text-gray-500 max-w-2xl 2xl:max-w-4xl mx-auto">
              Join hundreds of early adopters who have upgraded their trading setup with Sweephy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 2xl:gap-16">
            {reviews.map((review, i) => (
              <div key={i} className="bg-gray-50 rounded-3xl p-8 2xl:p-12 border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 group">
                <div className="flex items-center gap-4 2xl:gap-6 mb-6 2xl:mb-10">
                  <div className="relative w-12 h-12 2xl:w-16 2xl:h-16 rounded-full overflow-hidden border-2 border-white shadow-sm">
                     <Image 
                      src={review.avatar}
                      alt={review.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg 2xl:text-2xl leading-none">{review.name}</h4>
                    <p className="text-sm 2xl:text-lg text-gray-500 mt-1">{review.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5 text-yellow-400">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 2xl:w-6 2xl:h-6 fill-current" />
                    ))}
                  </div>
                </div>
                
                <div className="relative">
                  <Quote className="absolute -top-2 -left-2 2xl:-top-4 2xl:-left-4 w-8 h-8 2xl:w-12 2xl:h-12 text-primary/10 rotate-180" />
                  <p className="text-gray-600 2xl:text-xl leading-relaxed relative z-10 pl-2">
                    &quot;{review.text}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="mt-20 2xl:mt-32 pt-10 2xl:pt-16 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-8 2xl:gap-16 text-center">
             <div>
               <h4 className="text-3xl 2xl:text-5xl font-bold text-secondary-darker">500+</h4>
               <p className="text-sm 2xl:text-xl text-gray-500 uppercase tracking-wider mt-1">Units Shipped</p>
             </div>
             <div>
               <h4 className="text-3xl 2xl:text-5xl font-bold text-secondary-darker">4.9/5</h4>
               <p className="text-sm 2xl:text-xl text-gray-500 uppercase tracking-wider mt-1">Average Rating</p>
             </div>
             <div>
               <h4 className="text-3xl 2xl:text-5xl font-bold text-secondary-darker">24/7</h4>
               <p className="text-sm 2xl:text-xl text-gray-500 uppercase tracking-wider mt-1">Support</p>
             </div>
             <div>
               <h4 className="text-3xl 2xl:text-5xl font-bold text-secondary-darker">1 Year</h4>
               <p className="text-sm 2xl:text-xl text-gray-500 uppercase tracking-wider mt-1">Warranty</p>
             </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
