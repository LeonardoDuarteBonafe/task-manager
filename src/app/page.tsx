import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthStage } from "@/components/auth/auth-stage";
import { LoginCard } from "@/components/auth/login-card";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <AuthStage
      description="Uma interface de rotina pensada para desktop e mobile, com prioridade visual para o que precisa de resposta agora."
      eyebrow="PWA pessoal"
      title="Rituais, alertas e tarefas em uma mesa de controle mais elegante."
    >
      <LoginCard googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} showBackLink />
    </AuthStage>
  );
}
