import { z } from "zod";
import { auth } from "@/lib/auth";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  role: z.enum(["admin", "operator", "client"]),
  accountId: z.string().nullish(),
  language: z.enum(["en", "ru", "az"]).default("en"),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

/** Server-only: creates a credential user with an explicit role. Public sign-up is disabled. */
export async function createUserWithPassword(input: CreateUserInput) {
  const data = createUserSchema.parse(input);
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(data.password);
  const user = await ctx.internalAdapter.createUser({
    email: data.email,
    name: data.name,
    emailVerified: false,
    role: data.role,
    accountId: data.accountId ?? null,
    language: data.language,
    active: true,
  });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashed,
  });
  return user;
}
