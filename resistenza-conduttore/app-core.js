const STEPS=['Preparazione','Lunghezza','Sezione','Materiali','Elaborazione','Grafici','Deduzione','Modello','Conclusioni'];
let currentStep=0;
const state={validated:{length:false,area:false,material:false},deduced:{L:false,A:false,M:false},modelShown:false, results:{}};
const STORAGE_KEY='resistenzaConduttoreStudentiV1';

const specs={
  length:{mount:'table-length',check:'check-length', groups:[
    {id:'L2',label:'Costantana — L = 2,000 m',material:'Costantana',A:0.1,L:2,targets:[1,2,3,4]},
    {id:'L3',label:'Costantana — L = 3,000 m',material:'Costantana',A:0.1,L:3,targets:[1,2,3,4]}
  ]},
  area:{mount:'table-area',check:'check-area', groups:[
    {id:'A02',label:'Costantana — A = 0,2 mm²',material:'Costantana',A:0.2,L:1,targets:[1,2,3,4]},
    {id:'A04',label:'Costantana — A = 0,4 mm²',material:'Costantana',A:0.4,L:1,targets:[1,2,3,4]}
  ]},
  material:{mount:'table-material',check:'check-material', groups:[
    {id:'MC',label:'Costantana',material:'Costantana',A:0.2,L:1,targets:[1,2,3]},
    {id:'MN',label:'Nichel-cromo',material:'Nichel-cromo',A:0.2,L:1,targets:[1,2,3]},
    {id:'MO',label:'Ottone',material:'Ottone',A:0.2,L:1,targets:[1,2],allowSkipLast:true}
  ]}
};

function resetSession(){
  if(!confirm('Cancellare tutti i dati salvati su questo computer e iniziare con una scheda vuota?')) return;
  try{localStorage.removeItem(STORAGE_KEY)}catch(e){}
  location.reload();
}

