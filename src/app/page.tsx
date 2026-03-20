import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-4 py-10">
      <Card className="w-full space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">TaskManager MVP1</h1>
          <p className="text-slate-600">
            Gerencie tarefas recorrentes com foco em recorrencias vencidas, proximas acoes e uma rotina simples.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/login">
            <Button>Entrar</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Ir para o painel</Button>
          </Link>
          <Link href="/tasks?modal=create">
            <Button variant="ghost">Criar tarefa</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
