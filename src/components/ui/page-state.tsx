import { Card } from "./card";

type PageStateProps = {
  title: string;
  description: string;
};

export function PageState({ title, description }: PageStateProps) {
  return (
    <Card className="text-center">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </Card>
  );
}
