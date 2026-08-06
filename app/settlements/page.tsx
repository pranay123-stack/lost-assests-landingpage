import "./settlements.css";

interface SettlementData {
  slug: string;
  title: string;
  category: string | null;
  status: string | null;
  deadline: string | null;
  daysLeft: number | null;
  estimatedAmount: string | null;
  description: string | null;
  claimUrl: string;
  source: string | null;
  lastSeenAt: string | null;
  imageUrl?: string | null;
}

import Link from "next/link";

async function getSettlements(category?: string, status?: string) {
  // Use relative API path (works in both local dev and production)
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (status) params.set("status", status);

  const url = `/api/settlements?${params.toString()}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to fetch settlements");
  return res.json() as Promise<{
    ok: boolean;
    count: number;
    total: number;
    lastUpdated: string;
    settlements: SettlementData[];
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  "Open for Claims": "status-open",
  "Preliminarily Approved": "status-prelim",
  "Pending Final Approval": "status-pending-final",
  "Pending Court Approval": "status-pending-court",
  "Settlement Approved": "status-approved",
  Paid: "status-paid",
  Closed: "status-closed",
};

const CATEGORY_LABELS: Record<string, string> = {
  "Data Breach": "breach",
  Labor: "labor",
  Securities: "securities",
  Privacy: "privacy",
  "Text Messages": "text",
  Insurance: "insurance",
  "Deceptive Pricing": "pricing",
  ERISA: "erisa",
  Automotive: "auto",
  "Product Liability": "product",
  "Civil rights": "civil",
  "Fair Credit Reporting": "credit",
  Antitrust: "antitrust",
  Banking: "banking",
  "False Advertising": "advertising",
  Fraud: "fraud",
  Health: "health",
  Copyright: "copyright",
  Environmental: "env",
  "Do Not Call Registry": "dnc",
  TCPA: "tcpa",
  Travel: "travel",
  Housing: "housing",
  Negligence: "negligence",
  COVID: "covid",
  Debts: "debt",
};

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const { category, status } = await searchParams;
  const data = await getSettlements(category, status);

  const categoryOptions = [
    "Data Breach",
    "Labor",
    "Securities",
    "Privacy",
    "Text Messages",
    "Insurance",
    "Deceptive Pricing",
    "ERISA",
    "Automotive",
    "Product Liability",
    "Civil rights",
    "Fair Credit Reporting",
    "Antitrust",
    "Banking",
    "False Advertising",
  ];

  const statusOptions = [
    "Open for Claims",
    "Preliminarily Approved",
    "Pending Final Approval",
    "Pending Court Approval",
    "Settlement Approved",
    "Paid",
    "Closed",
  ];

  return (
    <main className="settlements-page">
      <header className="settlements-header">
        <Link className="brand" href="/" aria-label="Back to home">
          <span className="brand-copy">
            <strong>Abandoned Funds</strong>
            <span>Recovery Group</span>
          </span>
        </Link>
        <Link href="/login" className="login-link">
          Not {data?.total ? "you" : "signed in"}? <span>↗</span>
        </Link>
      </header>

      <section className="settlements-hero">
        <div className="flashing-badge" style={{ position: "static", marginBottom: "20px" }}>
          <img src="/aasi-og.svg" alt="AASI" className="badge-logo badge-logo-md" />
          <span className="badge-text">FREE CLASS ACTION CLAIM PORTAL</span>
        </div>
        <h1>
          <em>Class Action Settlements.</em> Updated daily.
        </h1>
        <p className="settlements-lede">
          {data?.total || 0} settlements tracked. Last updated{" "}
          {new Date(data?.lastUpdated || "").toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}.
        </p>
      </section>

      <section className="settlements-filters">
        <form className="filter-form" method="get">
          <label>
            Category
            <select name="category" defaultValue={category || ""}>
              <option value="">All categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={status || ""}>
              <option value="">All statuses</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-outline" type="submit">
            Filter <span>↗</span>
          </button>
          {(category || status) && (
            <Link href="/settlements" className="clear-filters">
              Clear filters
            </Link>
          )}
        </form>
      </section>

      <section className="settlements-list">
        {(data?.settlements?.length || 0) === 0 ? (
          <div className="settlements-empty">
            <p>No settlements found matching your filters.</p>
          </div>
        ) : (
          data?.settlements.map((s: SettlementData) => {
            const statusClass =
              STATUS_COLORS[s.status || ""] || "status-default";
            const catLabel = s.category
              ? CATEGORY_LABELS[s.category] || s.category.toLowerCase()
              : "uncategorized";
            const daysLeft = s.daysLeft;
            const isUrgent = daysLeft !== null && daysLeft <= 14;

            return (
              <article
                className={`settlement-card ${isUrgent ? "urgent" : ""}`}
                key={s.slug}
              >
                <div className="settlement-image">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt={s.title} loading="lazy" />
                  ) : (
                    <div className="image-placeholder" />
                  )}
                </div>
                <div className="settlement-content">
                  <div className="settlement-meta">
                    <span className={`category-tag cat-${catLabel}`}>
                      {s.category || "Uncategorized"}
                    </span>
                    <span className={`status-tag ${statusClass}`}>
                      {s.status || "Unknown"}
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p className="settlement-description">{s.description}</p>
                  {s.estimatedAmount && (
                    <div className="settlement-payout">
                      <strong>Estimated payout:</strong> {s.estimatedAmount}
                    </div>
                  )}
                  {daysLeft !== null && (
                    <div className="settlement-deadline">
                      <span className={`days-left ${isUrgent ? "urgent" : ""}`}>
                        {daysLeft} days left
                      </span>
                      {s.deadline && <span className="deadline-date">{s.deadline}</span>}
                    </div>
                  )}
                  <div className="settlement-actions">
                    <a
                      className="button button-primary"
                      href={s.claimUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View details <span>↗</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <footer className="settlements-footer">
        <p>
          Data sourced from{" "}
          <a
            href="https://www.claimdepot.com/settlements"
            target="_blank"
            rel="noopener noreferrer"
          >
            Claim Depot
          </a>{" "}
          via daily automated scraping. Last updated{" "}
          {new Date(data?.lastUpdated || "").toLocaleTimeString("en-US", {
            timeZoneName: "short",
          })}.
        </p>
      </footer>
    </main>
  );
}
