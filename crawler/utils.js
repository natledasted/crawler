const fs=require("fs");
function ensureDir(p){fs.mkdirSync(p,{recursive:true})}
function slugify(s){return String(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||"unknown-game"}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function hostOf(u){try{return new URL(u).hostname}catch{return null}}
function sameSite(h){return !!h&&(h==="eaglercraftgame.io"||h.endsWith(".eaglercraftgame.io"))}
function writeJson(p,x){fs.writeFileSync(p,JSON.stringify(x,null,2))}
module.exports={ensureDir,slugify,sleep,hostOf,sameSite,writeJson};
