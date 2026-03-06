"use client";

import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-secondary-darker overflow-hidden relative">
      {/* Navbar */}
      <Navbar variant="light" />

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 2xl:px-24 py-12 2xl:py-24 space-y-12">
        
        {/* Header */}
        <section className="space-y-6 text-center">
          <h1 className="text-4xl md:text-5xl 2xl:text-6xl font-bold tracking-tight">
            Return Policy
          </h1>
          <p className="text-lg text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
        </section>

        {/* Policy Content */}
        <div className="prose prose-lg max-w-none text-gray-600 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">30-Day Money-Back Guarantee</h2>
            <p>
              We want you to be completely satisfied with your Sweephy device. If for any reason you are not happy with your purchase, 
              you may return it within 30 days of delivery for a full refund, minus return shipping costs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Condition of Returns</h2>
            <p>
              To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, 
              with tags, and in its original packaging. You’ll also need the receipt or proof of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Damages and Issues</h2>
            <p>
              Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you 
              receive the wrong item, so that we can evaluate the issue and make it right.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Exchanges</h2>
            <p>
              The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, 
              make a separate purchase for the new item.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-secondary-darker mb-4">Refunds</h2>
            <p>
              We will notify you once we’ve received and inspected your return, and let you know if the refund was approved or not. 
              If approved, you’ll be automatically refunded on your original payment method within 10 business days. 
              Please remember it can take some time for your bank or credit card company to process and post the refund too.
            </p>
          </section>
        </div>

      </main>

      <Footer />
    </div>
  );
}
