export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "system";
export const THEME_COOKIE = "theme";

export function isTheme(value: string | undefined): value is Theme {
  return THEMES.includes(value as Theme);
}

/**
 * Resolves `data-theme="system"` to a concrete value before first paint, and
 * keeps following the OS afterwards. Inlined in the root layout so the dark
 * tokens are in effect on the very first frame — no light flash on reload.
 * Kept in one string (rather than a component) because it must run as a
 * blocking classic script, not React.
 */
export const THEME_SCRIPT = `(function(){try{var r=document.documentElement,q=matchMedia('(prefers-color-scheme: dark)');function a(){if(r.dataset.themePref==='system')r.dataset.theme=q.matches?'dark':'light'}a();q.addEventListener('change',a)}catch(e){}})()`;
