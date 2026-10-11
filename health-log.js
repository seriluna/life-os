(() => {
"use strict";
const KEY="lifeos.health.logs.v1", GOAL_KEY="lifeos.health.goals.v1", $=id=>document.getElementById(id);
const meals=[{id:"breakfast",name:"아침",icon:"🍳"},{id:"lunch",name:"점심",icon:"🥗"},{id:"dinner",name:"저녁",icon:"🌙"},{id:"snack",name:"간식",icon:"🍎"}];
let logs={};try{logs=JSON.parse(localStorage.getItem(KEY)||"{}");if(!logs||typeof logs!=="object"||Array.isArray(logs))logs={}}catch{logs={}}
let goals={targetWeightKg:46,startWeightKg:52,deadline:"2026-10-30",dailyTargets:{carbsG:100,proteinG:100,fatG:40,caloriesKcal:1300},routineTargets:{absMinutes:20,strengthMinutes:30,yogaMinutes:10,hipReps:150,weekendCardioMinutes:60}};try{goals={...goals,...JSON.parse(localStorage.getItem(GOAL_KEY)||"{}")}}catch{}
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=(v)=>v===""||v==null?"":Number(v);
function mealMarkup(m){return '<div class="health-meal" data-meal="'+m.id+'"><h4>'+m.icon+" "+m.name+'</h4><label for="hl-'+m.id+'-food">먹은 음식과 양</label><textarea id="hl-'+m.id+'-food" rows="2" placeholder="예: 계란 2개, 우유 200ml"></textarea><div class="health-macros">'+[["kcal","칼로리 (kcal)"],["carbs","탄수화물 (g)"],["protein","단백질 (g)"],["fat","지방 (g)"]].map(([k,label])=>'<div><label for="hl-'+m.id+'-'+k+'">'+label+'</label><input type="number" min="0" step="0.1" id="hl-'+m.id+'-'+k+'" placeholder="선택"></div>').join("")+'</div></div>'}
$("healthMeals").innerHTML=meals.map(mealMarkup).join("");
function readForm(){const r={date:$("healthDate").value,weight:num($("fastingWeight").value),note:$("healthNote").value.trim(),meals:{},activities:{},foodFlags:{}};meals.forEach(m=>{const get=k=>$("hl-"+m.id+"-"+k).value.trim();r.meals[m.id]={food:get("food"),kcal:num(get("kcal")),carbs:num(get("carbs")),protein:num(get("protein")),fat:num(get("fat"))}});["sleepHours","absMinutes","strengthMinutes","yogaMinutes","hipReps","cardioMinutes","steps"].forEach(k=>{const e=$("hl-act-"+k);r.activities[k]=e?num(e.value):""});[["unprocessed","unprocessed"],["noFlour","noFlour"],["noSweets","noSweets"],["noFried","noFried"]].forEach(([id,key])=>{const e=$("hl-flag-"+id);r.foodFlags[key]=e?e.value:""});r.goals={targetWeightKg:num($("hl-goal-weight").value),dailyTargets:{carbsG:num($("hl-goal-carbs").value),proteinG:num($("hl-goal-protein").value),fatG:num($("hl-goal-fat").value),caloriesKcal:num($("hl-goal-calories").value)}};return r}
function fill(date){const r=logs[date]||{weight:"",note:"",meals:{}};$("healthDate").value=date;$("fastingWeight").value=r.weight??"";$("healthNote").value=r.note||"";meals.forEach(m=>{const v=r.meals?.[m.id]||{};$("hl-"+m.id+"-food").value=v.food||"";["kcal","carbs","protein","fat"].forEach(k=>$("hl-"+m.id+"-"+k).value=v[k]??"")});const a=r.activities||{},f=r.foodFlags||{},g=r.goals||goals,t=g.dailyTargets||goals.dailyTargets||{};["sleepHours","absMinutes","strengthMinutes","yogaMinutes","hipReps","cardioMinutes","steps"].forEach(k=>{const e=$("hl-act-"+k);if(e)e.value=a[k]??""});[["unprocessed","unprocessed"],["noFlour","noFlour"],["noSweets","noSweets"],["noFried","noFried"]].forEach(([id,key])=>{const e=$("hl-flag-"+id);if(e)e.value=f[key]??""});$("hl-goal-weight").value=g.targetWeightKg??goals.targetWeightKg;$("hl-goal-calories").value=t.caloriesKcal??"";$("hl-goal-carbs").value=t.carbsG??"";$("hl-goal-protein").value=t.proteinG??"";$("hl-goal-fat").value=t.fatG??"";totals()}
function totals(){let kcal=0,carbs=0,protein=0,fat=0;meals.forEach(m=>{["kcal","carbs","protein","fat"].forEach(k=>{const v=Number($("hl-"+m.id+"-"+k).value)||0;if(k==="kcal")kcal+=v;else if(k==="carbs")carbs+=v;else if(k==="protein")protein+=v;else fat+=v})});$("healthTotalKcal").textContent=kcal+" kcal";$("healthTotalMacros").textContent="탄수화물 "+carbs.toFixed(1).replace(/\.0$/,"")+"g · 단백질 "+protein.toFixed(1).replace(/\.0$/,"")+"g · 지방 "+fat.toFixed(1).replace(/\.0$/,"")+"g"}
function save(){const r=readForm();if(!r.date)return alert("기록 날짜를 선택해 줘.");const anyFood=Object.values(r.meals).some(m=>m.food||m.kcal!==""||m.carbs!==""||m.protein!==""||m.fat!=="");if(r.weight===""&&!r.note&&!anyFood)return alert("공복 몸무게, 식단, 메모 중 하나 이상 입력해 줘.");logs[r.date]={...(logs[r.date]||{}),...r};if(r.goals)goals={...goals,...r.goals,dailyTargets:{...goals.dailyTargets,...r.goals.dailyTargets}};localStorage.setItem(KEY,JSON.stringify(logs));localStorage.setItem(GOAL_KEY,JSON.stringify(goals));renderHistory();if(window.toast)window.toast("식단과 공복 몸무게 기록을 저장했어.");else alert("기록을 저장했어.");}
function renderHistory(){const dates=Object.keys(logs).sort((a,b)=>b.localeCompare(a));$("healthHistory").innerHTML=dates.length?dates.map(d=>{const r=logs[d],food=meals.map(m=>({name:m.name,...(r.meals?.[m.id]||{})})).filter(m=>m.food);const kcal=r.dailyTotals?.kcal??meals.reduce((s,m)=>s+(Number(r.meals?.[m.id]?.kcal)||0),0);const macro=key=>r.dailyTotals?.[key]??meals.reduce((s,m)=>s+(Number(r.meals?.[m.id]?.[key])||0),0);const a=r.activities||{};return '<div class="health-record"><div class="health-record-main"><strong>'+esc(d)+' · '+(r.weight!==""&&r.weight!=null?"공복 "+esc(r.weight)+" kg":"몸무게 미입력")+'</strong><p>'+(food.length?food.map(m=>'<b>'+m.name+'</b> '+esc(m.food)).join(" / "):"식단 미입력")+'</p><p>'+kcal+' kcal · 탄수화물 '+macro("carbs")+'g · 단백질 '+macro("protein")+'g · 지방 '+macro("fat")+'g</p>'+(r.note?'<p>메모: '+esc(r.note)+'</p>':"")+'</div><div class="health-record-actions"><button class="btn secondary" type="button" data-health-edit="'+esc(d)+'">수정</button><button class="btn secondary" type="button" data-health-delete="'+esc(d)+'">삭제</button></div></div>'}).join(""):'<div class="health-empty">아직 식단 기록이 없어. 위에서 첫 기록을 추가해 봐.</div>'}
function exportCsv(){const headers=["날짜","공복 몸무게(kg)","하루 탄수화물(g)","하루 단백질(g)","하루 지방(g)","하루 칼로리(kcal)","수면(시간)","복근(분)","근력(분)","요가(분)","힙(회)","유산소(분)","걸음 수","가공식품 금지 준수","가루/밀가루 금지 준수","단것 금지 준수","튀김 금지 준수","메모"];meals.forEach(m=>headers.push(m.name+" 음식",m.name+" 칼로리(kcal)",m.name+" 탄수화물(g)",m.name+" 단백질(g)",m.name+" 지방(g)"));headers.push("메모");const rows=[headers];Object.keys(logs).sort().forEach(d=>{const r=logs[d],t=r.dailyTotals||{},a=r.activities||{},f=r.foodFlags||{};const row=[d,r.weight??"",t.carbs??"",t.protein??"",t.fat??"",t.kcal??"",a.sleepHours??"",a.absMinutes??"",a.strengthMinutes??"",a.yogaMinutes??"",a.hipReps??"",a.cardioMinutes??"",a.steps??"",f.unprocessed??"",f.noFlour??"",f.noSweets??"",f.noFried??"",r.note||""];meals.forEach(m=>{const v=r.meals?.[m.id]||{};row.push(v.food||"",v.kcal??"",v.carbs??"",v.protein??"",v.fat??"")});row.push(r.note||"");rows.push(row)});const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="life-os-식단-공복몸무게-"+today()+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("healthDate").value=today();fill(today());renderHistory();
$("healthDate").addEventListener("change",e=>fill(e.target.value||today()));
$("healthMeals").addEventListener("input",totals);
$("saveHealthLog").addEventListener("click",save);
$("clearHealthForm").addEventListener("click",()=>{if(confirm("현재 입력 내용을 비울까? 저장된 기록은 삭제되지 않아."))fill($("healthDate").value||today())});
$("exportHealthCsv").addEventListener("click",exportCsv);
const importInput=$("importHealthJson"), applyImport=$("applyHealthImport"), importStatus=$("healthImportStatus");
if(importInput&&applyImport){
 const setImportStatus=(message)=>{if(importStatus)importStatus.textContent=message;};
 importInput.addEventListener("change",()=>{
  const f=importInput.files&&importInput.files[0];
  setImportStatus(f?"파일 선택됨: "+f.name+" ("+Math.ceil(f.size/1024)+" KB). 이제 아래 반영 버튼을 눌러 줘.":"파일이 선택되지 않았어.");
 });
 applyImport.addEventListener("click",async()=>{
  const file=importInput.files&&importInput.files[0];
  if(!file){setImportStatus("먼저 JSON 파일을 선택해 줘.");alert("먼저 JSON 파일을 선택해 줘.");return;}
  applyImport.disabled=true;applyImport.textContent="파일 읽는 중…";setImportStatus("파일 읽는 중…");
  try{
   const textContent=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("파일 읽기 실패"));
    reader.readAsText(file,"UTF-8");
   });
   setImportStatus("JSON 확인 중…");
   const data=JSON.parse(textContent);
   const source=data&& (data.logs||data.healthLogs);
   if(!source||typeof source!=="object"||Array.isArray(source))throw new Error("파일 안에서 날짜별 logs 데이터를 찾지 못했어.");
   const dates=Object.keys(source).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&source[d]&&typeof source[d]==="object").sort();
   if(!dates.length)throw new Error("날짜 형식의 기록이 없어. 개인 기록 JSON 파일인지 확인해 줘.");
   setImportStatus(dates.length+"일 기록 확인. 브라우저에 저장하는 중…");
   const nextLogs={...logs};
   for(const date of dates){
    const item=source[date];let mealData=item.meals;
    if(!mealData){
     mealData={};
     for(const key of ["breakfast","lunch","dinner","snack"]){
      const raw=item[key];
      if(typeof raw==="string")mealData[key]={food:raw,kcal:"",carbs:"",protein:"",fat:""};
      else if(raw&&typeof raw==="object")mealData[key]={food:raw.food||raw.text||"",kcal:raw.kcal??raw.calories??"",carbs:raw.carbs??"",protein:raw.protein??"",fat:raw.fat??""};
     }
    }
    const ff=item.foodFlags||{};
    nextLogs[date]={...item,date,weight:item.weight??item.fastingWeight??"",note:item.note||"",meals:mealData,foodFlags:{...ff,unprocessed:ff.unprocessed??ff.processed??"",noFlour:ff.noFlour??ff.powder??"",noSweets:ff.noSweets??ff.sweets??"",noFried:ff.noFried??ff.fried??""}};
   }
   const mergedGoals=data.goals&&typeof data.goals==="object"?{...goals,...data.goals}:goals;
   localStorage.setItem(KEY,JSON.stringify(nextLogs));
   localStorage.setItem(GOAL_KEY,JSON.stringify(mergedGoals));
   logs=nextLogs;goals=mergedGoals;
   fill($("healthDate").value||today());renderHistory();
   setImportStatus("반영 완료: "+dates.length+"일 ("+dates[0]+" ~ "+dates[dates.length-1]+") · 목표 설정 포함");
   alert("가져오기 완료! "+dates.length+"일의 기록("+dates[0]+"~"+dates[dates.length-1]+")과 목표 설정을 저장했어. 매일 다시 업로드할 필요 없어. 이 브라우저에만 저장돼.");
  }catch(error){
   const message=error&&error.message?error.message:"알 수 없는 오류";
   setImportStatus("반영 실패: "+message);
   alert("기록 반영 실패: "+message);
  }finally{applyImport.disabled=false;applyImport.textContent="선택한 파일 기록 반영하기";}
 });
}

$("healthHistory").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.healthEdit){fill(b.dataset.healthEdit);$("healthLogCard").scrollIntoView({behavior:"smooth",block:"start"})}if(b.dataset.healthDelete&&confirm(b.dataset.healthDelete+" 기록을 삭제할까?")){delete logs[b.dataset.healthDelete];localStorage.setItem(KEY,JSON.stringify(logs));renderHistory();if($("healthDate").value===b.dataset.healthDelete)fill(b.dataset.healthDate||today())}});
})();