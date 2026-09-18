const { chromium } = require("playwright");
const {
  BASE,
  CATEGORIES,
  PAGE_TIMEOUT,
  MAX_CATEGORY_PAGES
} = require("./config");

const { sleep, writeJson, ensureDir } = require("./utils");

function normalizeUrl(href) {
  try {
    const url = new URL(href, BASE);

    if (url.origin !== BASE) return null;

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

    if (u.origin !== BASE) return false;

    const parts = u.pathname.split("/").filter(Boolean);

    // Game pages on eaglercraftgame.io are root-level:
    // /minecraft-classic
    // /eaglecraft-1122-u2
    // /minecraft-survival
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

async function discoverCategory(browser, category, startPath) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const found = new Map();

  const diagnostics = {
    category,
    categoryUrl: BASE + startPath,
    pages: []
  };

  try {
    for (let n = 1; n <= MAX_CATEGORY_PAGES; n++) {
      const url =
        n === 1
          ? BASE + startPath
          : BASE + startPath + "?page=" + n;

      console.log(`Discovering ${category}, page ${n}: ${url}`);

      let response = null;
      let navigationError = null;

      try {
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: PAGE_TIMEOUT
        });

        await page
          .waitForLoadState("networkidle", { timeout: 7000 })
          .catch(() => {});

        await sleep(1000);
      } catch (error) {
        navigationError = error.message;
      }

      const status = response ? response.status() : null;
      const finalUrl = page.url();
      const title = await page.title().catch(() => "");

      const links = await page
        .locator("a[href]")
        .evaluateAll((anchors) =>
          anchors.map((a) => ({
            href: a.href,
            text: (a.textContent || "").trim()
          }))
        )
        .catch(() => []);

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

      let added = 0;

      for (const candidate of candidates) {
        if (!found.has(candidate.url)) {
          found.set(candidate.url, {
            name: candidate.title || candidate.url,
            slug: new URL(candidate.url).pathname
              .replace(/^\//, ""),
            url: candidate.url,
            category
          });

          added++;
        }
      }

      diagnostics.pages.push({
        page: n,
        requestedUrl: url,
        finalUrl,
        status,
        title,
        anchorCount: links.length,
        candidateCount: candidates.length,
        added,
        navigationError
      });

      console.log(
        `  status=${status} anchors=${links.length} candidates=${candidates.length} added=${added}`
      );

      /*
       * If pagination produces no new games, stop.
       *
       * We allow page 1 to finish even if it somehow contains zero
       * candidates, so diagnostics can tell us what happened.
       */
      if (n > 1 && added === 0) {
        break;
      }

      await sleep(300);
    }
  } finally {
    await context.close();
  }

  return {
    games: [...found.values()],
    diagnostics
  };
}

async function discoverAll(which = "all") {
  ensureDir("results");

  const browser = await chromium.launch({
    headless: true
  });

  const allGames = [];
  const diagnostics = [];

  try {
    const categories =
      which === "all"
        ? Object.keys(CATEGORIES)
        : [which];

    for (const category of categories) {
      if (!CATEGORIES[category]) {
        console.log(`Unknown category: ${category}`);
        continue;
      }

      try {
        const result = await discoverCategory(
          browser,
          category,
          CATEGORIES[category]
        );

        allGames.push(...result.games);
        diagnostics.push(result.diagnostics);

        console.log(
          `${category}: ${result.games.length} game candidates`
        );
      } catch (error) {
        console.error(
          `${category}: discovery failed: ${error.message}`
        );

        diagnostics.push({
          category,
          error: error.message,
          games: []
        });
      }
    }
  } finally {
    await browser.close();
  }

  // Deduplicate by URL.
  const unique = [
    ...new Map(
      allGames.map((game) => [game.url, game])
    ).values()
  ];

  const output = {
    generated_at: new Date().toISOString(),
    source: BASE,
    category: which,
    count: unique.length,
    games: unique,
    diagnostics
  };

  writeJson("results/discovered.json", output);

  console.log("");
  console.log("========================================");
  console.log(`DISCOVERY COMPLETE: ${unique.length} games`);
  console.log("========================================");

  return unique;
}

module.exports = {
  discoverAll
};
