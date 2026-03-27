import { cn } from "@/lib/utils";

type AuthStageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
};

export function AuthStage({ eyebrow, title, description, children, aside, className }: AuthStageProps) {
  return (
    <main className={cn("auth-stage min-h-screen px-4 py-6 md:px-6", className)}>
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6 lg:grid-cols-[1.15fr_minmax(0,28rem)]">
        <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-soft)] backdrop-blur xl:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,64,39,0.22),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(31,58,95,0.18),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-5">
              <span className="inline-flex w-fit items-center rounded-full border border-[var(--border-subtle)] bg-white/70 px-4 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[var(--muted-strong)] dark:bg-black/10">
                {eyebrow}
              </span>
              <div className="max-w-2xl space-y-4">
                <h1 className="font-display text-5xl leading-none text-[var(--foreground)] sm:text-6xl">{title}</h1>
                <p className="max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">{description}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Vencidas primeiro", "Veja o que exige resposta agora sem perder o que vem depois."],
                ["Ritmo recorrente", "Organize tarefas diarias e semanais com um fluxo mais claro."],
                ["Camada offline", "Continue acompanhando a rotina mesmo quando a conexao oscila."],
              ].map(([label, copy]) => (
                <article
                  key={label}
                  className="rounded-[1.6rem] border border-[var(--border-subtle)] bg-white/55 p-4 backdrop-blur dark:bg-black/10"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-strong)]">{label}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fade-up flex items-center justify-center">
          <div className="w-full max-w-xl">
            {children}
            {aside ? <div className="mt-4">{aside}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
