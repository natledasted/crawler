const fs=require("fs"),path=require("path");
function walk(d){if(!fs.existsSync(d))return[];return fs.readdirSync(d).flatMap(n=>{const p=path.join(d,n),s=fs.statSync(p);return s.isDirectory()?walk(p):n==="analysis.json"?[p]:[]})}
const rows=walk("results").map(f=>{try{const x=JSON.parse(fs.readFileSync(f));return {category:x.game?.category||"",name:x.game?.name||"",slug:x.game?.slug||"",page_url:x.page_url||"",embed_url:x.embed?.url||"",game_type:x.embed?.game_type||"",declared_game_url:x.embed?.url_game||"",frames:(x.frames||[]).join(" | "),game_hosts:(x.game_hosts||[]).map(h=>h.host).join(" | "),status:x.status||""}}catch{return null}}).filter(Boolean);
const keys=["category","name","slug","page_url","embed_url","game_type","declared_game_url","frames","game_hosts","status"];
const csv=[keys.join(","),...rows.map(r=>keys.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");
fs.writeFileSync("results/master.csv",csv);console.log(`Wrote ${rows.length} rows.`);
