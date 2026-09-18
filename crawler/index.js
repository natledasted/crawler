const path=require("path");
const {discoverAll}=require("./discover");
const {scanGame}=require("./crawl-game");
const {ensureDir,writeJson}=require("./utils");

function arg(n,f){const i=process.argv.indexOf("--"+n);return i>=0&&process.argv[i+1]?process.argv[i+1]:f}
(async()=>{
 const category=arg("category",process.env.CRAWL_CATEGORY||"all");
 const max=Number(arg("max",process.env.CRAWL_MAX_GAMES||"0"));
 const click=String(arg("click-play",process.env.CRAWL_CLICK_PLAY||"true")).toLowerCase()!=="false";
 const root=path.resolve("results");ensureDir(root);
 let games=await discoverAll(category);if(max>0)games=games.slice(0,max);
 writeJson(path.join(root,"discovered.json"),games);
 const results=[];for(let i=0;i<games.length;i++){console.log(`[${i+1}/${games.length}] ${games[i].name}`);results.push(await scanGame(games[i],root,click))}
 writeJson(path.join(root,"master.json"),{generated_at:new Date().toISOString(),source:"https://eaglercraftgame.io/",category,count:results.length,games:results});
})().catch(e=>{console.error(e);process.exit(1)});
