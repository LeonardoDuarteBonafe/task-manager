"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <Card className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Criar conta</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Cadastre seu acesso para organizar tarefas e recorrencias.</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
              E-mail
            </label>
            <Input id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
              Senha
            </label>
            <Input id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">
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

        <Link className="block text-center text-sm text-slate-600 underline dark:text-slate-300" href="/login">
          Ja tenho uma conta
        </Link>
      </Card>
    </main>
  );
}