function init(){
  document.getElementById('stepNav').innerHTML=STEPS.map((s,i)=>`<span class="step-pill ${i===0?'active':''}" id="pill-${i}">${i+1}. ${s}</span>`).join('');
  Object.keys(specs).forEach(renderDataset);
  loadLocal();
  refreshAllFieldStates();
  showStep(0);
}
function showStep(n){currentStep=n; document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',+p.dataset.step===n)); document.querySelectorAll('.step-pill').forEach((p,i)=>{p.classList.toggle('active',i===n);p.classList.toggle('done',i<n)}); window.scrollTo({top:0,behavior:'smooth'}); if(n===8) updateFinalKpi(); saveLocal();}
function goNext(){ if(currentStep===0 && !document.getElementById('ready').checked){alert('Conferma prima il controllo del circuito.');return;} showStep(Math.min(STEPS.length-1,currentStep+1)); }
function goPrev(){showStep(Math.max(0,currentStep-1));}

function renderDataset(key){
 const spec=specs[key]; let html='<table><thead><tr><th>Configurazione</th><th>ΔV impostata</th><th>ΔV misurata</th><th>ε(ΔV)</th><th>I misurata</th><th>ε(I)</th></tr></thead><tbody>';
 spec.groups.forEach((g,gi)=>g.targets.forEach((t,ri)=>{
   const id=`${g.id}_${t}`; html+=`<tr class="${ri===0&&gi>0?'group-start':''}"><td>${ri===0?`<b>${g.label}</b>`:''}</td><td>${t.toFixed(1).replace('.',',')} V</td>`+
   `<td>${measureInput(id,'v','V')}</td><td>${measureInput(id,'ev','V')}</td><td>${measureInput(id,'i','A')}</td><td>${measureInput(id,'ei','A')}</td></tr>`;
 })); html+='</tbody></table>'; document.getElementById(spec.mount).innerHTML=html;
 document.querySelectorAll(`#${spec.mount} input`).forEach(inp=>inp.addEventListener('input',()=>{state.validated[key]=false; validatePairFromInput(inp,true);saveLocal();}));
}
function measureInput(id,type,unit){return `<div class="inline"><input class="empty" id="${id}_${type}" inputmode="decimal" autocomplete="off" placeholder="${type[0]==='e'?'errore':'valore'}"><span class="unit">${unit}</span></div><div class="field-msg empty-msg" id="msg_${id}_${type}">Da compilare</div>`}

function parseNum(s){if(s==null)return NaN; return Number(String(s).trim().replace(/\s/g,'').replace(',','.'));}
function sigDigits(s){let x=String(s||'').trim().toLowerCase().replace(',','.').replace(/^[-+]/,''); if(!x)return 0; if(x.includes('e')) x=x.split('e')[0]; x=x.replace('.',''); const m=x.match(/[1-9]/); if(!m)return 0; return x.slice(m.index).replace(/\D/g,'').length;}
function decimalsText(s){let x=String(s||'').trim().replace(',','.'); if(/[eE]/.test(x)) return null; const p=x.indexOf('.'); return p<0?0:x.length-p-1;}
function uncertaintyDecimals(u){if(!(u>0))return null; const e=Math.floor(Math.log10(u)); return Math.max(0,-e);}

function setFieldState(el,stateName,msg=''){
  el.classList.remove('valid','invalid','empty','pending');
  el.classList.add(stateName);
  const m=document.getElementById('msg_'+el.id);
  if(!m)return;
  if(stateName==='valid'){
    m.textContent='True';
    m.className='field-msg good';
  }else if(stateName==='invalid'){
    m.textContent=msg || 'Dato non corretto.';
    m.className='field-msg bad';
  }else if(stateName==='pending'){
    m.textContent=msg || 'Completa la misura.';
    m.className='field-msg pending-msg';
  }else{
    m.textContent=msg || 'Da compilare';
    m.className='field-msg empty-msg';
  }
}

function validateMeasure(valueEl,errorEl,show=true){
  const vs=valueEl.value.trim();
  const es=errorEl.value.trim();

  if(!vs && !es){
    if(show){
      setFieldState(valueEl,'empty','Da compilare');
      setFieldState(errorEl,'empty','Da compilare');
    }
    return false;
  }

  if(!vs){
    if(show){
      setFieldState(valueEl,'empty','Da compilare');
      setFieldState(errorEl,'pending','Manca il valore della misura.');
    }
    return false;
  }
  if(!es){
    if(show){
      setFieldState(valueEl,'pending','Manca l’errore assoluto.');
      setFieldState(errorEl,'empty','Da compilare');
    }
    return false;
  }

  const v=parseNum(vs);
  const e=parseNum(es);

  if(!isFinite(v)){
    if(show){
      setFieldState(valueEl,'invalid','Il valore inserito non è un numero valido.');
      setFieldState(errorEl,'pending','Correggi prima il valore della misura.');
    }
    return false;
  }

  if(!isFinite(e)){
    if(show){
      setFieldState(valueEl,'pending','Correggi prima l’errore assoluto.');
      setFieldState(errorEl,'invalid','L’errore inserito non è un numero valido.');
    }
    return false;
  }

  if(e<=0){
    if(show){
      setFieldState(valueEl,'pending','Correggi prima l’errore assoluto.');
      setFieldState(errorEl,'invalid','L’errore assoluto deve essere maggiore di zero.');
    }
    return false;
  }

  if(sigDigits(es)!==1){
    if(show){
      setFieldState(valueEl,'pending','L’errore deve essere corretto prima di verificare la misura.');
      setFieldState(errorEl,'invalid','L’errore assoluto deve avere una sola cifra significativa.');
    }
    return false;
  }

  const de=uncertaintyDecimals(e);
  const dv=decimalsText(vs);

  if(dv===null){
    if(show){
      setFieldState(errorEl,'valid');
      setFieldState(valueEl,'invalid','Scrivi il valore in forma decimale, non in notazione scientifica.');
    }
    return false;
  }

  if(dv!==de){
    let posizione='';
    if(de===0) posizione='alle unità';
    else if(de===1) posizione='ai decimi';
    else if(de===2) posizione='ai centesimi';
    else if(de===3) posizione='ai millesimi';
    else posizione=`con ${de} cifre decimali`;
    if(show){
      setFieldState(errorEl,'valid');
      setFieldState(valueEl,'invalid',`Il valore deve essere scritto ${posizione}, come richiede l’errore ${es}.`);
    }
    return false;
  }

  if(show){
    setFieldState(valueEl,'valid');
    setFieldState(errorEl,'valid');
  }
  return true;
}

function validatePairFromInput(inp,show){const parts=inp.id.split('_');const type=parts.pop();const base=parts.join('_'); if(type==='v'||type==='ev')return validateMeasure(document.getElementById(base+'_v'),document.getElementById(base+'_ev'),show); if(type==='i'||type==='ei')return validateMeasure(document.getElementById(base+'_i'),document.getElementById(base+'_ei'),show);return true;}

function refreshAllFieldStates(){
  Object.keys(specs).forEach(key=>{
    specs[key].groups.forEach(g=>g.targets.forEach(t=>{
      if(key==='material'&&g.id==='MO'&&t===2&&document.getElementById('skip-brass-2')?.checked)return;
      const b=`${g.id}_${t}`;
      validateMeasure(document.getElementById(b+'_v'),document.getElementById(b+'_ev'),true);
      validateMeasure(document.getElementById(b+'_i'),document.getElementById(b+'_ei'),true);
    }));
  });
}

function rowData(g,t){const b=`${g.id}_${t}`;return {target:t,V:parseNum(document.getElementById(b+'_v').value),eV:parseNum(document.getElementById(b+'_ev').value),I:parseNum(document.getElementById(b+'_i').value),eI:parseNum(document.getElementById(b+'_ei').value),raw:{V:document.getElementById(b+'_v').value,eV:document.getElementById(b+'_ev').value,I:document.getElementById(b+'_i').value,eI:document.getElementById(b+'_ei').value}}}
function calcR(r){const R=r.V/r.I; const eR=R*(r.eV/r.V+r.eI/r.I); return {...r,R,eR};}

function roundedPair(value,err){
  if(!isFinite(value)) return {value,err,text:'—'};
  if(!(err>0) || !isFinite(err)) return {value,err,text:`${fmt(value)} ± ?`};

  let exponent=Math.floor(Math.log10(Math.abs(err)));
  let step=Math.pow(10,exponent);
  let er=Math.round(err/step)*step;

  exponent=Math.floor(Math.log10(Math.abs(er)));
  step=Math.pow(10,exponent);

  const val=Math.round(value/step)*step;
  const dec=Math.max(0,-exponent);
  return {value:val,err:er,dec,text:`${fmtFixed(val,dec)} ± ${fmtFixed(er,dec)}`};
}

function fmt(x,d=3){if(!isFinite(x))return '—';return Number(x).toLocaleString('it-IT',{maximumFractionDigits:d})}
function fmtFixed(x,d){return Number(x).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d})}
function groupResult(g){const rows=g.targets.map(t=>calcR(rowData(g,t))).filter(r=>isFinite(r.R)&&r.R>0); if(!rows.length)return null; const mean=rows.reduce((a,b)=>a+b.R,0)/rows.length; const meanErr=rows.reduce((a,b)=>a+b.eR,0)/rows.length; const rp=roundedPair(mean,meanErr); return {rows,mean,meanErr,rounded:rp};}

