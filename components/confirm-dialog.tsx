"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const confirmClass = confirmTone === "danger" ? "bujo-btn-danger" : "bujo-btn";

  const dialogContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-6 shadow-2xl">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--bujo-ink)]">{title}</h3>
          {description ? <p className="text-sm text-[var(--bujo-subtle)]">{description}</p> : null}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`${confirmClass} w-full justify-center text-sm sm:w-auto`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
