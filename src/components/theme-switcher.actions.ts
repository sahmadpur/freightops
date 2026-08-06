"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

export async function setTheme(theme: string) {
  if (!isTheme(theme)) return;
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "strict",
  });
}
