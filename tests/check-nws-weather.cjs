const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('app/weather.js','utf8');
const live={properties:{timestamp:'2025-01-01T12:00:00Z',temperature:{unitCode:'wmoUnit:degC',value:20},textDescription:'Clear',icon:'https://api.weather.gov/icons/land/day/skc'}};
const instant=Date.parse(live.properties.timestamp)+10*60000;
function harness(cache=null){
 let now=instant, requests=[], events={}, elements={}, tick;
 function node(id){return elements[id]||=( {style:{},textContent:'',innerHTML:'',classes:new Set(),classList:{remove(c){elements[id].classes.delete(c);},toggle(c,v){v?elements[id].classes.add(c):elements[id].classes.delete(c);}}});}
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 function XHR(){requests.push(this);this.open=(_,u)=>this.url=u;this.setRequestHeader=()=>{};this.send=()=>{};}
 const doc={hidden:false,getElementById:node,addEventListener:(k,f)=>events[k]=f};
 const ctx={CONFIG:{weather:{station:'KSEA'}},document:doc,window:{addEventListener:(k,f)=>events[k]=f},Date:Clock,Math,JSON,isFinite,encodeURIComponent,XMLHttpRequest:XHR,setInterval:f=>tick=f,localStorage:{getItem:k=>{assert(k.includes('.nws.KSEA.'));return JSON.stringify(cache);},setItem:()=>{}}};
 vm.runInNewContext(source,ctx);
 return {requests,elements,events,doc,tick(ms){now+=ms;tick();},reply(j,status=200){const r=requests.at(-1);r.status=status;r.responseText=JSON.stringify(j);r.onload();}};
}
let h=harness();assert(h.requests[0].url.endsWith('KSEA/observations/latest?require_qc=true'));h.reply(live);assert.equal(h.elements.weatherTemperature.textContent,'68°F');assert.equal(h.elements.weatherCondition.textContent,'Sunny');assert(h.elements.weatherIcon.innerHTML.includes('#ffd474'));h.events.webOSRelaunch();assert.equal(h.requests.length,1);h.tick(15*60000);assert.equal(h.requests.length,2);
for(const [code,day,label] of [['skc','night','Clear'],['sct','day','Partly cloudy'],['rain','day','Rain'],['snow','day','Snow'],['tsra','night','Thunderstorms'],['rain_fzra','day','Freezing rain'],['wind_bkn','day','Windy']]){
 h=harness();h.reply({...live,properties:{...live.properties,icon:'https://api.weather.gov/icons/land/'+day+'/'+code}});assert.equal(h.elements.weatherCondition.textContent,label);assert(h.elements.weatherIcon.innerHTML.startsWith('<svg'));
}
h=harness();h.reply({...live,properties:{...live.properties,temperature:{unitCode:'wmoUnit:degF',value:71}}});assert.equal(h.elements.weatherTemperature.textContent,'71°F');
h=harness();h.reply({...live,properties:{...live.properties,temperature:{unitCode:'wmoUnit:degC',value:0}}});assert.equal(h.elements.weatherTemperature.textContent,'32°F');
const missing={...live,properties:{...live.properties,temperature:{unitCode:'wmoUnit:degC',value:null}}};
h=harness();h.reply(missing);assert.equal(h.requests.length,2);assert(h.requests[1].url.endsWith('observations?limit=5'));h.reply({features:[missing,live]});assert.equal(h.elements.weatherTemperature.textContent,'68°F');
h=harness();h.reply(missing);h.reply({features:[missing]});assert.equal(h.elements.weatherTemperature.textContent,'');assert.equal(h.elements.weatherCondition.textContent,'Weather unavailable');
h=harness({temperature:61,description:'Cloudy',symbol:'cloud',time:instant-76*60000});assert(h.elements.weatherUpdated.textContent.includes('Updated'));h.requests[0].ontimeout();h.requests[1].ontimeout();assert.equal(h.elements.weatherTemperature.textContent,'61°F');h.tick(15*60000);assert.equal(h.elements.weatherTemperature.textContent,'');assert.equal(h.elements.weatherCondition.textContent,'Weather unavailable');
h=harness();h.reply(live);h.doc.hidden=true;h.tick(15*60000);assert.equal(h.requests.length,1);h.doc.hidden=false;h.events.visibilitychange();assert.equal(h.requests.length,2);
console.log('PASS: NWS live readings, C/F conversion, zero/missing temperature, night and weather icons, recent-report fallback, cache freshness, refresh and resume');
