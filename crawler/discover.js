const {chromium}=require("playwright");
const {BASE,CATEGORIES,PAGE_TIMEOUT,MAX_CATEGORY_PAGES}=require("./config");
const {sleep}=require("./utils");

async function discoverCategory(browser,category,startPath){
  const ctx=await browser.newContext(); const page=await ctx.newPage(); const found=new Map();
  try{
    for(let n=1;n<=MAX_CATEGORY_PAGES;n++){
      const url=n===1?BASE+startPath:BASE+startPath+"?page="+n;
      try{await page.goto(url,{waitUntil:"domcontentloaded",timeout:PAGE_TIMEOUT});await page.waitForLoadState("networkidle",{timeout:7000}).catch(()=>{});}catch{}
      const games=await page.evaluate(base=>[...document.querySelectorAll("a[href]")].map(a=>({name:(a.innerText||a.textContent||"").trim(),url:a.href})).filter(x=>{try{const u=new URL(x.url);return u.origin===base&&u.pathname.split("/").filter(Boolean).length===1&&!u.pathname.startsWith("/games/")}catch{return false}}),BASE);
      let added=0;
      for(const g of games){const slug=new URL(g.url).pathname.replace(/^\//,"");if(!found.has(g.url)){found.set(g.url,{name:g.name,slug,url:g.url,category});added++}}
      if(n>1&&added===0) break;
      await sleep(300);
    }
  }finally{await ctx.close()}
  return [...found.values()];
}
async function discoverAll(which="all"){
  const b=await chromium.launch({headless:true}); const out=[];
  try{for(const c of (which==="all"?Object.keys(CATEGORIES):[which])) if(CATEGORIES[c]) out.push(...await discoverCategory(b,c,CATEGORIES[c]))}
  finally{await b.close()}
  return [...new Map(out.map(x=>[x.url,x])).values()];
}
module.exports={discoverAll};
