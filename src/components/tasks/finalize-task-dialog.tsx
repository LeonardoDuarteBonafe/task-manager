"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type FinalizeTaskDialogProps = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function FinalizeTaskDialog({ open, loading = false, onClose, onConfirm }: FinalizeTaskDialogProps) {
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    await onConfirm(reason.trim());
    setReason("");
  }

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Dialog
      description="Revise o impacto antes de confirmar a finalizacao."
      onClose={handleClose}
      open={open}
      size="md"
      title="Finalizar tarefa"
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Voce vai finalizar esta tarefa e todas suas recorrencias futuras, para isto, clique em confirmar abaixo ou pode cancelar.
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Detalhes</h3>
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo da finalizacao (opcional)"
            rows={4}
            value={reason}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button disabled={loading} onClick={handleClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={loading} onClick={handleConfirm} type="button" variant="danger">
            {loading ? "Finalizando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
