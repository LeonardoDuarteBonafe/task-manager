"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";

type TaskFormValues = {
  title: string;
  notes: string;
  scheduledTime: string;
  recurrenceType: RecurrenceType;
  weekdays: number[];
  startDate: string;
  endDate: string;
  notificationRepeatMinutes: number;
  maxOccurrences: string;
};

type TaskFormProps = {
  submitting: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  submitLabel?: string;
  initialValues?: Partial<TaskFormValues>;
};

const weekdayOptions = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

export function TaskForm({ submitting, error, onSubmit, submitLabel = "Salvar", initialValues }: TaskFormProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [values, setValues] = useState<TaskFormValues>({
    title: initialValues?.title ?? "",
    notes: initialValues?.notes ?? "",
    scheduledTime: initialValues?.scheduledTime ?? "08:00",
    recurrenceType: initialValues?.recurrenceType ?? "DAILY",
    weekdays: initialValues?.weekdays ?? [],
    startDate: initialValues?.startDate ?? todayIso,
    endDate: initialValues?.endDate ?? "",
    notificationRepeatMinutes: initialValues?.notificationRepeatMinutes ?? 10,
    maxOccurrences: initialValues?.maxOccurrences ?? "",
  });

  const isWeekly = values.recurrenceType === "WEEKLY";
  const canSubmit = useMemo(() => {
    if (!values.title.trim()) return false;
    if (isWeekly && values.weekdays.length === 0) return false;
    if (values.maxOccurrences && Number(values.maxOccurrences) < 1) return false;
    return true;
  }, [isWeekly, values.title, values.weekdays.length, values.maxOccurrences]);

  const toggleWeekday = (day: number) => {
    setValues((current) => {
      const exists = current.weekdays.includes(day);
      return {
        ...current,
        weekdays: exists ? current.weekdays.filter((d) => d !== day) : [...current.weekdays, day].sort((a, b) => a - b),
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="title">
          Nome da tarefa
        </label>
        <Input
          id="title"
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          placeholder="Ex: Tomar remedio"
          required
          value={values.title}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="notes">
          Notas
        </label>
        <Textarea
          id="notes"
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Detalhes opcionais"
          rows={3}
          value={values.notes}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="startDate">
            Data inicial
          </label>
          <Input
            id="startDate"
            onChange={(event) => setValues((current) => ({ ...current, startDate: event.target.value }))}
            required
            type="date"
            value={values.startDate}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="scheduledTime">
            Horario
          </label>
          <Input
            id="scheduledTime"
            onChange={(event) => setValues((current) => ({ ...current, scheduledTime: event.target.value }))}
            required
            type="time"
            value={values.scheduledTime}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="recurrenceType">
          Recorrencia
        </label>
        <Select
          id="recurrenceType"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              recurrenceType: event.target.value as TaskFormValues["recurrenceType"],
              weekdays: event.target.value === "WEEKLY" ? current.weekdays : [],
            }))
          }
          value={values.recurrenceType}
        >
          <option value="ONCE">Uma vez</option>
          <option value="DAILY">Diariamente</option>
          <option value="WEEKLY">Semanalmente</option>
          <option value="MONTHLY">Mensalmente</option>
        </Select>
      </div>

      {isWeekly ? (
        <div>
          <p className="mb-2 block text-sm font-medium text-slate-700">Dias da semana</p>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((day) => {
              const active = values.weekdays.includes(day.value);
              return (
                <button
                  className={`rounded-lg border px-3 py-2 text-sm ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  key={day.value}
                  onClick={() => toggleWeekday(day.value)}
                  type="button"
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="endDate">
            Data final (opcional)
          </label>
          <Input
            id="endDate"
            onChange={(event) => setValues((current) => ({ ...current, endDate: event.target.value }))}
            type="date"
            value={values.endDate}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="notificationRepeatMinutes">
            Intervalo notificacao (min)
          </label>
          <Input
            id="notificationRepeatMinutes"
            min={1}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                notificationRepeatMinutes: Number(event.target.value || 10),
              }))
            }
            type="number"
            value={values.notificationRepeatMinutes}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="maxOccurrences">
            Limite maximo de repeticoes
          </label>
          <Input
            id="maxOccurrences"
            min={1}
            onChange={(event) => setValues((current) => ({ ...current, maxOccurrences: event.target.value }))}
            placeholder="Vazio = infinito"
            type="number"
            value={values.maxOccurrences}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button disabled={submitting || !canSubmit} type="submit">
        {submitting ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

export type { TaskFormValues };
