"use client";

import { useState } from "react";
import type { PushSubscription } from "@/lib/types";

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

  const deleteSubscription = async (id: string) => {
    setMessage(null);
    const res = await fetch("/api/admin/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete subscription");
      return;
    }
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    setMessage("Subscription removed");
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notification subscriptions</h2>
          <p className="text-sm text-gray-600">
            Active push endpoints (latest 500). Remove stale entries when needed.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{subscriptions.length} total</span>
      </div>
      <div className="mt-3 overflow-auto">
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-600">No subscriptions found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Endpoint</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Reminder</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">TZ</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Opt-in</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Created</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscriptions.map((sub) => {
                const profile = Array.isArray(sub.profiles) ? sub.profiles?.[0] : sub.profiles;
                const reminder = profile?.reminder_time ? profile.reminder_time.slice(0, 5) : "—";
                const timezone = profile?.timezone || "UTC";
                const optedIn = profile?.push_opt_in ? "Yes" : "No";
                const endpointLabel = sub.endpoint.replace(/^https?:\/\//, "");
                const userLabel = `${sub.user_id.slice(0, 6)}…`;
                return (
                  <tr key={sub.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-800" title={sub.user_id}>
                      {userLabel}
                    </td>
                    <td className="max-w-[320px] px-3 py-2 text-xs text-gray-800" title={sub.endpoint}>
                      <div className="line-clamp-2 break-all">{endpointLabel}</div>
                      {sub.ua && (
                        <div className="mt-1 line-clamp-2 text-[11px] text-gray-500" title={sub.ua}>
                          {sub.ua}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{reminder}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{timezone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{optedIn}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">
                      {formatDateTime(sub.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <button
                        onClick={() => deleteSubscription(sub.id)}
                        className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
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
      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
    </div>
  );
}
