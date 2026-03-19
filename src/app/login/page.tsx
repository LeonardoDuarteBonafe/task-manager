"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/dashboard",
    });
    setLoading(false);

    if (!result || result.error) {
      setError("Falha no login com e-mail e senha.");
      return;
    }

    router.push("/dashboard");
  };

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <Card className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">TaskManager</h1>
          <p className="text-sm text-slate-600">Entre para acessar seu dashboard de tarefas recorrentes.</p>
        </div>

        <form className="space-y-3" onSubmit={submitCredentials}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
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
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
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
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Entrando..." : "Entrar com e-mail"}
          </Button>
        </form>

        <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} type="button" variant="secondary">
          Entrar com Google
        </Button>

        <p className="text-center text-sm text-slate-500">
          Ainda não tem acesso? Configure usuário no banco e depois faça login.
        </p>
        <Link className="block text-center text-sm text-slate-600 underline" href="/">
          Voltar para a página inicial
        </Link>
      </Card>
    </main>
  );
}
