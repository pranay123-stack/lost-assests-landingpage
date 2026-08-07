"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

type DataRow = Record<string, string> & {
  __rowId: string;
  __sourceFile: string;
};

type ParsedFile = {
  name: string;
  columns: string[];
  rows: DataRow[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PAGE_SIZE = 25;

const preferredColumns = [
  "ASSET_RANK",
  "ASSET_CASE_ID",
  "OWNER_NAME",
  "PROPERTY_TYPE",
  "CURRENT_CASH_BALANCE",
  "OWNER_STATE",
  "CASE_STATUS",
  "HEIR_STATUS",
  "CONTACT_STATUS",
  "NEXT_ACTION",
  "REVIEWER",
];

const sampleColumns = [
  "ASSET_RANK",
  "ASSET_CASE_ID",
  "PROPERTY_ID",
  "OWNER_NAME",
  "PROPERTY_TYPE",
  "CURRENT_CASH_BALANCE",
  "CASH_REPORTED",
  "SHARES_REPORTED",
  "SECURITY_NAME",
  "CUSIP",
  "HOLDER_NAME",
  "OWNER_CITY",
  "OWNER_STATE",
  "CASE_STATUS",
  "DECEASED_STATUS",
  "IDENTITY_STATUS",
  "HEIR_STATUS",
  "CONTACT_STATUS",
  "NEXT_ACTION",
  "REVIEWER",
];

const sampleRows = [
  ["001", "SIM-001", "PROP-1001", "Morgan Estate", "Securities", "$425,000.00", "$125,000.00", "2400", "Example Holdings", "000000000", "Sample Transfer Agent", "Phoenix", "AZ", "Research", "Confirmed", "Pending", "Located", "Not contacted", "Verify probate authority", "JR"],
  ["002", "SIM-002", "PROP-1002", "Taylor Family Trust", "Mineral royalties", "$318,450.75", "$318,450.75", "", "", "", "Sample Energy Operator", "Tulsa", "OK", "Document review", "N/A", "Verified", "Researching", "Contacted", "Obtain division orders", "AS"],
  ["003", "SIM-003", "PROP-1003", "Jordan Heirs", "Life insurance", "$246,900.00", "$246,900.00", "", "", "", "Sample Insurance Carrier", "Columbus", "OH", "Heir outreach", "Confirmed", "Verified", "Multiple heirs", "In progress", "Collect relationship records", "JR"],
  ["004", "SIM-004", "PROP-1004", "Casey Estate", "State unclaimed property", "$187,250.20", "$187,250.20", "", "", "", "State Custodian", "Sacramento", "CA", "Ready for claim", "Confirmed", "Verified", "Verified", "Authorized", "Prepare claim package", "ML"],
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value: string, index: number): string {
  const normalized = value.replace(/^\uFEFF/, "").trim();
  return normalized || `COLUMN_${index + 1}`;
}

async function parseFile(file: File): Promise<ParsedFile> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error(`${file.name} is not a CSV file.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than the 10 MB browser limit.`);
  }

  const matrix = parseCsv(await file.text());
  if (matrix.length < 2) throw new Error(`${file.name} does not contain data rows.`);

  const columns = matrix[0].map(normalizeHeader);
  const rows = matrix.slice(1).map((values, rowIndex) => {
    const item: DataRow = {
      __rowId: `${file.name}-${rowIndex}`,
      __sourceFile: file.name,
    };
    columns.forEach((column, columnIndex) => {
      item[column] = values[columnIndex]?.trim() ?? "";
    });
    return item;
  });

  return { name: file.name, columns, rows };
}

