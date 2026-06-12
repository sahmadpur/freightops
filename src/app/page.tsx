import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeFor, type Role } from "@/lib/roles";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  redirect(homeFor(session.user.role as Role));
}
