"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AuthStage } from "@/components/auth/auth-stage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/http-client";

export default function CadastroPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      setError("Use uma senha forte com pelo menos 8 caracteres, incluindo letra e numero.");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
        }),
      });

      setSuccess("Cadastro concluido. Agora voce ja pode entrar com seu e-mail e senha.");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStage
      description="Crie seu acesso para organizar tarefas recorrentes com notificacoes, favoritos e acompanhamento offline."
      eyebrow="Cadastro"
      title="Abra sua mesa de rotinas."
    >
      <Card className="space-y-6 p-6 md:p-7">
        <div className="space-y-2">
          <span className="inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
            Novo acesso
          </span>
          <h1 className="font-display text-4xl leading-none text-[var(--foreground)]">Criar conta</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">Cadastre seu acesso para organizar tarefas e recorrencias em uma experiencia mais consistente.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-strong)]" htmlFor="email">
              E-mail
            </label>
            <Input id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-strong)]" htmlFor="password">
              Senha
            </label>
            <Input id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-strong)]" htmlFor="confirmPassword">
              Confirmar senha
            </label>
            <Input
              id="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <Link className="block text-center text-sm text-[var(--muted)] underline decoration-[var(--muted-strong)] underline-offset-4" href="/login">
          Ja tenho uma conta
        </Link>
      </Card>
    </AuthStage>
  );
}
