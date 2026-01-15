"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  accountTier: number;
};

const tierLabels = [
  "Free (up to 3 global questions)",
  "Tier 1 (unlock more than 3 global questions)",
  "Tier 2 (add color overrides on questions)",
  "Tier 3 (create up to 5 personal questions)",
  "Tier 4 (unlimited personal questions)",
];

export default function AccountForm({ accountTier }: Props) {
  const [currentTier, setCurrentTier] = useState(accountTier);
  const [pendingTier, setPendingTier] = useState(accountTier);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const updateTier = async (nextTier: number) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_tier: nextTier }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to update account status");
      return;
    }
    setCurrentTier(nextTier);
    setPendingTier(nextTier);
    setMessage("Account tier updated");
    router.refresh();
  };

  return (
    <section className="bujo-card bujo-torn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Account access</h2>
          <p className="text-sm text-gray-700">
            Each tier includes all features from lower tiers.
          </p>
          <p className="text-xs text-gray-600">
            Current tier: <span className="font-semibold">{tierLabels[currentTier] ?? `Tier ${currentTier}`}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (pendingTier < currentTier) {
                setConfirmDowngrade(true);
              } else {
                updateTier(pendingTier);
              }
            }}
            className={pendingTier < currentTier ? "bujo-btn-danger text-sm" : "bujo-btn text-sm"}
            disabled={saving || pendingTier === currentTier}
          >
            {saving ? "Saving..." : pendingTier < currentTier ? "Downgrade" : "Update tier"}
          </button>
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-600">
        Tier benefits stack from free → tier 4.
      </div>
      <div className="mt-2 grid gap-2 text-sm text-gray-700">
        {tierLabels.map((label, idx) => (
          <label key={label} className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2">
            <input
              type="radio"
              name="account-tier"
              value={idx}
              checked={pendingTier === idx}
              onChange={() => setPendingTier(idx)}
              className="bujo-range"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {message && <p className="bujo-message mt-3 text-sm">{message}</p>}

      <ConfirmDialog
        open={confirmDowngrade}
        title="Downgrade account?"
        description="Downgrading may restrict adding new questions or color overrides."
        confirmLabel="Downgrade"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={() => {
          setConfirmDowngrade(false);
          updateTier(pendingTier);
        }}
        onCancel={() => setConfirmDowngrade(false)}
      />
    </section>
  );
}
