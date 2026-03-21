import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "@/components/auth/login-card";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <LoginCard
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        showBackLink
      />
    </main>
  );
}
