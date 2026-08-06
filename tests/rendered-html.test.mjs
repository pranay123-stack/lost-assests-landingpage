import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the landing page with expected content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  // Verify the page renders our actual content
  assert.match(html, /<title>[^<]*Funds Recovery[^<]*<\/title>/i);
  assert.match(html, /hero/);
  assert.match(html, /flashing-badge/i);
  assert.match(html, /Class Action Claim Portal/i);
  assert.match(html, /<nav aria-label="Primary navigation">/i);
  assert.match(html, /href="\/login"/i);
  assert.match(html, /href="\/settlements"/i);
});

test("server-renders the settlements API route", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/settlements"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /json/i);

  const data = await response.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length > 0);
});

test("server-renders the login page with form", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/login"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*Claim Portal[^<]*<\/title>/i);
  assert.match(html, /type="email"/i);
  assert.match(html, /type="text"/i);
  assert.match(html, /name="name"/i);
  assert.match(html, /name="email"/i);
});

test("project metadata references match actual routes", async () => {
  const [pkg, page] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  // Verify new routes are in the project
  assert.match(page, /href="\/login"/i);
  assert.match(page, /href="\/settlements"/i);
  assert.match(pkg, /scrape:settlements/i);
});
