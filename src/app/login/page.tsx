import { AuthStage } from "@/components/auth/auth-stage";
import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <AuthStage
      description="Entre para abrir seu painel recorrente com um visual mais editorial e foco no que esta pendente."
      eyebrow="Acesso"
      title="Seu painel de rotina começa aqui."
    >
      <LoginCard googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
    </AuthStage>
  );
}
