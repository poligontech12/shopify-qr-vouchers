"use client";
import { useState, type FormEvent } from "react";

export function RedeemForm({ token }: { token: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/redeem/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        // Refresh so the server component re-renders as "Already redeemed".
        window.location.reload();
        return;
      }
      const text = await res.text();
      setError(text || "Could not redeem");
      setSubmitting(false);
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Store PIN</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-4 text-center text-2xl tracking-widest"
          placeholder="••••"
          autoFocus
        />
      </label>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || pin.length < 4}
        className="w-full rounded-md bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:bg-gray-400"
      >
        {submitting ? "Redeeming…" : "Mark as Redeemed"}
      </button>
    </form>
  );
}
