const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let timer, answer;
const c={setTimeout:fn=>(timer=fn,1),clearTimeout(){},CONFIG:{inputApps:[]}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('app/cec-input.js','utf8'),c);
const shortcut={id:'shortcut.nintendo-switch2',title:'Nintendo Switch 2',launchAppId:'com.webos.app.hdmi4',cec:{physicalAddress:17152,vendorId:2495}};
const device={id:'SIMPLINK',physicalAddress:17152,vendorId:2495,uniqueId:4};
const response=(dev=device)=>({returnValue:true,devices:[{appId:'com.webos.app.hdmi4',subList:[{...device,physicalAddress:16384,vendorId:41182,uniqueId:5},dev]}]});
function run(data){answer=null;c.CECInput.resolve(shortcut,(_,__,callback)=>callback(data),(error,params)=>answer={error,params});return answer;}
assert.equal(run(response()).params.value,'4');
assert.equal(run(response({...device,uniqueId:8})).params.value,'8','resolve changed logical ID from current physical path');
assert(run(response({...device,physicalAddress:17408})).error,'never select a console on the wrong receiver input');
assert(run(response({...device,vendorId:123})).error,'never select another brand at the same path');
assert(run({returnValue:false}).error);assert(run({devices:[]}).error);
const wrongPort=response();wrongPort.devices[0].appId='com.webos.app.hdmi3';assert(run(wrongPort).error);
const duplicate=response();duplicate.devices[0].subList.push(device);assert(run(duplicate).error);
let callback,count=0;c.CECInput.resolve(shortcut,(_,__,cb)=>callback=cb,()=>count++);timer();callback(response());assert.equal(count,1,'late lookup must not launch after timeout');
// Exercise the actual launcher routing so a shortcut never reaches applicationManager as an app id.
const source=fs.readFileSync('app/app.js','utf8'),calls=[],errors=[];c.CONFIG.inputApps=[shortcut];c.stopStartupSound=()=>{};c.toast=message=>errors.push(message);
c.luna=(uri,payload,cb)=>{calls.push({uri,payload});cb(uri.includes('getAllInputStatus')?response({...device,uniqueId:8}):{returnValue:true});};
vm.runInContext(source.slice(source.indexOf('  var cecLaunchPending ='),source.indexOf('  var toastTimer;')),c);
c.launch(shortcut.id,shortcut.title);assert.equal(calls.length,2);assert.equal(calls[1].payload.id,'com.webos.app.hdmi4');assert.equal(calls[1].payload.params.value,'8');
calls.length=0;c.launch('com.webos.app.hdmi4','XBOX');assert.equal(calls.length,1);assert.equal(calls[0].payload.id,'com.webos.app.hdmi4');
c.luna=(_,__,cb)=>cb({returnValue:false});c.launch(shortcut.id,shortcut.title);assert.equal(errors.length,1);
console.log('PASS: current CEC routing, receiver/port/vendor matching, missing and ambiguous consoles, timeout, native launch parameters and ordinary HDMI shortcuts');
