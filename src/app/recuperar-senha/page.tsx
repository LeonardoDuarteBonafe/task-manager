"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/http-client";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setFeedback("Se existir uma conta com esse e-mail, a instrucao de recuperacao foi preparada para envio.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel processar sua solicitacao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <Card className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recuperar senha</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Informe seu e-mail para testar o fluxo inicial de recuperacao.</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
              E-mail
            </label>
            <Input id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {feedback ? <p className="text-sm text-emerald-600">{feedback}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Enviando..." : "Enviar instrucoes"}
          </Button>
        </form>

        <Link className="block text-center text-sm text-slate-600 underline dark:text-slate-300" href="/login">
          Voltar para login
        </Link>
      </Card>
    </main>
  );
}
