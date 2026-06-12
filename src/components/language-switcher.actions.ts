"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locale";
import { getSession } from "@/lib/session";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  const session = await getSession();
  if (session) {
    await db.update(user).set({ language: locale }).where(eq(user.id, session.user.id));
  }
}
