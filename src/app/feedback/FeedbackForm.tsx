"use client";

import { useState, type FormEvent } from "react";

export default function FeedbackForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setSent(false);

    const form = e.currentTarget;
    const values = new FormData(form);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minecraftName: values.get("minecraftName"),
          type: values.get("type"),
          message: values.get("message"),
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not send feedback. Please try again.");
        return;
      }

      form.reset();
      setSent(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      {error && <p className="notice err" role="alert">{error}</p>}
      {sent && <p className="notice ok" role="status">Thanks! Your feedback has been sent.</p>}

      <label className="feedback-field">
        <span>Minecraft username <i>(optional)</i></span>
        <input name="minecraftName" className="feedback-input" placeholder="Your in-game name" maxLength={32} />
      </label>

      <label className="feedback-field">
        <span>Feedback type</span>
        <select name="type" className="feedback-select" defaultValue="suggestion">
          <option value="suggestion">Suggestion</option>
          <option value="complaint">Complaint</option>
          <option value="bug">Bug report</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="feedback-field feedback-message-field">
        <span>Your message</span>
        <textarea
          name="message"
          rows={6}
          minLength={5}
          maxLength={5000}
          placeholder="What’s on your mind? Please include any details that might help."
          required
          className="feedback-input feedback-textarea"
        />
      </label>

      <button type="submit" className="btn primary feedback-submit" disabled={busy}>
        {busy ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
