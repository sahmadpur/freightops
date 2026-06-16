"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the viewport is below `breakpoint` (px), via matchMedia.
 * Starts `false` so the server render and first client render agree (no
 * hydration mismatch); the real value is read in an effect after mount.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}
