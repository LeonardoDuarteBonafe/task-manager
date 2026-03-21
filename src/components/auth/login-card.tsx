"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FORCE_LOGIN_EMAIL, FORCE_LOGIN_PASSWORD } from "@/lib/mock-mode";

export function LoginCard({
  showBackLink = false,
  googleEnabled = false,
}: {
  showBackLink?: boolean;
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceLoading, setForceLoading] = useState(false);

  async function handleSignIn(nextEmail: string, nextPassword: string) {
    const result = await signIn("credentials", {
      redirect: false,
      email: nextEmail,
      password: nextPassword,
      callbackUrl: "/dashboard",
    });

    if (!result || result.error) {
      throw new Error("Nao foi possivel entrar. Revise o e-mail e a senha.");
    }

    router.push("/dashboard");
  }

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await handleSignIn(email, password);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function submitForceAccess() {
    setError(null);
    setForceLoading(true);

    try {
      await handleSignIn(FORCE_LOGIN_EMAIL, FORCE_LOGIN_PASSWORD);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel ativar o acesso forcado.");
    } finally {
      setForceLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <Card className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">TaskManager</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Entre para acessar seu painel de tarefas recorrentes.</p>
      </div>

      <form className="space-y-3" onSubmit={submitCredentials}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
            E-mail
          </label>
          <Input
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            required
            type="email"
            value={email}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
            Senha
          </label>
          <Input
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button className="w-full" disabled={loading || forceLoading} type="submit">
          {loading ? "Entrando..." : "Entrar com e-mail"}
        </Button>
      </form>

      {googleEnabled ? (
        <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} type="button" variant="secondary">
          Entrar com Google
        </Button>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Acesso forcado pelo front</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Esse acesso nao depende de usuário salvo no banco. Ele serve para navegar e validar a interface, com limitacoes nos dados exibidos.
          </p>
          <Button className="w-full" disabled={loading || forceLoading} onClick={submitForceAccess} type="button" variant="ghost">
            {forceLoading ? "Entrando..." : "Entrar em modo forcado"}
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-center text-sm">
        <Link className="block text-slate-600 underline dark:text-slate-300" href="/cadastro">
          Criar conta
        </Link>
        <Link className="block text-slate-600 underline dark:text-slate-300" href="/recuperar-senha">
          Esqueci minha senha
        </Link>
        {showBackLink ? (
          <Link className="block text-slate-600 underline dark:text-slate-300" href="/login">
            Ir para a rota de login
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
