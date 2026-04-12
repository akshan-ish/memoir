"use client";

import { useState } from "react";

const STORAGE_KEY = "memoir-waitlist-signups";
const ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/akshan-ish/memoir";

type Status = "idle" | "submitting" | "done" | "error";

export function WaitlistHero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage(null);

    // Record locally so a broken endpoint doesn't swallow signups.
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Array<{ email: string; at: string }>;
      if (!existing.some((e) => e.email === trimmed)) {
        existing.push({ email: trimmed, at: new Date().toISOString() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      }
    } catch { /* localStorage unavailable */ }

    if (ENDPOINT) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ email: trimmed, source: "memoir-waitlist" }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        setStatus("done");
        setMessage("Saved. We'll be in touch when the app is ready.");
        return;
      }
    }

    setStatus("done");
    setMessage("You're on the list. We'll let you know when the app is ready.");
    setEmail("");
  };

  return (
    <section className="waitlist-hero">
      <div className="waitlist-hero-inner header-reveal">
        <p className="waitlist-eyebrow">Coming to iOS</p>
        <h1 className="waitlist-headline">
          A quiet record of<br />where you&rsquo;ve been.
        </h1>
        <p className="waitlist-subhead">
          Memoir turns your camera roll into a calm, editorial photo book &mdash;
          automatically, after the trip is over. No feeds. No likes. Just the
          photographs.
        </p>

        <form className="waitlist-form" onSubmit={submit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@somewhere.com"
            className="waitlist-input"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
            disabled={status === "submitting" || status === "done"}
            aria-label="Email address"
          />
          <button
            type="submit"
            className="waitlist-submit"
            disabled={status === "submitting" || status === "done"}
          >
            {status === "submitting" ? "\u2026" : status === "done" ? "\u2713" : "Join waitlist"}
          </button>
        </form>

        {message && (
          <p className={`waitlist-message ${status === "error" ? "waitlist-message--error" : ""}`}>
            {message}
          </p>
        )}

        <div className="waitlist-secondary">
          <span className="waitlist-or">Already a Claude Code user?</span>
          <a
            href={GITHUB_URL}
            className="waitlist-try-link"
            target="_blank"
            rel="noreferrer"
          >
            Use the skill today &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
