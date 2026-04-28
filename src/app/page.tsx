import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const role = await getSession();
  if (role) redirect("/dashboard");
  redirect("/login");
}
