import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-[#081819] text-white py-16 px-6 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-24">
          {/* Logo Section */}
          <div className="flex-shrink-0">
            <Link href="/" className="block">
              <Image 
                src="/Logos/Logo_mark-green_text-white.png" 
                alt="Sweephy" 
                width={200} 
                height={56} 
                className="h-12 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 flex-grow justify-end">
            {/* SHOP */}
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-gray-400">Shop</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/buy" className="text-sm hover:text-primary transition-colors">
                    Sweephy One
                  </Link>
                </li>
              </ul>
            </div>

            {/* DEVICES */}
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-gray-400">Devices</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/dashboard" className="text-sm hover:text-primary transition-colors">
                    Setup Device
                  </Link>
                </li>
              </ul>
            </div>

            {/* ABOUT */}
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-gray-400">About</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-sm hover:text-primary transition-colors">
                    About Sweephy
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-sm hover:text-primary transition-colors">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm hover:text-primary transition-colors">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* TERMS */}
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-gray-400">Terms</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/return-policy" className="text-sm hover:text-primary transition-colors">
                    Return Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-24 pt-8 flex flex-col md:flex-row gap-8 items-start md:items-center text-[10px] font-mono uppercase tracking-widest text-gray-500">
          <Link href="#" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <span>
            © {new Date().getFullYear()} Sweephy
          </span>
        </div>
      </div>
    </footer>
  );
}