function validateDataset(key,report){
 let errors=[],warnings=[]; const spec=specs[key]; let allValid=true;
 spec.groups.forEach(g=>{
   let currents=[]; let rvals=[];
   g.targets.forEach((t,idx)=>{
     if(key==='material'&&g.id==='MO'&&t===2&&document.getElementById('skip-brass-2').checked)return;
     const b=`${g.id}_${t}`;
     const vok=validateMeasure(document.getElementById(b+'_v'),document.getElementById(b+'_ev'),true);
     const iok=validateMeasure(document.getElementById(b+'_i'),document.getElementById(b+'_ei'),true);
     if(!vok||!iok){allValid=false;errors.push(`${g.label}, ${t} V: completa o correggi le caselle evidenziate.`);return}
     const r=rowData(g,t);
     if(r.V<=0||r.I<=0){
       allValid=false;
       errors.push(`${g.label}, ${t} V: V e I devono essere positive.`);
       if(r.V<=0){setFieldState(document.getElementById(b+'_v'),'invalid','La tensione misurata deve essere maggiore di zero.');}
       if(r.I<=0){setFieldState(document.getElementById(b+'_i'),'invalid','La corrente misurata deve essere maggiore di zero.');}
       return;
     }
     if(Math.abs(r.V-t)>Math.max(.35,3*r.eV)) warnings.push(`${g.label}: la tensione misurata ${fmt(r.V)} V è lontana dal valore impostato ${fmt(t,1)} V.`);
     currents.push({t,I:r.I,eI:r.eI}); rvals.push(calcR(r));
   });
   for(let i=1;i<currents.length;i++){if(currents[i].I+currents[i].eI < currents[i-1].I-currents[i-1].eI)warnings.push(`${g.label}: la corrente non cresce con la tensione; ricontrolla le letture.`)}
   if(rvals.length>=2){const mean=rvals.reduce((s,r)=>s+r.R,0)/rvals.length; const suspicious=rvals.some(r=>Math.abs(r.R-mean)>2*(r.eR + (rvals.reduce((s,x)=>s+x.eR,0)/rvals.length))); if(suspicious)warnings.push(`${g.label}: i valori di R non risultano ben compatibili entro le incertezze. Controlla trascrizione, contatti o possibile riscaldamento.`)}
 });
 state.validated[key]=allValid;
 const box=document.getElementById(spec.check);
 if(report){box.innerHTML=renderIssues(errors,warnings,allValid)}
 saveLocal();
 return allValid;
}
function renderIssues(errors,warnings,ok){let h=''; if(errors.length)h+=`<div class="error-box"><b>Correggi prima di proseguire:</b><ul class="status-list">${errors.map(x=>`<li>${x}</li>`).join('')}</ul></div>`; if(warnings.length)h+=`<div class="warning"><b>Incongruenze sperimentali da verificare:</b><ul class="status-list">${warnings.map(x=>`<li>${x}</li>`).join('')}</ul></div>`; if(ok&&!warnings.length)h+='<div class="success"><b>True.</b> I dati sono formalmente coerenti. Puoi proseguire.</div>'; else if(ok)h+='<div class="success"><b>True per il formato dei dati.</b> Valuta però gli avvisi sperimentali prima di procedere.</div>';return h;}
function nextIfDataset(key){if(validateDataset(key,true))goNext();}
function finishAcquisition(){if(validateDataset('material',true)){computeResults();goNext();}}

