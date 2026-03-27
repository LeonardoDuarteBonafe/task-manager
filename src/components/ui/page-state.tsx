import { Card } from "./card";

type PageStateProps = {
  title: string;
  description: string;
};

export function PageState({ title, description }: PageStateProps) {
  return (
    <Card className="text-center">
      <span className="inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
        Estado
      </span>
      <h2 className="mt-4 font-display text-3xl text-[var(--foreground)]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Card>
  );
}
