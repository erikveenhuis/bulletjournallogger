"use client";

import { useState } from "react";
import type { PushSubscription } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  subscriptions: PushSubscription[];
};

const formatDateTime = (value: string) => {
  const iso = new Date(value).toISOString();
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
};

export default function NotificationsClient({ subscriptions: initialSubscriptions }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>(initialSubscriptions);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = subscriptions.filter((sub) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const endpoint = sub.endpoint.toLowerCase();
    const uid = sub.user_id.toLowerCase();
    const ua = sub.ua?.toLowerCase() ?? "";
    return endpoint.includes(q) || uid.includes(q) || ua.includes(q);
  });

  const deleteSubscription = async () => {
    if (!pendingDeleteId) return;
    setMessage(null);
    const res = await fetch("/api/admin/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete subscription");
      setPendingDeleteId(null);
      return;
    }
    setSubscriptions((prev) => prev.filter((s) => s.id !== pendingDeleteId));
    setPendingDeleteId(null);
    setMessage("Subscription removed");
  };

  return (
    <div className="bujo-card bujo-torn">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Notification subscriptions</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">
            Active push endpoints (latest 500). Remove stale entries when needed.
          </p>
        </div>
        <span className="bujo-chip text-xs">
          {filtered.length} / {subscriptions.length} shown
        </span>
      </div>
      <div className="mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by user id, endpoint, or user agent"
          className="bujo-input w-full text-sm"
        />
      </div>
      <div className="mt-3 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--bujo-subtle)]">No subscriptions found.</p>
        ) : (
          <table className="min-w-full divide-y divide-[var(--bujo-border)] text-sm">
            <thead className="bg-[var(--bujo-paper)]">
              <tr className="text-left text-[var(--bujo-ink)]">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Reminder</th>
                <th className="px-3 py-2 font-medium">TZ</th>
                <th className="px-3 py-2 font-medium">Opt-in</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bujo-border)]">
              {filtered.map((sub) => {
                const profile = Array.isArray(sub.profiles) ? sub.profiles?.[0] : sub.profiles;
                const reminder = profile?.reminder_time ? profile.reminder_time.slice(0, 5) : "—";
                const timezone = profile?.timezone || "UTC";
                const optedIn = profile?.push_opt_in ? "Yes" : "No";
                const endpointLabel = sub.endpoint.replace(/^https?:\/\//, "");
                const userLabel = `${sub.user_id.slice(0, 6)}…`;
                return (
                  <tr key={sub.id} className="align-top text-[var(--bujo-ink)]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" title={sub.user_id}>
                      {userLabel}
                    </td>
                    <td className="max-w-[320px] px-3 py-2 text-xs" title={sub.endpoint}>
                      <div className="line-clamp-2 break-all">{endpointLabel}</div>
                      {sub.ua && (
                        <div className="mt-1 line-clamp-2 text-[11px] text-[var(--bujo-subtle)]" title={sub.ua}>
                          {sub.ua}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{reminder}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{timezone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{optedIn}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDateTime(sub.created_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <button onClick={() => setPendingDeleteId(sub.id)} className="bujo-btn-danger text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {message && <p className="mt-3 bujo-message text-sm">{message}</p>}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete subscription?"
        description="This will remove the push subscription immediately."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteSubscription}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
