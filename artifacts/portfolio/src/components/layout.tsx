import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 mix-blend-difference">
        <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center text-sm tracking-widest uppercase">
          <Link href="/" className="hover:opacity-70 transition-opacity">
            Shaikh Sohaib Ahmed
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/" className={`${location === "/" ? "opacity-100" : "opacity-50"} hover:opacity-100 transition-opacity`}>
              Work
            </Link>
            <Link href="/about" className={`${location === "/about" ? "opacity-100" : "opacity-50"} hover:opacity-100 transition-opacity`}>
              About
            </Link>
            <Link href="/contact" className={`${location === "/contact" ? "opacity-100" : "opacity-50"} hover:opacity-100 transition-opacity`}>
              Contact
            </Link>
            <Link
              href="/admin"
              data-testid="link-admin"
              className={`${location === "/admin" ? "opacity-100" : "opacity-30"} hover:opacity-80 transition-opacity`}
              title="Admin"
            >
              <Lock size={13} strokeWidth={1.5} />
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center text-xs text-muted-foreground tracking-widest uppercase">
        <p>&copy; {new Date().getFullYear()} Shaikh Sohaib Ahmed. All rights reserved.</p>
      </footer>
    </div>
  );
}
