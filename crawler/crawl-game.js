const fs=require("fs"),path=require("path");
const {chromium}=require("playwright");
const {GAME_TIMEOUT,BETWEEN_GAMES_MS}=require("./config");
const {ensureDir,slugify,sleep,hostOf,sameSite,writeJson}=require("./utils");

function asset(u){return /\.(js|mjs|css|wasm|data|unityweb|bundle|pak|json|png|jpg|jpeg|gif|webp|svg|mp3|ogg|wav|mp4|webm)(\?|$)/i.test(u)}
function candidateHost(h){if(!h||sameSite(h))return false;const bad=["google-analytics.com","googletagmanager.com","googlesyndication.com","doubleclick.net","gstatic.com","googleapis.com","facebook.net","youtube.com","ytimg.com","sentry.io"];return !bad.some(x=>h===x||h.endsWith("."+x))}

async function scanGame(game,outRoot,clickPlay=true){
  const dir=path.join(outRoot,game.category,slugify(game.slug));ensureDir(dir);
  const reqs=[],resps=[],sockets=[];let result;
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({recordHar:{path:path.join(dir,"network.har"),mode:"full",content:"omit"},viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
  const page=await ctx.newPage(); page.setDefaultTimeout(15000);
  page.on("request",r=>reqs.push({url:r.url(),method:r.method(),resourceType:r.resourceType(),frameUrl:r.frame()?.url()||null}));
  page.on("response",r=>resps.push({url:r.url(),status:r.status(),contentType:r.headers()["content-type"]||null,resourceType:r.request().resourceType(),frameUrl:r.frame()?.url()||null}));
  page.on("websocket",w=>sockets.push(w.url()));
  try{
    await page.goto(game.url,{waitUntil:"domcontentloaded",timeout:GAME_TIMEOUT});
    await page.waitForLoadState("networkidle",{timeout:10000}).catch(()=>{}); await sleep(1200);

    const embedHref=await page.evaluate(()=>{const cur=location.href.replace(/\/$/,"");return [...document.querySelectorAll("a[href]")].map(a=>a.href).find(x=>x.replace(/\/$/,"")===cur+".embed")||null}).catch(()=>null);
    let embed=null;
    if(embedHref)try{
      const r=await page.request.get(embedHref,{timeout:15000});const html=await r.text();
      fs.writeFileSync(path.join(dir,"embed.html"),html);
      embed={url:embedHref,status:r.status(),game_type:html.match(/let\s+game_type\s*=\s*["']([^"']+)/i)?.[1]||null,url_game:html.match(/let\s+url_game\s*=\s*["']([^"']+)/i)?.[1]||null};
    }catch(e){embed={url:embedHref,error:String(e.message||e)}}

    if(clickPlay){
      for(const s of ['button:has-text("Play")','a:has-text("Play")','[role="button"]:has-text("Play")','button:has-text("Start")','a:has-text("Start")','[role="button"]:has-text("Start")']){
        const l=page.locator(s).first(); if(await l.count().catch(()=>0)){await l.click({timeout:5000}).catch(()=>{});await sleep(5000);break}
      }
    }
    await sleep(2500);
    const frames=page.frames().map(f=>({url:f.url(),name:f.name()}));
    fs.writeFileSync(path.join(dir,"page.html"),await page.content().catch(()=>""));
    await page.screenshot({path:path.join(dir,"page.png")}).catch(()=>{});
    writeJson(path.join(dir,"frames.json"),frames);writeJson(path.join(dir,"requests.json"),reqs);writeJson(path.join(dir,"responses.json"),resps);

    const counts={};for(const r of resps){const h=hostOf(r.url);if(h)counts[h]=(counts[h]||0)+1}
    const hosts=Object.entries(counts).filter(([h])=>candidateHost(h)).sort((a,b)=>b[1]-a[1]).map(([host,response_count])=>({host,response_count}));
    result={scanned_at:new Date().toISOString(),game,page_url:game.url,embed,frames:frames.map(x=>x.url).filter(Boolean),game_hosts:hosts,websocket_urls:[...new Set(sockets)],asset_urls:[...new Set(resps.map(x=>x.url).filter(asset))].slice(0,300),request_count:reqs.length,response_count:resps.length,status:"verified"};
  }catch(e){
    result={scanned_at:new Date().toISOString(),game,status:"error",error:String(e.stack||e)};
    writeJson(path.join(dir,"error.json"),result);
  }finally{await ctx.close().catch(()=>{});await browser.close().catch(()=>{});await sleep(BETWEEN_GAMES_MS)}
  writeJson(path.join(dir,"analysis.json"),result);return result;
}
module.exports={scanGame};
