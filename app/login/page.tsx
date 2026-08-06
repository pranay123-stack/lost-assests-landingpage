"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import "./login.css";

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
      setFormMessage("Access granted. Redirecting to your class action settlements…");
      event.currentTarget.reset();

      // Redirect after short delay so user sees the success message
      if (result.redirectUrl) {
        setTimeout(() => {
          window.location.href = result.redirectUrl;
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
            <svg className="brand-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4 40 13v22L24 44 8 35V13L24 4Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M15 33 22.3 15h3.4L33 33M18.1 26h11.8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M29 16.5h6.5M29 21.5h5" stroke="var(--mint)" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="36.5" cy="12" r="2.5" fill="var(--mint)" />
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
                  {submitting ? "Granting access…" : <>Enter portal <span>↗</span></>}
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
