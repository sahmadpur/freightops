import { pgEnum } from "drizzle-orm/pg-core";

// Shared enums used by both auth and domain tables.
export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "client"]);
export const languageEnum = pgEnum("language", ["en", "ru", "az"]);
