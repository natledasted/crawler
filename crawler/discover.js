import { chromium } from "playwright";
import fs from "node:fs/promises";
import { BASE_URL, CATEGORIES, TIMEOUTS } from "./config.js";

function normalizeUrl(href) {
  try {
    const url = new URL(href, BASE_URL);

    if (url.origin !== BASE_URL) return null;

    url.hash = "";
    url.search = "";

    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function looksLikeGameUrl(url) {
  try {
    const u = new URL(url);

    if (u.origin !== BASE_URL) return false;

    const parts = u.pathname.split("/").filter(Boolean);

    // Game pages on eaglercraftgame.io are root-level:
    // /minecraft-classic
    // /eaglecraft-1122-u2
    // /paper-minecraft
    if (parts.length !== 1) return false;

    const slug = parts[0].toLowerCase();

    const ignored = new Set([
      "games",
      "game",
      "about",
      "contact",
      "privacy-policy",
      "terms-of-service",
      "login",
      "register",
      "search",
      "category",
      "categories",
      "sitemap",
      "robots"
    ]);

    if (ignored.has(slug)) return false;

    return /^[a-z0-9][a-z0-9-]*$/.test(slug);
  } catch {
    return false;
  }
}

async function discoverCategory(page, categoryUrl) {
  console.log(`Discovering: ${categoryUrl}`);

  const response = await page.goto(categoryUrl, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.navigation
  });

  await page.waitForTimeout(2000);

  const status = response?.status() ?? null;
  const finalUrl = page.url();
  const title = await page.title();

  console.log(`  status: ${status}`);
  console.log(`  final URL: ${finalUrl}`);
  console.log(`  title: ${title}`);

  const links = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((a) => ({
      href: a.href,
      text: (a.textContent || "").trim()
    }))
  );

  console.log(`  anchors found: ${links.length}`);

  const candidates = [];

  for (const link of links) {
    const normalized = normalizeUrl(link.href);

    if (!normalized) continue;

    if (looksLikeGameUrl(normalized)) {
      candidates.push({
        url: normalized,
        title: link.text
      });
    }
  }

  const unique = new Map();

  for (const item of candidates) {
    if (!unique.has(item.url)) {
      unique.set(item.url, item);
    }
  }

  return {
    categoryUrl,
    finalUrl,
    status,
    title,
    anchorCount: links.length,
    games: [...unique.values()]
  };
}

export async function discoverGames(category = "all") {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(TIMEOUTS.navigation);

  const categories =
    category === "all"
      ? Object.entries(CATEGORIES)
      : [[category, CATEGORIES[category]]];

  const discovered = [];
  const diagnostics = [];

  try {
    for (const [name, categoryUrl] of categories) {
      try {
        const result = await discoverCategory(page, categoryUrl);

        diagnostics.push(result);

        for (const game of result.games) {
          discovered.push({
            category: name,
            url: game.url,
            title: game.title
          });
        }

        console.log(
          `  ${name}: ${result.games.length} game candidates`
        );
      } catch (error) {
        console.error(`  ${name}: FAILED`);
        console.error(error.message);

        diagnostics.push({
          categoryUrl,
          error: error.message,
          games: []
        });
      }
    }
  } finally {
    await browser.close();
  }

  // Deduplicate by URL.
  const unique = new Map();

  for (const game of discovered) {
    if (!unique.has(game.url)) {
      unique.set(game.url, game);
    }
  }

  const result = {
    generated_at: new Date().toISOString(),
    source: BASE_URL,
    category,
    count: unique.size,
    games: [...unique.values()],
    diagnostics
  };

  await fs.mkdir("results", { recursive: true });

  await fs.writeFile(
    "results/discovered.json",
    JSON.stringify(result, null, 2)
  );

  console.log("");
  console.log(`DISCOVERY COMPLETE: ${unique.size} games`);

  return [...unique.values()];
}
