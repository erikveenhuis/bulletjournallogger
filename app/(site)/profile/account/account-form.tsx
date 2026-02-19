"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  accountTier: number;
  hasStripeCheckout?: boolean;
  isAdmin?: boolean;
  tierPrices?: Record<number, string>;
};

const tiers = [
  { id: 0, name: "Free", description: "Up to 3 global questions" },
  { id: 1, name: "Tier 1", description: "Unlock more than 3 global questions" },
  { id: 2, name: "Tier 2", description: "Add color overrides on questions" },
  { id: 3, name: "Tier 3", description: "Create up to 5 personal questions" },
  { id: 4, name: "Tier 4", description: "Unlimited personal questions" },
] as const;

export default function AccountForm({ accountTier, hasStripeCheckout = false, isAdmin = false, tierPrices = {} }: Props) {
  const [currentTier, setCurrentTier] = useState(accountTier);
  const [pendingTier, setPendingTier] = useState(accountTier);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      setMessage("Subscription active. Your tier has been updated.");
      router.replace("/profile/account", { scroll: false });
    }
  }, [searchParams, router]);

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

  const startUpgrade = async (tier: number) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to start checkout");
      return;
    }
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const currentTierMeta = tiers.find((tier) => tier.id === currentTier);
  const pendingTierMeta = tiers.find((tier) => tier.id === pendingTier);
  const isUpgradeFlow = pendingTier > currentTier && hasStripeCheckout && !isAdmin;
  const isDowngradeFlow = pendingTier < currentTier;
  const hasSelectionChange = pendingTier !== currentTier;

  return (
    <section className="bujo-card bujo-torn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Account access</h2>
          <p className="text-sm text-gray-700">Each tier includes all features from lower tiers.</p>
          <p className="text-xs text-gray-600">
            Current plan:{" "}
            <span className="font-semibold text-gray-800">
              {currentTierMeta ? currentTierMeta.name : `Tier ${currentTier}`}
            </span>
            {hasSelectionChange && pendingTierMeta ? (
              <span className="ml-2 text-gray-500">- Selected: {pendingTierMeta.name}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isUpgradeFlow ? (
            <button
              type="button"
              onClick={() => startUpgrade(pendingTier)}
              className="bujo-btn text-sm"
              disabled={saving}
            >
              {saving ? "Redirecting..." : "Upgrade with subscription"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isDowngradeFlow) {
                  setConfirmDowngrade(true);
                } else {
                  updateTier(pendingTier);
                }
              }}
              className={isDowngradeFlow ? "bujo-btn-danger text-sm" : "bujo-btn text-sm"}
              disabled={saving || !hasSelectionChange}
            >
              {saving ? "Saving..." : isDowngradeFlow ? "Downgrade" : "Update tier"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-600">Tier benefits stack from free to tier 4.</div>

      <fieldset className="mt-3 space-y-2" aria-label="Choose account tier">
        {tiers.map((tier) => {
          const isCurrent = tier.id === currentTier;
          const isSelected = tier.id === pendingTier;
          const priceLabel =
            tier.id === 0 ? "Free" : (tierPrices[tier.id] ?? "Paid");

          return (
            <label
              key={tier.id}
              className={`grid cursor-pointer grid-cols-[1.1rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-white px-3 py-2.5 transition ${
                isSelected
                  ? "border-gray-500"
                  : "border-[var(--bujo-border)] hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="account-tier"
                value={tier.id}
                checked={isSelected}
                onChange={() => setPendingTier(tier.id)}
                className="h-4 w-4 shrink-0"
              />

              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {tier.name}
                  {isCurrent ? <span className="ml-2 text-xs font-normal text-gray-500">(current)</span> : null}
                </p>
                <p className="truncate text-xs text-gray-600">{tier.description}</p>
              </div>

              <p className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-800">
                {priceLabel}
              </p>
            </label>
          );
        })}
      </fieldset>
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
