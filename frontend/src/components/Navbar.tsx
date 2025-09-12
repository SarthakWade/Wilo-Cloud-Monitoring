"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // On mount, sync from localStorage or system
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as
      | "light"
      | "dark"
      | null;
    let initial: "light" | "dark" = "light";
    if (stored) {
      initial = stored;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initial = "dark";
    }
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", next);
    }
    document.documentElement.dataset.theme = next;
  };

  return { theme, toggle } as const;
}

export default function Navbar() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-50 w-full shadow-sm">
      <div className="w-full bg-brand text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Logos */}
          <div className="flex items-center gap-3">
            <Image src="/vu.png" width={28} height={28} alt="VU logo" className="rounded" />
            <Image src="/wilo.png" width={48} height={18} alt="Wilo logo" />
          </div>

          {/* Center: Title */}
          <div className="hidden md:block text-sm font-semibold tracking-wide">DASHBOARD</div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle dark mode"
              onClick={toggle}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 transition"
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            >
              {theme === "dark" ? (
                <FiSun className="w-5 h-5" />
              ) : (
                <FiMoon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
