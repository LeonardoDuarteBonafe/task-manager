"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { isForcedUser } from "@/lib/mock-mode";

const FORCED_PROFILE_NAME_KEY = "taskmanager-forced-profile-name";

type ProfileDto = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
};

export default function MeuPerfilPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const userId = session?.user?.id;
  const isMockMode = isForcedUser(session?.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const fallbackName = useMemo(() => session?.user?.name?.trim() || "Usuario", [session?.user?.name]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      if (isMockMode) {
        const forcedName = typeof window !== "undefined" ? window.localStorage.getItem(FORCED_PROFILE_NAME_KEY) : null;
        setName(forcedName || fallbackName);
        setEmail(session?.user?.email || "force@taskmanager.local");
        return;
      }

      const profile = await apiRequest<ProfileDto>(`/api/profile?userId=${encodeURIComponent(userId)}`);
      setName(profile.name || "");
      setEmail(profile.email || session?.user?.email || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  }, [fallbackName, isMockMode, session?.user?.email, userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated") {
      void loadProfile();
    }
  }, [loadProfile, router, status]);

  async function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Informe um nome para salvar.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      if (isMockMode) {
        window.localStorage.setItem(FORCED_PROFILE_NAME_KEY, trimmedName);
        await update({ name: trimmedName });
        setFeedback("Nome atualizado no modo forcado.");
        return;
      }

      await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ userId, name: trimmedName }),
      });
      await update({ name: trimmedName });
      setFeedback("Alteracoes salvas com sucesso.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Meu Perfil">
        <PageState description="Verificando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Gerencie suas informacoes basicas de acesso." title="Meu Perfil">
      {loading ? <PageState description="Carregando dados do usuario..." title="Carregando" /> : null}

      {!loading ? (
        <Card className="flex min-h-[420px] flex-col gap-6 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dados do usuario</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Voce pode editar apenas o nome nesta etapa. O e-mail permanece somente leitura.</p>
          </div>

          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="profile-name">
                Nome
              </label>
              <Input id="profile-name" onChange={(event) => setName(event.target.value)} placeholder="Seu nome" value={name} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="profile-email">
                E-mail
              </label>
              <Input id="profile-email" readOnly value={email} />
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
          {feedback ? <p className="text-sm text-emerald-600 dark:text-emerald-300">{feedback}</p> : null}

          <div className="mt-auto flex justify-end">
            <Button disabled={saving} onClick={handleSave} type="button">
              {saving ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
