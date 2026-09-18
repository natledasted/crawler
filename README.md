# GN-Math Eaglercraft Source Crawler

Automated technical-source research crawler for https://eaglercraftgame.io/.

## Architecture
The browser crawler runs in GitHub Actions (Playwright + Chromium). Vercel is only the optional dashboard. This avoids trying to run long Chromium jobs inside Vercel serverless functions.

## GitHub
1. Create a GitHub repository.
2. Upload/push this project.
3. Actions -> GN-Math Game Source Crawler -> Run workflow.
4. Start with category `minecraft`, max games `5`.
5. Later run `all` with max `0` for all discovered games.

The Action commits `results/` back to the repository.

## Vercel
Import the same GitHub repository into Vercel. The dashboard is `public/index.html`. When GitHub commits new results, Vercel can redeploy from the connected repository.

## Local
Node 20+:
`npm install`
`npx playwright install chromium`
`npm run crawl -- --category=minecraft --max=5`

## Output
Each game gets:
- analysis.json
- network.har
- frames.json
- requests.json
- responses.json
- embed.html when discoverable
- page.html
- page.png

Also:
- results/master.json
- results/master.csv

The crawler records technical evidence and URLs; it does not mirror or redistribute third-party game assets. A site's embedding of a game does not by itself establish permission to re-embed or redistribute it. Check ownership, license and embedding terms before using a game on GN-Math.

It does not bypass CAPTCHAs, authentication, paywalls or anti-bot/access controls.
