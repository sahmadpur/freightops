import { cookies } from "next/headers";
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "./theme";

/**
 * The visitor's theme preference from the `theme` cookie. Server-only — kept
 * out of theme.ts because that module is imported by the client switcher.
 */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