function currencyValue(value: string): number {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function maskOwner(value: string): string {
  if (!value) return "—";
  return value
    .split(/\s+/)
    .map((part) => part.length <= 2 ? `${part[0] ?? ""}•` : `${part.slice(0, 2)}${"•".repeat(Math.min(6, part.length - 2))}`)
    .join(" ");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function filterOptions(rows: DataRow[], column: string): string[] {
  return Array.from(new Set(rows.map((row) => row[column]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function WorkspacePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [caseStatus, setCaseStatus] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [ownerState, setOwnerState] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [sortBy, setSortBy] = useState("balance-desc");
  const [maskNames, setMaskNames] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<DataRow | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const visibleColumns = useMemo(() => {
    const preferred = preferredColumns.filter((column) => columns.includes(column));
    return preferred.length ? preferred : columns.slice(0, 11);
  }, [columns]);

  const options = useMemo(() => ({
    caseStatus: filterOptions(rows, "CASE_STATUS"),
    propertyType: filterOptions(rows, "PROPERTY_TYPE"),
    ownerState: filterOptions(rows, "OWNER_STATE"),
    reviewer: filterOptions(rows, "REVIEWER"),
  }), [rows]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = rows.filter((row) => {
      if (caseStatus && row.CASE_STATUS !== caseStatus) return false;
      if (propertyType && row.PROPERTY_TYPE !== propertyType) return false;
      if (ownerState && row.OWNER_STATE !== ownerState) return false;
      if (reviewer && row.REVIEWER !== reviewer) return false;
      if (!search) return true;
      return columns.some((column) => row[column]?.toLowerCase().includes(search));
    });

    return [...matches].sort((a, b) => {
      if (sortBy === "balance-desc") return currencyValue(b.CURRENT_CASH_BALANCE ?? "") - currencyValue(a.CURRENT_CASH_BALANCE ?? "");
      if (sortBy === "balance-asc") return currencyValue(a.CURRENT_CASH_BALANCE ?? "") - currencyValue(b.CURRENT_CASH_BALANCE ?? "");
      if (sortBy === "rank-asc") return Number(a.ASSET_RANK || 0) - Number(b.ASSET_RANK || 0);
      return (a.OWNER_NAME ?? "").localeCompare(b.OWNER_NAME ?? "");
    });
  }, [rows, columns, query, caseStatus, propertyType, ownerState, reviewer, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalBalance = filteredRows.reduce((sum, row) => sum + currencyValue(row.CURRENT_CASH_BALANCE ?? ""), 0);
  const distinctStates = new Set(filteredRows.map((row) => row.OWNER_STATE).filter(Boolean)).size;
  const actionCount = filteredRows.filter((row) => row.NEXT_ACTION?.trim()).length;

  async function loadFiles(files: File[]) {
    if (!files.length) return;
    setIsLoading(true);
    setError("");

    try {
      const parsed = await Promise.all(files.map(parseFile));
      const mergedColumns = Array.from(new Set(parsed.flatMap((file) => file.columns)));
      const mergedRows = parsed.flatMap((file) => file.rows);
      setColumns(mergedColumns);
      setRows(mergedRows);
      setFileNames(parsed.map((file) => file.name));
      setPage(1);
      setSelectedRow(null);
      setQuery("");
      setCaseStatus("");
      setPropertyType("");
      setOwnerState("");
      setReviewer("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The file could not be read.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void loadFiles(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void loadFiles(Array.from(event.dataTransfer.files));
  }

  function loadSample() {
    const sampleData = sampleRows.map((values, rowIndex) => {
      const item: DataRow = { __rowId: `sample-${rowIndex}`, __sourceFile: "sanitized-sample.csv" };
      sampleColumns.forEach((column, columnIndex) => {
        item[column] = values[columnIndex] ?? "";
      });
      return item;
    });
    setColumns(sampleColumns);
    setRows(sampleData);
    setFileNames(["sanitized-sample.csv"]);
    setError("");
    setPage(1);
    setSelectedRow(null);
  }

  function clearWorkspace() {
    setRows([]);
    setColumns([]);
    setFileNames([]);
    setSelectedRow(null);
    setQuery("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function exportFiltered() {
    if (!filteredRows.length) return;
    const body = [
      columns.map(csvCell).join(","),
      ...filteredRows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lost-assets-filtered-view.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function displayValue(column: string, value: string): string {
    if (column === "OWNER_NAME" && maskNames) return maskOwner(value);
    if (column === "CURRENT_CASH_BALANCE" && value) return formatCurrency(currencyValue(value));
    return value || "—";
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Link className="brand" href="/" aria-label="Lost Assets home">
          <span className="brand-mark" aria-hidden="true">
                        <svg className="brand-logo" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="afgr-shield-gradient-w" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#f4f2eb" />
                              <stop offset="50%" stopColor="#ffffff" />
                              <stop offset="100%" stopColor="#e2e0db" />
                            </linearGradient>
                            <linearGradient id="afgr-border-gold-w" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#D4AF6B" />
                              <stop offset="100%" stopColor="#FFD700" />
                            </linearGradient>
                          </defs>
                          <path d="M60 6 L94 26 V58 C94 76 82 92 60 102 C38 92 26 76 26 58 V26 Z" fill="url(#afgr-shield-gradient-w)" stroke="url(#afgr-border-gold-w)" strokeWidth="2.5" strokeLinejoin="round" />
                          <text x="60" y="72" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="600" fontSize="32" fill="#071c24">AF</text>
                          <text x="60" y="88" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="600" fontSize="14" fill="#8a6c3b" letterSpacing="2">RG</text>
                        </svg>
                      </span>
          <span className="brand-copy">
            <strong>Lost Assets</strong>
            <span>Case Workspace</span>
          </span>
        </Link>
        <div className="workspace-header-actions">
          <span><i /> Browser-private session</span>
          <Link href="/">Return to site ↗</Link>
        </div>
      </header>

      <section className="workspace-hero">
        <div>
          <div className="workspace-eyebrow"><span /> Recovery operations</div>
          <h1>Turn case files into<br /><em>an actionable view.</em></h1>
          <p>Import one or more CSV files, review the portfolio, filter recovery priorities, inspect case details, and export a focused working list.</p>
        </div>
        <div className="privacy-panel">
          <span className="privacy-icon">◆</span>
          <div>
            <strong>Your records stay in this browser tab.</strong>
            <p>Files are read on your device and are not uploaded to a server. Closing or clearing the workspace removes the active data.</p>
          </div>
        </div>
      </section>

      <section className="workspace-shell">
        {!rows.length ? (
          <div className="workspace-empty">
            <div
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="drop-icon">⇧</span>
              <div className="workspace-eyebrow dark"><span /> Local file import</div>
              <h2>Drop heir-recovery CSV files here.</h2>
              <p>Use the supplied 20-column working copy or another comma-separated case file. Multiple compatible files are combined into one review view.</p>
              <div className="drop-actions">
                <button className="workspace-button primary" type="button" onClick={() => inputRef.current?.click()} disabled={isLoading}>
                  {isLoading ? "Reading files…" : "Choose CSV files"} <span>↗</span>
                </button>
                <button className="workspace-button secondary" type="button" onClick={loadSample}>Open sanitized sample</button>
              </div>
              <input ref={inputRef} className="file-input" type="file" accept=".csv,text/csv" multiple onChange={handleInput} />
              <small>CSV only · Up to 10 MB per file · No server transfer</small>
            </div>
            {error && <p className="workspace-error" role="alert">{error}</p>}

            <div className="schema-preview">
              <div>
                <span>Recognized case structure</span>
                <h3>Designed around your heir-recovery working copy.</h3>
              </div>
              <div className="schema-tags">
                {["Case IDs", "Owner & location", "Property type", "Cash & shares", "Identity status", "Heir status", "Contact status", "Next action", "Reviewer"].map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="portfolio-view">
            <div className="portfolio-bar">
              <div>
                <div className="workspace-eyebrow dark"><span /> Active portfolio</div>
                <h2>{fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files combined`}</h2>
                <p>{rows.length.toLocaleString()} records · {columns.length} columns · local browser session</p>
              </div>
              <div className="portfolio-actions">
                <button className="workspace-button secondary" type="button" onClick={() => inputRef.current?.click()}>Replace files</button>
                <button className="workspace-button primary" type="button" onClick={exportFiltered}>Export filtered CSV ↗</button>
                <button className="text-button" type="button" onClick={clearWorkspace}>Clear</button>
                <input ref={inputRef} className="file-input" type="file" accept=".csv,text/csv" multiple onChange={handleInput} />
              </div>
            </div>

            {error && <p className="workspace-error" role="alert">{error}</p>}

            <div className="metric-grid">
              <article><span>Visible records</span><strong>{filteredRows.length.toLocaleString()}</strong><small>of {rows.length.toLocaleString()} imported</small></article>
              <article><span>Visible balance</span><strong>{formatCurrency(totalBalance)}</strong><small>current cash balance</small></article>
              <article><span>States represented</span><strong>{distinctStates}</strong><small>within current filters</small></article>
              <article><span>Next actions</span><strong>{actionCount}</strong><small>records with assigned work</small></article>
            </div>

            <div className="filter-panel">
              <label className="search-field">
                Search all fields
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Owner, case ID, holder, action…" />
              </label>
              <label>Case status<select value={caseStatus} onChange={(event) => { setCaseStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{options.caseStatus.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Property type<select value={propertyType} onChange={(event) => { setPropertyType(event.target.value); setPage(1); }}><option value="">All types</option>{options.propertyType.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>State<select value={ownerState} onChange={(event) => { setOwnerState(event.target.value); setPage(1); }}><option value="">All states</option>{options.ownerState.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Reviewer<select value={reviewer} onChange={(event) => { setReviewer(event.target.value); setPage(1); }}><option value="">All reviewers</option>{options.reviewer.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="balance-desc">Balance: high to low</option><option value="balance-asc">Balance: low to high</option><option value="rank-asc">Asset rank</option><option value="owner-asc">Owner name</option></select></label>
              <label className="mask-toggle">
                <input type="checkbox" checked={maskNames} onChange={(event) => setMaskNames(event.target.checked)} />
                <span>Mask owner names</span>
              </label>
            </div>

            <div className="table-frame">
              <table>
                <thead>
                  <tr>{visibleColumns.map((column) => <th key={column}>{column.replace(/_/g, " ")}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.__rowId} onClick={() => setSelectedRow(row)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelectedRow(row); }}>
                      {visibleColumns.map((column) => <td key={column} data-column={column}>{displayValue(column, row[column] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pageRows.length && <div className="no-results">No records match the current filters.</div>}
            </div>

            <div className="pagination">
              <span>Showing {pageRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</span>
              <div>
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount}>Next</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {selectedRow && (
        <div className="detail-overlay" role="presentation" onClick={() => setSelectedRow(null)}>
          <aside className="detail-panel" role="dialog" aria-modal="true" aria-label="Case details" onClick={(event) => event.stopPropagation()}>
            <div className="detail-heading">
              <div>
                <span>Case detail</span>
                <h2>{maskNames ? maskOwner(selectedRow.OWNER_NAME) : selectedRow.OWNER_NAME || selectedRow.ASSET_CASE_ID}</h2>
                <p>{selectedRow.ASSET_CASE_ID || "No case ID"} · {selectedRow.__sourceFile}</p>
              </div>
              <button type="button" aria-label="Close case details" onClick={() => setSelectedRow(null)}>×</button>
            </div>
            <div className="detail-grid">
              {columns.map((column) => (
                <div key={column}>
                  <span>{column.replace(/_/g, " ")}</span>
                  <strong>{displayValue(column, selectedRow[column] ?? "")}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      <footer className="workspace-footer">
        <p>Local review workspace · No server-side file storage</p>
        <Link href="/">Lost Assets Division of AASI ↗</Link>
      </footer>
    </main>
  );
}
