 "use client";
 
 import { Footer } from "@/components/Footer";
 import { Navbar } from "@/components/Navbar";
 import { DeviceSimulator } from "@/components/sim/DeviceSimulator";
 
 export default function SimulatePage() {
   return (
     <div className="min-h-[100svh] bg-secondary-light font-sans text-secondary overflow-x-hidden">
       <Navbar variant="light" />
       <main className="w-full max-w-[1920px] mx-auto px-6 md:px-12 2xl:px-24 py-12 2xl:py-20">
         <div className="max-w-5xl">
           <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-secondary-darker">Simulation</h1>
           <p className="mt-4 text-lg md:text-xl text-secondary/70 leading-relaxed max-w-2xl">
             Try Sweephy in your browser. This sim mirrors the device screens and interactions.
           </p>
         </div>
 
         <div className="mt-10">
           <DeviceSimulator />
         </div>
       </main>
       <Footer />
     </div>
   );
 }