function computeResults(){
 state.results.length={fixed:{x:1,mean:6,e:0.2,label:'1,000 m'},groups:specs.length.groups.map(g=>({g,res:groupResult(g)}))};
 state.results.area={fixed:{x:.1,mean:6,e:.2,label:'0,1 mm²'},groups:specs.area.groups.map(g=>({g,res:groupResult(g)}))};
 state.results.material={groups:specs.material.groups.map(g=>({g,res:groupResultSpecial(g)}))}; renderSummaries();
}
function groupResultSpecial(g){const rows=[];g.targets.forEach(t=>{if(g.id==='MO'&&t===2&&document.getElementById('skip-brass-2').checked)return; const rd=rowData(g,t); if(isFinite(rd.V)&&rd.V>0&&isFinite(rd.I)&&rd.I>0)rows.push(calcR(rd));}); if(!rows.length)return null; const mean=rows.reduce((s,r)=>s+r.R,0)/rows.length, meanErr=rows.reduce((s,r)=>s+r.eR,0)/rows.length;return {rows,mean,meanErr,rounded:roundedPair(mean,meanErr)};}
function summaryTable(kind){
 let rows=[]; if(kind==='length'){rows.push({name:'L = 1,000 m',fixed:true,mean:6,e:.2}); state.results.length.groups.forEach(x=>rows.push({name:`L = ${fmtFixed(x.g.L,3)} m`,...x.res}));}
 if(kind==='area'){rows.push({name:'A = 0,1 mm²',fixed:true,mean:6,e:.2}); state.results.area.groups.forEach(x=>rows.push({name:`A = ${fmt(x.g.A,1)} mm²`,...x.res}));}
 if(kind==='material'){state.results.material.groups.forEach(x=>rows.push({name:x.g.material,...x.res}));}
 let h='<table><thead><tr><th>Configurazione</th><th>Valori di R (Ω)</th><th>Rmedio ± ε (Ω)</th><th>Controllo</th></tr></thead><tbody>';
 rows.forEach(r=>{if(r.fixed){h+=`<tr class="fixed"><td>${r.name}</td><td>dato precedente</td><td>${fmtFixed(r.mean,1)} ± ${fmtFixed(r.e,1)}</td><td><span class="badge good">riutilizzato</span></td></tr>`;return;} if(!r.rows){h+=`<tr><td>${r.name}</td><td colspan="3">dati insufficienti</td></tr>`;return;} const rr=r.rows.map(x=>roundedPair(x.R,x.eR).text).join('<br>'); const spread=Math.max(...r.rows.map(x=>x.R))-Math.min(...r.rows.map(x=>x.R)); const compat=spread <= 2*r.rows.reduce((s,x)=>s+x.eR,0)/r.rows.length; h+=`<tr><td>${r.name}</td><td>${rr}</td><td><b>${r.rounded.text}</b></td><td><span class="badge ${compat?'good':'warn'}">${compat?'coerenti':'da verificare'}</span></td></tr>`;}); return h+'</tbody></table>';
}