"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setFormMessage("");
    setFormError(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
        }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; redirectUrl?: string };
      if (!response.ok || !result.ok)
        throw new Error(result.message || "We could not create your access.");

      setSubmitted(true);
      setFormMessage("Your request has been sent. You have access to the settlement database…");
      event.currentTarget.reset();

      // Redirect after short delay so user sees the success message
      const redirectUrl = result.redirectUrl;
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1200);
      }
    } catch (error) {
      setSubmitted(false);
      setFormError(true);
      setFormMessage(error instanceof Error ? error.message : "We could not create your access.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Abandoned Funds Recovery Group home">
          <span className="brand-mark" aria-hidden="true">
            <svg className="brand-logo" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="afgr-shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f4f2eb" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#e2e0db" />
                </linearGradient>
                <linearGradient id="afgr-border-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4AF6B" />
                  <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
              </defs>
              <path d="M60 6 L94 26 V58 C94 76 82 92 60 102 C38 92 26 76 26 58 V26 Z" fill="url(#afgr-shield-gradient)" stroke="url(#afgr-border-gold)" strokeWidth="2.5" strokeLinejoin="round" />
              <text x="60" y="72" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="600" fontSize="32" fill="#071c24">AF</text>
              <text x="60" y="88" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="600" fontSize="14" fill="#8a6c3b" letterSpacing="2">RG</text>
            </svg>
          </span>
          <span className="brand-copy">
            <strong>Abandoned Funds</strong>
            <span>Recovery Group</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/#approach">Our approach</Link>
          <Link href="/#about">About us</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
      </header>

      <section className="login-hero">
        <div className="login-glow glow-one" aria-hidden="true" />
        <div className="login-glow glow-two" aria-hidden="true" />
        <div className="login-container">
          <div className="login-badge flashing-badge" role="status" aria-label="Free Class Action Claim Portal — verified access">
            <img src="/aasi-og.svg" alt="AASI Advertising Audit Services International" className="badge-logo badge-logo-sm" />
            <span className="badge-text">FREE CLASS ACTION CLAIM PORTAL</span>
          </div>

          <div className="login-copy">
            <div className="eyebrow"><span /> Verified access
            </div>
            <h1><em>Access the portal.</em></h1>
            <p className="login-lede">
              Enter your email and full name to unlock the daily-updated class action settlement database. Every eligible claim is tracked, every deadline is monitored.
            </p>
          </div>

          {submitted ? (
            <div className="login-success">
              <div className="success-icon" aria-hidden="true">✓</div>
              <h3>Access Granted</h3>
              <p>{formMessage}</p>
              <Link href="/settlements" className="button button-primary">
                View settlements <span>↗</span>
              </Link>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label>Full name
                  <input name="name" type="text" autoComplete="name" placeholder="Your legal name" required />
                </label>
              </div>
              <div className="form-field">
                <label>Email address
                  <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
                </label>
              </div>
              <div className="form-footer">
                <p className="form-note">
                  <span>↗</span> No spam. Unsubscribe anytime. Your data is held privately and never sold.
                </p>
                <button className="button button-primary" type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : <>Send request <span>↗</span></>}
                </button>
              </div>
              {(submitted || formMessage) && (
                <p className={`form-status ${formError ? "error" : ""}`} role="status">
                  {formMessage}
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Abandoned Funds Recovery Group</span>
      </footer>
    </main>
  );
}
