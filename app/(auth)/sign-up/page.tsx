"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error("Supabase environment variables are missing.");
      }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bulletjournallogger.up.railway.app";
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteUrl,
        },
      });
      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Could not reach the auth service. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md bujo-card bujo-ruled">
      <h1 className="text-xl font-semibold text-gray-900">Create account</h1>
      <p className="text-sm text-gray-700">
        Already registered?{" "}
        <Link href="/sign-in" className="bujo-link">
          Sign in
        </Link>
        .
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bujo-input"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bujo-input"
          />
        </div>
        {error && <p className="bujo-message text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bujo-btn text-sm disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
