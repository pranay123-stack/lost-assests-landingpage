export const runtime = "edge";

// Import the scraped settlements data directly as a static JSON import.
// This file is regenerated daily by the cron job (scripts/scrape-claimdepot.py)
// and committed to the repo. On Vercel, the static JSON is served from
// /public/settlements-data/claimdepot-settlements.json and bundled at build time.
import settlementsDataRaw from "@/public/settlements-data/claimdepot-settlements.json";

interface SettlementDataFile {
  lastUpdated: string;
  source: string;
  total: number;
  settlements: SettlementData[];
}

const settlementsData = settlementsDataRaw as unknown as SettlementDataFile;

export interface SettlementData {
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
  settlementAmount?: string | null;
  caseNumber?: string | null;
  caseTitle?: string | null;
  court?: string | null;
  jurisdiction?: string | null;
  administrator?: string | null;
  fairnessHearing?: string | null;
  finalApprovalHearing?: string | null;
  proofRequired?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let results: SettlementData[] = settlementsData.settlements;

    if (category) {
      results = results.filter(
        (s) => s.category?.toLowerCase() === category.toLowerCase(),
      );
    }
    if (status) {
      results = results.filter(
        (s) => s.status?.toLowerCase() === status.toLowerCase(),
      );
    }

    results = results.slice(0, limit);

    return Response.json({
      ok: true,
      count: results.length,
      total: settlementsData.total || results.length,
      lastUpdated: settlementsData.lastUpdated || new Date().toISOString(),
      source: settlementsData.source || "claimdepot.com",
      data: results,
    });
  } catch (error) {
    console.error("Settlements API error:", error);
    return Response.json(
      { ok: false, message: "Unable to retrieve settlement data at this time." },
      { status: 502 },
    );
  }
}
