
const {useState,useEffect,useRef,useMemo} = React;

/* ---------- helpers ---------- */
const WAN = 10000;
const fmtWan = v => v==null ? '-' : (v/WAN).toLocaleString('zh-TW',{maximumFractionDigits:0}) + ' 萬';
const fmtWan1 = v => v==null ? '-' : (v/WAN).toLocaleString('zh-TW',{maximumFractionDigits:1}) + ' 萬';
const fmtPct = v => v==null ? '-' : (v*100).toFixed(1) + '%';
const fmtNum = v => v==null ? '-' : Math.round(v).toLocaleString('zh-TW');
const ymLabel = r => r.year + '/' + String(r.month).padStart(2,'0');
const COLORS = ['#4f8cff','#2ecc8f','#a78bfa','#f0b90b','#ff5d6c','#22d3ee','#fb923c','#e879f9','#84cc16','#94a3b8'];
const CAT_COLOR = {Stock:'#4f8cff', ETF:'#2ecc8f', Bond:'#a78bfa', Cash:'#f0b90b'};
const CAT_NAME = {Stock:'個股', ETF:'ETF', Bond:'債券', Cash:'現金'};

/* ---------- Chart.js wrapper ---------- */
Chart.defaults.color = '#8b98ad';
Chart.defaults.borderColor = 'rgba(36,48,73,.6)';
Chart.defaults.font.family = '"Segoe UI","Microsoft JhengHei",sans-serif';
const pctPlugin={ id:'pctlabel', afterDatasetsDraw(chart){
  const ds=chart.data.datasets[0]; if(!ds) return;
  const total=ds.data.reduce((a,b)=>a+(+b||0),0); if(!total) return;
  const meta=chart.getDatasetMeta(0); const ctx=chart.ctx;
  meta.data.forEach((arc,i)=>{ const v=+ds.data[i]||0; const pct=v/total*100; if(pct<4) return;
    const p=arc.tooltipPosition(); ctx.save();
    ctx.font='bold 12px "Microsoft JhengHei",sans-serif'; ctx.fillStyle='#fff';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.65)'; ctx.shadowBlur=3;
    ctx.fillText(Math.round(pct)+'%', p.x, p.y); ctx.restore(); });
}};
function ChartBox({type,data,options,height=260}){
  const ref = useRef(null);
  useEffect(()=>{
    const cfg={type,data,options};
    if(type==='doughnut'||type==='pie') cfg.plugins=[pctPlugin];
    const chart = new Chart(ref.current,cfg);
    return ()=>chart.destroy();
  },[JSON.stringify(data),JSON.stringify(options)]);
  return <div style={{height}}><canvas ref={ref}></canvas></div>;
}
const tipWan = {callbacks:{label:c=>` ${c.dataset.label}: ${(c.parsed.y/WAN).toLocaleString('zh-TW',{maximumFractionDigits:0})} 萬`}};
const axisWan = {ticks:{callback:v=>(v/WAN/1000)>=1 ? (v/WAN/1000)+'千萬' : (v/WAN)+'萬'}};

/* ---------- 穩定輸入元件（定義在頂層，避免重繪失焦） ---------- */
function NumIn({v,on,step=1,w}){
  const [t,setT]=useState((v===0||v==null)?'':String(v));
  useEffect(()=>{ if((parseFloat(t)||0)!==(Number(v)||0)) setT((v===0||v==null)?'':String(v)); },[v]);
  return <input type="number" step={step} style={w?{width:w}:null} value={t} placeholder="0"
    onChange={e=>{const raw=e.target.value; setT(raw); const x=parseFloat(raw); on(isNaN(x)?0:x);}}/>;
}
/* 元輸入：畫面顯示/輸入「元」，內部仍以「萬」儲存（wan = 元/10000） */
function YuanIn({wan,on,step=10000,w}){
  const cur = (wan==null)?0:Math.round(Number(wan)*10000);
  const [t,setT]=useState(cur===0?'':String(cur));
  useEffect(()=>{ if((parseFloat(t)||0)!==cur) setT(cur===0?'':String(cur)); },[cur]);
  return <input type="number" step={step} style={w?{width:w}:null} value={t} placeholder="0"
    onChange={e=>{const raw=e.target.value; setT(raw); const x=parseFloat(raw); on(isNaN(x)?0:x/10000);}}/>;
}
const fmtWanHint = wan => { const w=Number(wan)||0; if(!w) return ''; return '＝ '+Math.round(w).toLocaleString()+' 萬'+(w>=10000?'（'+(w/10000).toFixed(w%10000?2:0)+' 億）':''); };
function FireIn({p,set,k,lab,step=1,pct}){
  const cur = pct? Math.round((Number(p[k])||0)*1000)/10 : (Number(p[k])||0);
  const [t,setT]=useState(cur===0?'':String(cur));
  useEffect(()=>{ if((parseFloat(t)||0)!==cur) setT(cur===0?'':String(cur)); },[cur]);
  return <div className="field"><label>{lab}</label>
    <input type="number" step={step} value={t}
      onChange={e=>{const raw=e.target.value; setT(raw); if(raw===''||raw==='-'){set(k,0);return;} const x=parseFloat(raw); if(!isNaN(x)) set(k, pct? x/100 : x);}}/>
  </div>;
}
function CurveIn({p,setP,k,lab,step=1}){
  const cur=Number(p[k])||0;
  const [t,setT]=useState(cur===0?'':String(cur));
  useEffect(()=>{ if((parseFloat(t)||0)!==cur) setT(cur===0?'':String(cur)); },[cur]);
  return <div className="field"><label>{lab}</label>
    <input type="number" step={step} value={t}
      onChange={e=>{const raw=e.target.value; setT(raw); const x=parseFloat(raw); setP(o=>({...o,[k]:isNaN(x)?0:x}));}}/>
  </div>;
}

/* ---------- Supabase (optional) ---------- */
const CFG_KEY = 'inv_supabase_cfg';
function loadCfg(){ try{return JSON.parse(localStorage.getItem(CFG_KEY))||{};}catch(e){return {};} }
/* Supabase REST 小工具（anon key，RLS 已關） */
async function supaReq(path, opts={}){
  const cfg=loadCfg(); if(!cfg.url||!cfg.key) throw new Error('未設定 Supabase');
  const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/'+path,{...opts,
    headers:{apikey:cfg.key, Authorization:'Bearer '+cfg.key, 'Content-Type':'application/json', ...(opts.headers||{})}});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,120));
  const t=await r.text(); return t? JSON.parse(t) : [];
}
const supaSelect=(table,q='')=>supaReq(table+(q?'?'+q:''));
const supaUpsert=(table,row)=>supaReq(table,{method:'POST',
  headers:{Prefer:'resolution=merge-duplicates,return=representation'}, body:JSON.stringify(row)});

/* ---------- Dashboard ---------- */
function Dashboard({D}){
  const t = D.tracker;
  const last = t[t.length-1], prev = t[t.length-2];
  const mDelta = last.net_worth - prev.net_worth;
  const labels = t.map(ymLabel);
  const accounts = [
    ['現金/活存', r=>r.cash, '#f0b90b'],
    ['台幣定存', r=>r.twd_fixed, '#fb923c'],
    ['美金/美金定存', r=>r.usd + r.usd_fixed, '#22d3ee'],
    ['永豐台股', r=>r.tw_stock, '#4f8cff'],
    ['永豐美股', r=>r.us_stock, '#a78bfa'],
    ['FirstTrade', r=>r.ft, '#2ecc8f'],
    ['幣安', r=>r.crypto, '#e879f9'],
  ];
  const notes = t.filter(r=>r.note).slice(-8).reverse();
  const yearStart = t.filter(r=>r.year===last.year)[0];
  const ytd = yearStart ? (last.net_worth-yearStart.net_worth)/yearStart.net_worth : null;
  return <div>
    <div className="page-title">資產總覽</div>
    <div className="page-sub">追蹤期間 {ymLabel(t[0])} – {ymLabel(last)}（{t.length} 個月）・幣別 TWD</div>
    <div className="kpis">
      <div className="kpi"><div className="lab">淨資產</div><div className="val">{fmtWan(last.net_worth)}</div>
        <div className={'sub '+(mDelta>=0?'up':'down')}>{mDelta>=0?'▲':'▼'} {fmtWan(Math.abs(mDelta))}（月變化）</div></div>
      <div className="kpi"><div className="lab">資產總額（含未實現）</div><div className="val">{fmtWan(last.total_assets)}</div>
        <div className="sub">成本 {fmtWan(last.total_cost)}</div></div>
      <div className="kpi"><div className="lab">累積損益</div><div className={'val '+(last.pnl>=0?'up':'down')}>{last.pnl>=0?'+':''}{fmtWan(last.pnl)}</div>
        <div className="sub">總報酬率 {fmtPct(last.roi)}</div></div>
      <div className="kpi"><div className="lab">今年以來 YTD</div><div className={'val '+(ytd>=0?'up':'down')}>{ytd!=null?(ytd>=0?'+':'')+fmtPct(ytd):'-'}</div>
        <div className="sub">{last.year} 年（淨資產）</div></div>
      <div className="kpi"><div className="lab">年齡</div><div className="val">{last.age} 歲</div>
        <div className="sub">長線投資進行中</div></div>
    </div>
    <div className="card">
      <h3>淨資產 / 資產總額 / 投入成本 走勢<small>單位：新台幣</small></h3>
      <ChartBox type="line" height={300} data={{labels,datasets:[
        {label:'淨資產',data:t.map(r=>r.net_worth),borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
        {label:'資產總額',data:t.map(r=>r.total_assets),borderColor:'#2ecc8f',tension:.3,pointRadius:0,borderWidth:2},
        {label:'投入成本',data:t.map(r=>r.total_cost),borderColor:'#8b98ad',borderDash:[5,4],tension:.3,pointRadius:0,borderWidth:1.5},
      ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:tipWan},scales:{y:axisWan}}}/>
    </div>
    <div className="grid2">
      <div className="card">
        <h3>帳戶組成（堆疊）</h3>
        <ChartBox type="line" height={280} data={{labels,datasets:accounts.map(([nm,fn,col])=>(
          {label:nm,data:t.map(fn),borderColor:col,backgroundColor:col+'55',fill:true,tension:.2,pointRadius:0,borderWidth:1}
        ))}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:tipWan},scales:{y:{stacked:true,...axisWan},x:{ticks:{maxTicksLimit:10}}}}}/>
      </div>
      <div className="card">
        <h3>每月儲蓄（入金）</h3>
        <ChartBox type="bar" height={280} data={{labels,datasets:[{label:'儲蓄',data:t.map(r=>r.savings),
          backgroundColor:t.map(r=>(r.savings||0)>=0?'rgba(46,204,143,.7)':'rgba(255,93,108,.7)')}]}}
          options={{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tipWan},scales:{y:axisWan,x:{ticks:{maxTicksLimit:10}}}}}/>
      </div>
    </div>
    <div className="card">
      <h3>投資筆記（來自追蹤表 Note）</h3>
      {notes.map((r,i)=><div className="note-row" key={i}><span className="d">{ymLabel(r)}</span>{r.note}</div>)}
    </div>
  </div>;
}

/* ---------- FIRE 試算 ---------- */
function simulate(p){
  const rows=[]; let v=p.asset0;
  for(let year=p.year0+1; ; year++){
    const age = p.age0 + (year - p.year0);
    if(age>100) break;
    const retired = year >= p.retireYear;
    const r = retired ? p.rRetire : p.rWork;
    const invest = retired ? 0 : p.monthly*12;
    let wd = retired ? p.withdraw0 * Math.pow(1+p.inflation, year - p.year0) : 0;
    if(retired && (Number(p.baristaIncome)||0)>0 && age < (Number(p.baristaUntilAge)||0)){
      wd = Math.max(0, wd - p.baristaIncome * Math.pow(1+p.inflation, year - p.year0));  // Barista：兼職分攤
    }
    v = Math.max(0,(v - wd)) * (1+r) + invest;
    rows.push({year,age,value:v,withdraw:wd});
  }
  return rows;
}
const FIRE_TYPES=[
  {id:'regular', nm:'Regular FIRE', emoji:'🔥', expMult:1,   desc:'標準退休：年支出×25（4% 法則），完全停止工作。'},
  {id:'lean',    nm:'Lean FIRE',    emoji:'🌱', expMult:0.6, desc:'精簡退休：年支出約 6 成，目標較低、可較早達成。'},
  {id:'fat',     nm:'Fat FIRE',     emoji:'💎', expMult:1.8, desc:'寬裕退休：年支出約 1.8 倍，追求高品質生活，目標較高。'},
  {id:'barista', nm:'Barista FIRE', emoji:'☕', expMult:1,   barista:true, desc:'半退休：退休後仍兼職，兼職收入分攤部分支出，所需提領較少。'},
  {id:'coast',   nm:'Coast FIRE',   emoji:'🏖️', expMult:1,  coast:true, desc:'滑行退休：現有資產停止投入，光靠複利滾到退休目標。'},
];
function Fire({D}){
  const t = D.tracker, last = t[t.length-1];
  const [p,setP] = useState({
    age0:last.age, year0:last.year, asset0:Math.round(last.net_worth/WAN),
    monthly:10, rWork:.10, rRetire:.08, inflation:.03, retireYear:2031, withdraw0:300,
  });
  const [overlay,setOverlay] = useState(true);
  const set = (k,v)=>setP(o=>({...o,[k]:v}));
  const sim = useMemo(()=>simulate({...p, asset0:p.asset0, monthly:p.monthly, withdraw0:p.withdraw0}),[p]);
  const retireAge = p.age0 + (p.retireYear - p.year0);
  const atRetire = sim.find(r=>r.year===p.retireYear-1);
  const depleted = sim.find(r=>r.value<=0);
  const end = sim[sim.length-1];
  const wdAtRetire = p.withdraw0 * Math.pow(1+p.inflation, p.retireYear - p.year0);
  const rule4 = wdAtRetire / 0.04;
  const planMap = {}, actMap = {};
  D.fcst_plan.forEach(r=>planMap[r.year]=r.value*1000/WAN);   // 千 → 萬
  D.fcst_actual.forEach(r=>actMap[r.year]=r.value*1000/WAN);
  const labels = sim.map(r=>r.year);
  const datasets = [
    {label:'試算淨資產',data:sim.map(r=>r.value),borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2.5},
  ];
  if(overlay){
    datasets.push({label:'Excel 計畫線(Plan)',data:labels.map(y=>planMap[y]??null),borderColor:'#8b98ad',borderDash:[6,4],pointRadius:0,borderWidth:1.5,tension:.3});
    datasets.push({label:'Excel 樂觀線(Actual)',data:labels.map(y=>actMap[y]??null),borderColor:'#2ecc8f',borderDash:[6,4],pointRadius:0,borderWidth:1.5,tension:.3});
  }
  return <div>
    <div className="page-title">退休試算（FIRE 計算機）</div>
    <div className="page-sub">長線懶人投資：以年為單位試算至 100 歲・提領金額逐年隨通膨調整・金額單位為萬元</div>
    <div className="grid32">
      <div>
        <div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>
          <div className="kpi"><div className="lab">退休年（{retireAge} 歲）資產</div>
            <div className="val">{atRetire? fmtNum(atRetire.value)+' 萬':'-'}</div>
            <div className="sub">4% 法則需求：{fmtNum(rule4)} 萬</div></div>
          <div className="kpi"><div className="lab">退休首年提領</div>
            <div className="val">{fmtNum(wdAtRetire)} 萬/年</div>
            <div className="sub">約 {fmtNum(wdAtRetire/12)} 萬/月（含通膨）</div></div>
          <div className="kpi"><div className="lab">100 歲時資產</div>
            <div className={'val '+(end.value>0?'up':'down')}>{fmtNum(end.value)} 萬</div>
            <div className="sub">{depleted? '⚠ '+(p.age0+(depleted.year-p.year0))+' 歲耗盡' : '✓ 終身不耗盡'}</div></div>
          <div className="kpi"><div className="lab">安全評估</div>
            <div className={'val '+((atRetire&&atRetire.value>=rule4)?'up':'down')}>{(atRetire&&atRetire.value>=rule4)?'達標':'未達標'}</div>
            <div className="sub">退休資產 vs 4% 法則</div></div>
        </div>
        <div className="card">
          <h3>資產曲線試算
            <small><label style={{cursor:'pointer'}}><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/> 疊加 Excel FCST 計畫線</label></small>
          </h3>
          <ChartBox type="line" height={360} data={{labels,datasets}}
            options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
              plugins:{tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${Math.round(c.parsed.y).toLocaleString()} 萬`}}},
              scales:{y:{ticks:{callback:v=>v>=10000? (v/10000)+'億' : v+'萬'}}}}}/>
        </div>
        <div className="card">
          <h3>逐年明細（每 5 年）</h3>
          <table><thead><tr><th>年份</th><th>年齡</th><th>淨資產(萬)</th><th>當年提領(萬)</th><th>階段</th></tr></thead>
          <tbody>{sim.filter((r,i)=>r.age%5===0||r.year===p.retireYear||i===sim.length-1).map(r=>
            <tr key={r.year}><td>{r.year}</td><td style={{textAlign:'right'}}>{r.age}</td>
              <td>{fmtNum(r.value)}</td><td>{r.withdraw?fmtNum(r.withdraw):'-'}</td>
              <td><span className={'tag '+(r.year>=p.retireYear?'sell':'buy')}>{r.year>=p.retireYear?'退休提領':'累積投入'}</span></td></tr>)}
          </tbody></table>
        </div>
      </div>
      <div>
        <div className="card">
          <h3>試算參數</h3>
          <FireIn p={p} set={set} k="asset0" lab="目前淨資產（萬）" step={10}/>
          <FireIn p={p} set={set} k="monthly" lab="每月投入（萬）" step={1}/>
          <FireIn p={p} set={set} k="retireYear" lab="退休年份（西元）" step={1}/>
          <FireIn p={p} set={set} k="withdraw0" lab="退休後年提領（萬・今日購買力）" step={10}/>
          <FireIn p={p} set={set} k="rWork" lab="工作期年化報酬率（%）" step={0.5} pct/>
          <FireIn p={p} set={set} k="rRetire" lab="退休後年化報酬率（%）" step={0.5} pct/>
          <FireIn p={p} set={set} k="inflation" lab="通膨率（%）" step={0.1} pct/>
          <div className="pill">基準年 {p.year0}</div><div className="pill">{p.age0} 歲</div>
        </div>
        <div className="card">
          <h3>說明</h3>
          <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.8}}>
            ・試算邏輯與 Excel FCST 一致：退休前每年投入、退休後停止投入並提領。<br/>
            ・提領金額以「今日購買力」輸入，每年依通膨率自動放大。<br/>
            ・4% 法則：退休首年提領 ÷ 4% = 所需資產（市場先生／Trinity Study 常用基準）。<br/>
            ・長線配置建議搭配「持倉配置」頁的股債策略，退休越近債券與現金比重越高。
          </div>
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- 持倉配置 ---------- */
const STRATEGIES = [
  {id:'agg',  nm:'積極成長型', ds:'距退休 10 年以上，可承受波動。全球股票為主。', mix:{Stock:50,ETF:35,Bond:10,Cash:5}},
  {id:'bal',  nm:'平衡型 60/40', ds:'經典股債平衡，長期年化約 7-8%，回檔較緩和。', mix:{Stock:25,ETF:35,Bond:30,Cash:10}},
  {id:'cons', nm:'保守提領型', ds:'已退休或 3 年內退休，重視現金流與防禦。', mix:{Stock:10,ETF:30,Bond:40,Cash:20}},
  {id:'lazy', nm:'懶人指數型', ds:'全部用大盤 ETF 定期定額，不選股、極簡管理。', mix:{Stock:0,ETF:80,Bond:15,Cash:5}},
];
function Allocation({D}){
  const H = D.holdings;
  const ym = D.holdings_ym;
  const total = H.reduce((s,r)=>s+r.ntd,0);
  const byCat = {}, byBroker = {};
  H.forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+r.ntd; byBroker[r.broker]=(byBroker[r.broker]||0)+r.ntd; });
  const cats = Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]);
  const brokers = Object.keys(byBroker).sort((a,b)=>byBroker[b]-byBroker[a]);
  const top = H.slice(0,10);
  const maxPos = H[0];
  const [stra,setStra] = useState('bal');
  const target = STRATEGIES.find(s=>s.id===stra).mix;
  const allCats = ['Stock','ETF','Bond','Cash'];
  const hist = D.alloc_history;
  const histLabels = hist.map(r=>r.year+'/'+String(r.month).padStart(2,'0'));
  return <div>
    <div className="page-title">持倉配置分析</div>
    <div className="page-sub">最新持倉：{ym[0]}/{String(ym[1]).padStart(2,'0')}・共 {H.length} 檔・市值合計 {fmtWan(total)}</div>
    <div className="kpis">
      <div className="kpi"><div className="lab">持倉市值</div><div className="val">{fmtWan(total)}</div><div className="sub">{H.length} 檔標的</div></div>
      {allCats.map(c=><div className="kpi" key={c}><div className="lab">{CAT_NAME[c]}占比</div>
        <div className="val" style={{color:CAT_COLOR[c]}}>{((byCat[c]||0)/total*100).toFixed(1)}%</div>
        <div className="sub">{fmtWan(byCat[c]||0)}</div></div>)}
      <div className="kpi"><div className="lab">最大單一持股</div><div className="val">{maxPos.name}</div>
        <div className={'sub '+(maxPos.ntd/total>0.3?'down':'')}>{(maxPos.ntd/total*100).toFixed(1)}%{maxPos.ntd/total>0.3?'（集中度偏高）':''}</div></div>
    </div>
    <div className="grid2">
      <div className="card">
        <h3>資產類別配置</h3>
        <ChartBox type="doughnut" height={250} data={{labels:cats.map(c=>CAT_NAME[c]||c),datasets:[{data:cats.map(c=>byCat[c]),
          backgroundColor:cats.map(c=>CAT_COLOR[c]||'#94a3b8'),borderColor:'#121826',borderWidth:2}]}}
          options={{maintainAspectRatio:false,plugins:{legend:{position:'right'},
            tooltip:{callbacks:{label:c=>` ${c.label}: ${(c.parsed/WAN).toFixed(0)} 萬（${(c.parsed/total*100).toFixed(1)}%）`}}},cutout:'62%'}}/>
      </div>
      <div className="card">
        <h3>券商/平台分布</h3>
        <ChartBox type="doughnut" height={250} data={{labels:brokers,datasets:[{data:brokers.map(b=>byBroker[b]),
          backgroundColor:COLORS,borderColor:'#121826',borderWidth:2}]}}
          options={{maintainAspectRatio:false,plugins:{legend:{position:'right'},
            tooltip:{callbacks:{label:c=>` ${c.label}: ${(c.parsed/WAN).toFixed(0)} 萬（${(c.parsed/total*100).toFixed(1)}%）`}}},cutout:'62%'}}/>
      </div>
    </div>
    <div className="grid2">
      <div className="card">
        <h3>前十大持倉</h3>
        <ChartBox type="bar" height={300} data={{labels:top.map(r=>r.name),datasets:[{label:'市值',data:top.map(r=>r.ntd),
          backgroundColor:top.map(r=>CAT_COLOR[r.cat]+'cc')}]}}
          options={{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tipWan},scales:{x:axisWan}}}/>
      </div>
      <div className="card">
        <h3>配置變化（依月份）</h3>
        <ChartBox type="bar" height={300} data={{labels:histLabels,datasets:allCats.map(c=>(
          {label:CAT_NAME[c],data:hist.map(r=>r[c]||0),backgroundColor:CAT_COLOR[c]+'cc'}))}}
          options={{maintainAspectRatio:false,interaction:{mode:'index'},plugins:{tooltip:tipWan},
            scales:{x:{stacked:true,ticks:{maxTicksLimit:12}},y:{stacked:true,...axisWan}}}}/>
      </div>
    </div>
    <div className="card">
      <h3>配置策略範本<small>選擇策略後，下表自動計算再平衡建議（參考懶人投資配置概念）</small></h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginBottom:16}}>
        {STRATEGIES.map(s=><div key={s.id} className={'strategy'+(stra===s.id?' sel':'')} onClick={()=>setStra(s.id)}>
          <div className="nm">{s.nm}</div><div className="ds">{s.ds}</div>
          <div className="bar-mini">{allCats.map(c=><div key={c} style={{width:s.mix[c]+'%',background:CAT_COLOR[c]}} title={CAT_NAME[c]+' '+s.mix[c]+'%'}></div>)}</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>{allCats.map(c=>CAT_NAME[c]+' '+s.mix[c]+'%').join('・')}</div>
        </div>)}
      </div>
      <table><thead><tr><th>類別</th><th>目前市值</th><th>目前%</th><th>目標%</th><th>目標市值</th><th>差額</th><th>建議</th></tr></thead>
      <tbody>{allCats.map(c=>{
        const cur = byCat[c]||0, curP = cur/total*100, tgtP = target[c], tgt = total*tgtP/100, diff = tgt-cur;
        const act = Math.abs(diff)/total < 0.03 ? 'hold' : diff>0 ? 'buy' : 'sell';
        return <tr key={c}><td><span className={'tag '+c}>{CAT_NAME[c]}</span></td>
          <td>{fmtWan(cur)}</td><td>{curP.toFixed(1)}%</td><td>{tgtP}%</td><td>{fmtWan(tgt)}</td>
          <td className={diff>=0?'up':'down'}>{diff>=0?'+':''}{fmtWan1(diff)}</td>
          <td><span className={'tag '+act}>{act==='buy'?'加碼':act==='sell'?'減碼':'持平'}</span></td></tr>;
      })}</tbody></table>
      <div style={{color:'var(--muted)',fontSize:12,marginTop:10}}>※ 差額在總資產 ±3% 內視為持平，不建議頻繁交易；再平衡頻率建議每半年或每年一次。</div>
    </div>
  </div>;
}

/* ---------- 行情供應商層（TWSE / Binance / Twelve Data） ---------- */
const MAP_KEY='inv_symbol_map', QCACHE_KEY='inv_quote_cache', QTY_KEY='inv_qty';
function loadJSON(k,d){ try{const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v;}catch(e){return d;} }
function saveJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
const DEFAULT_MAP = {
 'YFY|TSMC':  {p:'twse', s:'2330',   nm:'台積電',      cur:'TWD'},
 'YFY|TW50':  {p:'twse', s:'0050',   nm:'元大台灣50',  cur:'TWD'},
 'YFY|TW50+2':{p:'twse', s:'006208', nm:'富邦台50',    cur:'TWD'},
 'YFY|QQQ':   {p:'twse', s:'00662',  nm:'富邦NASDAQ',  cur:'TWD'},
 'YFY|SPY':   {p:'twse', s:'00646',  nm:'元大S&P500',  cur:'TWD'},
 'YFY|TLT':   {p:'twse', s:'00679B', nm:'元大美債20年', cur:'TWD'},
 'YFY|NVDA':  {p:'td', s:'NVDA', cur:'USD'},
 'FT|TSMC':{p:'td',s:'TSM',cur:'USD'},  'FT|TSLA':{p:'td',s:'TSLA',cur:'USD'},
 'FT|NVDA':{p:'td',s:'NVDA',cur:'USD'}, 'FT|PLTR':{p:'td',s:'PLTR',cur:'USD'},
 'FT|GOOG':{p:'td',s:'GOOG',cur:'USD'}, 'FT|MSFT':{p:'td',s:'MSFT',cur:'USD'},
 'FT|META':{p:'td',s:'META',cur:'USD'}, 'FT|SE':{p:'td',s:'SE',cur:'USD'},
 'FT|IBIT':{p:'td',s:'IBIT',cur:'USD'}, 'FT|ARKQ':{p:'td',s:'ARKQ',cur:'USD'},
 'FT|SPY':{p:'td',s:'SPY',cur:'USD'},   'FT|QQQ':{p:'td',s:'QQQ',cur:'USD'},
 'FT|TLT':{p:'td',s:'TLT',cur:'USD'},   'FT|IEF':{p:'td',s:'IEF',cur:'USD'},
 'FT|SOXX':{p:'td',s:'SOXX',cur:'USD'}, 'FT|SSO':{p:'td',s:'SSO',cur:'USD'},
 'FT|QLD':{p:'td',s:'QLD',cur:'USD'},
 'FT|SpaceX':{p:'manual',s:'SpaceX',cur:'USD'},
 'FT|Cash':{p:'manual',s:'Cash',cur:'TWD'}, 'YFY|Cash':{p:'manual',s:'Cash',cur:'TWD'},
 'FT|USD':{p:'manual',s:'USD',cur:'USD'},
};
function getMap(){ return {...DEFAULT_MAP, ...loadJSON(MAP_KEY,{})}; }
const CURVE_ASSETS = [
 {id:'0050',  p:'twse', s:'0050',    nm:'元大台灣50',   cat:'ETF',   cur:'TWD'},
 {id:'2330',  p:'twse', s:'2330',    nm:'台積電',       cat:'Stock', cur:'TWD'},
 {id:'SPY',   p:'td',   s:'SPY',     nm:'SPY 標普500',  cat:'ETF',   cur:'USD'},
 {id:'QQQ',   p:'td',   s:'QQQ',     nm:'QQQ 那斯達克', cat:'ETF',   cur:'USD'},
 {id:'NVDA',  p:'td',   s:'NVDA',    nm:'NVIDIA',      cat:'Stock', cur:'USD'},
 {id:'TSLA',  p:'td',   s:'TSLA',    nm:'Tesla',       cat:'Stock', cur:'USD'},
 {id:'TLT',   p:'td',   s:'TLT',     nm:'TLT 美債20年+', cat:'Bond', cur:'USD'},
 {id:'IEF',   p:'td',   s:'IEF',     nm:'IEF 美債7-10年',cat:'Bond', cur:'USD'},
 {id:'GOLD',  p:'td',   s:'XAU/USD', nm:'黃金 XAU',     cat:'Gold',  cur:'USD'},
 {id:'BTC',   p:'bn',   s:'BTCUSDT', nm:'比特幣 BTC',   cat:'Crypto',cur:'USD'},
 {id:'USDTWD',p:'td',   s:'USD/TWD', nm:'美元兌台幣',   cat:'FX',    cur:'TWD'},
];
const pad2=n=>String(n).padStart(2,'0');
function monthsBack(n){
  const out=[], d=new Date();
  for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(), d.getMonth()-i, 1); out.push(''+x.getFullYear()+pad2(x.getMonth()+1)); }
  return out;
}
async function twseMonth(stockNo, ym){
  const r = await fetch(`https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${ym}01&stockNo=${stockNo}&response=json`);
  const js = await r.json();
  return js.data || [];
}
async function fetchQuote(m, tdKey){
  if(m.p==='twse'){
    let rows = await twseMonth(m.s, monthsBack(1)[0]);
    if(!rows.length) rows = await twseMonth(m.s, monthsBack(2)[0]);
    if(!rows.length) throw new Error('TWSE 無資料');
    const last = rows[rows.length-1];
    const close = parseFloat(String(last[6]).replace(/,/g,''));
    const chg = parseFloat(String(last[7]||'0').replace(/[+,X ]/g,''))||0;
    return {price:close, chgPct:(close-chg)?chg/(close-chg)*100:0, t:last[0]};
  }
  if(m.p==='bn'){
    const js = await (await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol='+m.s)).json();
    return {price:parseFloat(js.lastPrice), chgPct:parseFloat(js.priceChangePercent), t:'24h'};
  }
  if(m.p==='td'){
    if(!tdKey) throw new Error('需先在「設定」填入 Twelve Data API key');
    const js = await (await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(m.s)}&apikey=${tdKey}`)).json();
    if(js.status==='error') throw new Error(js.message||'TD 錯誤');
    return {price:parseFloat(js.close), chgPct:parseFloat(js.percent_change)||0, t:js.datetime};
  }
  throw new Error('手動資產無報價');
}
async function fetchHistory(m, tdKey, onProgress){
  if(m.p==='bn'){
    const js = await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${m.s}&interval=1M&limit=121`)).json();
    return js.map(k=>{ const d=new Date(k[0]); return {ym:d.getFullYear()+'-'+pad2(d.getMonth()+1), c:parseFloat(k[4])}; });
  }
  if(m.p==='td'){
    if(!tdKey) throw new Error('需先在「設定」填入 Twelve Data API key（免費申請）');
    const js = await (await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(m.s)}&interval=1month&outputsize=121&apikey=${tdKey}`)).json();
    if(js.status==='error') throw new Error(js.message||'TD 錯誤');
    return js.values.map(v=>({ym:v.datetime.slice(0,7), c:parseFloat(v.close)})).reverse();
  }
  if(m.p==='twse'){
    const list = monthsBack(121), out=[];
    for(let i=0;i<list.length;i++){
      const ym=list[i], ck='inv_hist_twse_'+m.s+'_'+ym, isCur=(i===list.length-1);
      let close = loadJSON(ck, null);
      if(close==null || isCur){
        try{
          const rows = await twseMonth(m.s, ym);
          if(rows.length){
            close = parseFloat(String(rows[rows.length-1][6]).replace(/,/g,''));
            if(!isCur && !isNaN(close)) saveJSON(ck, close);
          }
          await new Promise(r=>setTimeout(r,150));
        }catch(e){ close=null; }
      }
      if(close!=null && !isNaN(close)) out.push({ym:ym.slice(0,4)+'-'+ym.slice(4), c:close});
      if(onProgress) onProgress(i+1, list.length);
    }
    if(out.length<13) throw new Error('TWSE 歷史資料不足（此代號可能上市未滿十年的部分月份無資料，或代號錯誤）');
    return out;
  }
  throw new Error('手動資產無歷史資料');
}
function calcStats(hist){
  if(!hist || hist.length<13) return null;
  const first=hist[0].c, last=hist[hist.length-1].c, years=(hist.length-1)/12;
  const cagr = Math.pow(last/first, 1/years) - 1;
  let peak=-Infinity, mdd=0;
  hist.forEach(h=>{ peak=Math.max(peak,h.c); mdd=Math.min(mdd,(h.c-peak)/peak); });
  return {cagr, total:last/first-1, mdd, years, first, last};
}

/* ---------- 即時行情 ---------- */
function Quotes({D}){
  const cfg = loadCfg();
  const map = getMap();
  const [quotes,setQuotes] = useState(loadJSON(QCACHE_KEY,{}));
  const [qty,setQty] = useState(loadJSON(QTY_KEY,{}));
  const [busy,setBusy] = useState(false);
  const [errs,setErrs] = useState({});
  const [lastAt,setLastAt] = useState(loadJSON('inv_quote_at',null));
  const H = D.holdings.filter(h=>h.ntd>0);
  const fx = (quotes['td|USD/TWD']&&quotes['td|USD/TWD'].price) || cfg.fx || 31;
  const qk = m => m.p+'|'+m.s;
  const refresh = async ()=>{
    if(busy) return;
    setBusy(true);
    const nq={...quotes}, ne={};
    try{ if(cfg.tdKey){ const r=await fetchQuote({p:'td',s:'USD/TWD'},cfg.tdKey); nq['td|USD/TWD']={...r,at:Date.now()}; } }catch(e){}
    const done=new Set();
    for(const h of H){
      const m = map[h.broker+'|'+h.name];
      if(!m || m.p==='manual' || done.has(qk(m))) continue;
      done.add(qk(m));
      try{ const r=await fetchQuote(m,cfg.tdKey); nq[qk(m)]={...r,at:Date.now()}; setQuotes({...nq}); }
      catch(e){ ne[h.broker+'|'+h.name]=e.message; setErrs({...ne}); }
    }
    saveJSON(QCACHE_KEY,nq); setQuotes(nq);
    const at=Date.now(); saveJSON('inv_quote_at',at); setLastAt(at);
    setBusy(false);
  };
  useEffect(()=>{
    const min = parseInt(cfg.autoMin)||0;
    if(!min) return;
    const id = setInterval(refresh, min*60000);
    return ()=>clearInterval(id);
  },[]);
  const setQ = (key,v)=>{ const n={...qty,[key]:v}; setQty(n); saveJSON(QTY_KEY,n); };
  let snapTotal=0, liveTotal=0, liveCount=0;
  const rows = H.map(h=>{
    const key=h.broker+'|'+h.name, m=map[key], q=m&&quotes[qk(m)];
    const nQty = parseFloat(qty[key])||0;
    let live=null;
    if(q && nQty) live = nQty * q.price * (m.cur==='USD'?fx:1);
    if(m && m.p==='manual') live = h.ntd;
    snapTotal += h.ntd;
    liveTotal += (live!=null? live : h.ntd);
    if(live!=null) liveCount++;
    return {h,key,m,q,nQty,live,err:errs[key]};
  });
  return <div>
    <div className="page-title">即時行情</div>
    <div className="page-sub">
      資料源：台股 TWSE（收盤）・美股/黃金/匯率 Twelve Data・加密貨幣 Binance（24h 即時）。
      填入庫存股數即可換算即時市值（USD 以 {Number(fx).toFixed(2)} 匯率折算）。
    </div>
    <div className="kpis">
      <div className="kpi"><div className="lab">快照市值（{D.holdings_ym[0]}/{pad2(D.holdings_ym[1])}）</div><div className="val">{fmtWan(snapTotal)}</div><div className="sub">來自 Excel 匯入</div></div>
      <div className="kpi"><div className="lab">即時估算市值</div><div className="val">{fmtWan(liveTotal)}</div>
        <div className={'sub '+(liveTotal>=snapTotal?'up':'down')}>{liveTotal>=snapTotal?'▲':'▼'} {fmtWan(Math.abs(liveTotal-snapTotal))} vs 快照（{liveCount} 檔已連動）</div></div>
      <div className="kpi"><div className="lab">美元匯率 USD/TWD</div><div className="val">{Number(fx).toFixed(3)}</div>
        <div className="sub">{quotes['td|USD/TWD']?'即時':'手動（可在設定修改）'}</div></div>
      <div className="kpi"><div className="lab">更新狀態</div>
        <div className="val" style={{fontSize:15}}>{busy?'更新中…':(lastAt? new Date(lastAt).toLocaleString('zh-TW'):'尚未更新')}</div>
        <div className="sub">自動更新：{parseInt(cfg.autoMin)?('每 '+cfg.autoMin+' 分鐘'):'關閉（可在設定開啟）'}</div></div>
    </div>
    <div className="card">
      <h3>持倉行情總表
        <small><button className="btn" style={{padding:'6px 14px',fontSize:13}} onClick={refresh} disabled={busy}>{busy?'更新中…':'⟳ 立即更新'}</button></small>
      </h3>
      <table><thead><tr><th>帳戶</th><th>標的</th><th>代號</th><th>類別</th><th>現價</th><th>日漲跌</th><th>庫存股數</th><th>即時市值(TWD)</th><th>快照市值</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.key}>
        <td>{r.h.broker==='YFY'?'永豐':r.h.broker}</td>
        <td>{r.m&&r.m.nm? r.m.nm+'（'+r.h.name+'）' : r.h.name}</td>
        <td style={{textAlign:'left',color:'var(--muted)'}}>{r.m? (r.m.p==='manual'?'手動':r.m.s):'未對應'}</td>
        <td style={{textAlign:'left'}}><span className={'tag '+r.h.cat}>{CAT_NAME[r.h.cat]||r.h.cat}</span></td>
        <td>{r.q? r.q.price.toLocaleString('zh-TW',{maximumFractionDigits:2})+(r.m.cur==='USD'?' US$':' NT$') : (r.err? <span className="down" title={r.err}>✗ 失敗</span> : '-')}</td>
        <td className={r.q&&r.q.chgPct>=0?'up':'down'}>{r.q? (r.q.chgPct>=0?'+':'')+r.q.chgPct.toFixed(2)+'%' : '-'}</td>
        <td>{r.m&&r.m.p!=='manual'? <input style={{width:90,background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:6,color:'var(--text)',padding:'4px 8px',textAlign:'right'}}
          value={qty[r.key]||''} placeholder="股數" onChange={e=>setQ(r.key,e.target.value)}/> : '-'}</td>
        <td>{r.live!=null? fmtWan1(r.live) : <span style={{color:'var(--muted)'}}>填股數後顯示</span>}</td>
        <td style={{color:'var(--muted)'}}>{fmtWan1(r.h.ntd)}</td>
      </tr>)}</tbody>
      <tfoot><tr style={{fontWeight:700}}><td colSpan={7} style={{textAlign:'right'}}>合計</td><td>{fmtWan(liveTotal)}</td><td>{fmtWan(snapTotal)}</td></tr></tfoot>
      </table>
      {Object.keys(errs).length>0 && <div className="down" style={{fontSize:12,marginTop:10}}>
        部分標的更新失敗：{Object.entries(errs).map(([k,v])=>k+'（'+v+'）').join('、')}</div>}
      <div style={{color:'var(--muted)',fontSize:12,marginTop:10}}>
        ※ 永豐帳戶的 QQQ/SPY/TLT 預設對應台股掛牌 ETF（00662/00646/00679B），若實際持有標的不同可於「設定」修改對應。
        台股為當日收盤價；美股為延遲報價；加密貨幣為 24 小時即時價。即時市值僅為估算，正式數字以券商對帳單為準。
      </div>
    </div>
  </div>;
}

/* ---------- 資產曲線（10年歷史＋10年試算） ---------- */
function Curve(){
  const cfg = loadCfg();
  const [aid,setAid] = useState('0050');
  const asset = CURVE_ASSETS.find(x=>x.id===aid);
  const [hist,setHist] = useState(null);
  const [prog,setProg] = useState('');
  const [err,setErr] = useState('');
  const [p,setP] = useState({w0:100, dca:1, r:7, r2:4});
  const histCache = useRef({});
  const load = async (a)=>{
    setErr(''); setProg('載入歷史資料中…'); setHist(null);
    try{
      let h = histCache.current[a.id];
      if(!h){
        h = await fetchHistory(a, cfg.tdKey, (i,n)=>setProg('載入 '+a.nm+' 歷史 '+i+'/'+n+' 個月（台股首次較久，之後有快取）'));
        histCache.current[a.id]=h;
      }
      setHist(h); setProg('');
      const st = calcStats(h);
      if(st) setP(o=>({...o, r:Math.round(st.cagr*1000)/10, r2:Math.max(0,Math.round((st.cagr-0.04)*1000)/10)}));
    }catch(e){ setErr(e.message); setProg(''); }
  };
  useEffect(()=>{ load(asset); },[aid]);
  const st = calcStats(hist);
  const proj = useMemo(()=>{
    const rows=[]; let v1=p.w0, v2=p.w0, cost=p.w0;
    const m1=Math.pow(1+(p.r||0)/100,1/12), m2=Math.pow(1+(p.r2||0)/100,1/12);
    const now=new Date();
    for(let i=1;i<=120;i++){
      v1=v1*m1+(p.dca||0); v2=v2*m2+(p.dca||0); cost+=(p.dca||0);
      const d=new Date(now.getFullYear(), now.getMonth()+i, 1);
      rows.push({ym:d.getFullYear()+'-'+pad2(d.getMonth()+1), base:v1, cons:v2, cost});
    }
    return rows;
  },[p]);
  const wanTip = {callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}};
  return <div>
    <div className="page-title">資產曲線試算</div>
    <div className="page-sub">每類資產：過去 10 年實際走勢（自動抓取）＋ 未來 10 年試算（預設年化＝歷史 CAGR，可調整、可加定期定額）</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
      {CURVE_ASSETS.map(a=><div key={a.id} className={'strategy'+(aid===a.id?' sel':'')} style={{padding:'8px 14px'}} onClick={()=>setAid(a.id)}>
        <span style={{fontWeight:600,fontSize:13}}>{a.nm}</span>
        <span style={{color:'var(--muted)',fontSize:11,marginLeft:6}}>{a.cat}</span>
      </div>)}
    </div>
    {err && <div className="card"><div className="down">⚠ {err}</div>
      {asset.p==='td' && !cfg.tdKey && <div style={{color:'var(--muted)',fontSize:12.5,marginTop:8}}>
        美股／黃金／匯率資料需要免費的 Twelve Data API key：到 twelvedata.com 註冊 → Dashboard 複製 API key → 在本系統「設定」頁貼上（免費額度 800 次/天，足夠日常使用）。台股與比特幣不需要 key。</div>}</div>}
    {prog && <div className="card" style={{color:'var(--accent)'}}>{prog}</div>}
    {st && <div className="kpis">
      <div className="kpi"><div className="lab">現價</div><div className="val">{st.last.toLocaleString('zh-TW',{maximumFractionDigits:2})}</div><div className="sub">{asset.cur==='USD'?'美元':'台幣'}・{hist[hist.length-1].ym}</div></div>
      <div className="kpi"><div className="lab">{Math.round(st.years)} 年年化報酬 CAGR</div><div className={'val '+(st.cagr>=0?'up':'down')}>{(st.cagr*100).toFixed(1)}%</div><div className="sub">幾何平均</div></div>
      <div className="kpi"><div className="lab">累積報酬</div><div className={'val '+(st.total>=0?'up':'down')}>{(st.total*100).toFixed(0)}%</div><div className="sub">{hist[0].ym} 起</div></div>
      <div className="kpi"><div className="lab">最大回撤</div><div className="val down">{(st.mdd*100).toFixed(1)}%</div><div className="sub">月線基準（日線會更深）</div></div>
    </div>}
    {hist && <div className="card">
      <h3>{asset.nm} — 過去 10 年走勢<small>月線收盤・{asset.cur}</small></h3>
      <ChartBox type="line" height={290} data={{labels:hist.map(h=>h.ym),datasets:[
        {label:asset.nm,data:hist.map(h=>h.c),borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.25,pointRadius:0,borderWidth:2}]}}
        options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
          plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:11}}}}}/>
    </div>}
    <div className="grid32">
      <div className="card">
        <h3>未來 10 年試算<small>單筆 {p.w0} 萬＋每月定期定額 {p.dca} 萬（單位：萬台幣）</small></h3>
        <ChartBox type="line" height={310} data={{labels:proj.map(r=>r.ym),datasets:[
          {label:'基準 '+p.r+'%/年',data:proj.map(r=>r.base),borderColor:'#2ecc8f',backgroundColor:'rgba(46,204,143,.07)',fill:true,tension:.25,pointRadius:0,borderWidth:2},
          {label:'保守 '+p.r2+'%/年',data:proj.map(r=>r.cons),borderColor:'#f0b90b',borderDash:[6,4],tension:.25,pointRadius:0,borderWidth:1.8},
          {label:'累計投入本金',data:proj.map(r=>r.cost),borderColor:'#8b98ad',borderDash:[3,3],pointRadius:0,borderWidth:1.3},
        ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
          plugins:{tooltip:wanTip},scales:{x:{ticks:{maxTicksLimit:11}},y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
        <table style={{marginTop:12}}><thead><tr><th>期間</th><th>累計投入</th><th>基準 {p.r}%</th><th>保守 {p.r2}%</th><th>基準損益</th></tr></thead>
        <tbody>{[35,59,119].map(i=>{const r=proj[i]; if(!r) return null; const y=Math.round((i+1)/12);
          return <tr key={i}><td>{y} 年後（{r.ym}）</td><td>{fmtNum(r.cost)} 萬</td><td>{fmtNum(r.base)} 萬</td><td>{fmtNum(r.cons)} 萬</td>
            <td className={r.base>=r.cost?'up':'down'}>{r.base>=r.cost?'+':''}{fmtNum(r.base-r.cost)} 萬</td></tr>;})}
        </tbody></table>
      </div>
      <div>
        <div className="card">
          <h3>試算參數</h3>
          <CurveIn p={p} setP={setP} k="w0" lab="期初單筆投入（萬）" step={10}/>
          <CurveIn p={p} setP={setP} k="dca" lab="每月定期定額（萬）" step={0.5}/>
          <CurveIn p={p} setP={setP} k="r" lab="基準年化報酬率（%）" step={0.5}/>
          <CurveIn p={p} setP={setP} k="r2" lab="保守年化報酬率（%）" step={0.5}/>
          {st && <button className="btn ghost" style={{width:'100%'}}
            onClick={()=>setP(o=>({...o,r:Math.round(st.cagr*1000)/10,r2:Math.max(0,Math.round((st.cagr-0.04)*1000)/10)}))}>
            ↺ 還原為歷史 CAGR（{(st.cagr*100).toFixed(1)}%）</button>}
        </div>
        <div className="card">
          <h3>長線提醒</h3>
          <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.8}}>
            ・過去 10 年 CAGR 多半含大多頭行情，直接外推容易高估，退休規劃建議看保守線。<br/>
            ・定期定額的價值在紀律與平均成本，適合無暇看盤的長線投資人。<br/>
            ・債券（TLT/IEF）與黃金的主要功能是降低整體波動，報酬預期應低於股票。<br/>
            ・單一個股（含台積電）波動與回撤遠大於指數 ETF，配置比重宜設上限。
          </div>
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- 規劃試算（空白填寫版，與示範資料無關） ---------- */
const PLAN_KEY = 'inv_plan_inputs';
const PCLS = [
 {id:'cash', nm:'現金/定存', col:'#f0b90b', vol:1},
 {id:'bond', nm:'債券',      col:'#a78bfa', vol:7},
 {id:'gold', nm:'黃金',      col:'#fb923c', vol:15},
 {id:'dca',  nm:'定期定額基金', col:'#22d3ee', vol:14},
 {id:'stock',nm:'股票',      col:'#4f8cff', vol:25},
 {id:'etf',  nm:'ETF',       col:'#2ecc8f', vol:16},
];
const PMIX = [
 {id:'cons', nm:'保守型',     ds:'距退休 5 年內／低風險承受', mix:{cash:10,bond:40,gold:15,dca:10,stock:0, etf:25}},
 {id:'bal',  nm:'平衡型',     ds:'距退休 5–10 年／中等風險',   mix:{cash:5, bond:25,gold:10,dca:10,stock:10,etf:40}},
 {id:'agg',  nm:'積極型',     ds:'距退休 10 年以上／能抗波動', mix:{cash:5, bond:10,gold:5, dca:10,stock:20,etf:50}},
 {id:'lazy', nm:'懶人指數型', ds:'極簡管理，全市場 ETF 為主',  mix:{cash:5, bond:15,gold:0, dca:10,stock:0, etf:70}},
];
const EDU_DEFAULT = {pub:{pre:6,elem:2,jun:2,sen:3,uni:6}, priv:{pre:22,elem:25,jun:28,sen:13,uni:11}};
const EDU_STAGES=[['pre','幼兒園'],['elem','國小'],['jun','國中'],['sen','高中'],['uni','大學']];
function eduStage(age){ age=Number(age)||0; if(age>=3&&age<6)return'pre'; if(age>=6&&age<12)return'elem'; if(age>=12&&age<15)return'jun'; if(age>=15&&age<18)return'sen'; if(age>=18&&age<22)return'uni'; return null; }
function eduCostYear(kids, cost, yOffset){ const C=cost||EDU_DEFAULT; let sum=0; (kids||[]).forEach(k=>{ const st=eduStage((Number(k.age)||0)+yOffset); if(st) sum+=(k.priv?C.priv[st]:C.pub[st]); }); return sum; }
function KidsCard({kids, eduCost, setKids, setCost}){
  const C=eduCost||EDU_DEFAULT;
  const setCount=n=>{ const a=[...(kids||[])]; while(a.length<n)a.push({age:6,priv:false}); a.length=n; setKids(a); };
  const setKid=(i,k,v)=>setKids((kids||[]).map((x,j)=>j===i?{...x,[k]:v}:x));
  const setC=(grp,st,v)=>setCost({...C,[grp]:{...C[grp],[st]:(parseFloat(v)||0)}});
  let total=0,maxY=0; for(let y=0;y<25;y++){ const c=eduCostYear(kids,C,y); if(c>0){total+=c;maxY=y;} }
  const avg=total>0?total/(maxY+1):0;
  const sLabel={pre:'幼兒園',elem:'國小',jun:'國中',sen:'高中',uni:'大學'};
  return <div className="card" style={{border:'1px solid rgba(251,146,60,.4)'}}>
    <h3>👨‍👩‍👧 孩子教育金<small>列入退休前成本（逐年扣除）</small></h3>
    <div className="field"><label>孩子人數</label>
      <select value={(kids||[]).length} onChange={e=>setCount(parseInt(e.target.value))}>
        {[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n} 位</option>)}</select></div>
    {(kids||[]).map((k,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
      <span style={{fontSize:12,minWidth:40,color:'var(--muted)'}}>第{i+1}位</span>
      <input type="number" value={k.age||''} placeholder="年齡" onChange={e=>setKid(i,'age',parseInt(e.target.value)||0)}
        style={{flex:1,background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:6,color:'var(--text)',padding:'7px 9px'}}/>
      <select value={k.priv?1:0} onChange={e=>setKid(i,'priv',e.target.value==='1')}
        style={{flex:1,background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:6,color:'var(--text)',padding:'7px 9px'}}>
        <option value={0}>公立</option><option value={1}>私立</option></select>
      <span style={{fontSize:11,color:'var(--muted)',minWidth:48}}>{eduStage(k.age)?sLabel[eduStage(k.age)]:(Number(k.age)<3?'學齡前':'已畢業')}</span>
    </div>)}
    {(kids||[]).length>0 && <div style={{fontSize:13,lineHeight:1.8,marginTop:4}}>
      教育金總額約 <b className="down">{fmtNum(total)} 萬</b>，平均每年 <b>{avg.toFixed(1)} 萬</b>，約 {maxY} 年後結束。
      <span style={{color:'var(--muted)'}}>　此成本已逐年從投資試算扣除。</span></div>}
    <details style={{marginTop:10}}>
      <summary style={{cursor:'pointer',color:'var(--muted)',fontSize:12}}>各階段年費用設定（萬/年・可改成你查到的最新數字）</summary>
      <div style={{marginTop:8}}>
        {[['pub','公立'],['priv','私立']].map(([grp,gl])=><div key={grp} style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:11,minWidth:32,color:'var(--muted)'}}>{gl}</span>
          {EDU_STAGES.map(([st,sl])=><input key={st} type="number" value={C[grp][st]||''} title={sl}
            onChange={e=>setC(grp,st,e.target.value)}
            style={{width:'18%',background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:6,color:'var(--text)',padding:'5px 4px',fontSize:12,textAlign:'center'}}/>)}
        </div>)}
        <div style={{fontSize:10.5,color:'var(--muted)'}}>順序：幼兒園／國小／國中／高中／大學。預設依 2025 市場概況（公立國中小近免費、私校學雜費較高），實際依學校而異。</div>
      </div>
    </details>
  </div>;
}
const DEF_PLAN = {
  age:40, retireAge:60, salary:6, salaryG:3, investRate:30,
  holdings:{cash:0,bond:0,gold:0,dca:0,stock:0,etf:0},
  returns:{cash:1.5,bond:4,gold:5,dca:6,stock:9,etf:7},
  mix:{cash:5,bond:25,gold:10,dca:10,stock:10,etf:40},
  goal:50000000,
  selfPct:6, inclEmployer:true, pensionR:4, taxRate:12,
  laborYears:30,
  kids:[], eduCost:EDU_DEFAULT,
};
/* 政府勞退參數預設（未連 Supabase 時用；連線後從 inv_gov_data 覆蓋） */
const GOV_DEFAULT = {
  pension_fund_avg:{label:'勞退新制基金長期平均年化報酬', value:4.0, unit:'%', as_of:'2025', source:'https://www.blf.gov.tw/49200/49245/49253/71761/'},
  pension_guarantee:{label:'保證收益率（不低於2年期定存）', value:1.5, unit:'%', as_of:'2025', source:'https://www.blf.gov.tw/'},
  contrib_cap:{label:'月提繳工資上限', value:150000, unit:'元', as_of:'2025', source:'https://www.bli.gov.tw/0012933.html'},
  self_max_pct:{label:'個人自願提繳上限', value:6, unit:'%', as_of:'2025', source:'https://www.bli.gov.tw/0108501.html'},
};
const TW_TAX_BRACKETS = [5,12,20,30,40];
/* 勞退自提試算：提繳工資上限 cap、自提＋雇主6%、複利至退休、節稅 */
function calcPension(inp, cap){
  const CAP = cap || 150000;
  const salY = (Number(inp.salary)||0)*10000;       // 月薪（元）
  const g = (Number(inp.salaryG)||0)/100;
  const years = Math.max(0,(Number(inp.retireAge)||60)-(Number(inp.age)||40));
  const mr = Math.pow(1+(Number(inp.pensionR)||0)/100, 1/12);
  const selfPct = Math.min(6, Math.max(0, Number(inp.selfPct)||0));
  let pot=0, contribSelf=0, contribEmp=0;
  for(let y=0; y<years; y++){
    const base = Math.min(salY*Math.pow(1+g,y), CAP);  // 當年月提繳工資（封頂）
    const selfM = base*selfPct/100;
    const empM = inp.inclEmployer? base*0.06 : 0;
    for(let m=0;m<12;m++){ pot = pot*mr + selfM + empM; contribSelf+=selfM; contribEmp+=empM; }
  }
  const base0 = Math.min(salY, CAP);
  const selfMonthly = base0*selfPct/100;
  const annualSelf = selfMonthly*12;
  const taxSaveYr = annualSelf*(Number(inp.taxRate)||0)/100;
  return {
    base0, selfMonthly, empMonthly: inp.inclEmployer? base0*0.06:0,
    pot, contribSelf, contribEmp, contrib:contribSelf+contribEmp,
    gain: pot-contribSelf-contribEmp,
    annualSelf, taxSaveYr, taxSaveTotal: taxSaveYr*years, years, capped: salY>CAP,
  };
}
/* 勞保老年年金（A/B式取高，投保薪資上限45800，需年資15年，65歲請領） */
function calcLaborPension(salaryWan, years){
  const base=Math.min((Number(salaryWan)||0)*10000, 45800);
  const y=Number(years)||0;
  if(y<15) return {monthly:0, base, eligible:false, years:y};
  const A=base*y*0.00775+3000, B=base*y*0.0155;
  return {monthly:Math.max(A,B), base, eligible:true, years:y, useB:B>=A};
}
/* 蒙地卡羅：每年報酬 ~ Normal(mean,vol)，退休後扣政府年金後提領 */
function gaussian(){ let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function monteCarlo(p, vol, pensionAnnual, runs){
  const endYears=Math.max(1,100-p.age0); const paths=[]; let success=0;
  for(let i=0;i<runs;i++){
    let v=p.asset0; const path=[];
    for(let y=1;y<=endYears;y++){
      const year=p.year0+y; const retired=year>=p.retireYear;
      const r=(retired?p.rRetire:p.rWork)+vol*gaussian();
      const invest=retired?0:p.monthly*12;
      const gross=retired? p.withdraw0*Math.pow(1+p.inflation,y):0;
      const pens=retired? (pensionAnnual||0)*Math.pow(1+p.inflation,y):0;
      const wd=Math.max(0,gross-pens);
      v=Math.max(0,(v-wd))*(1+r)+invest;
      path.push(v);
    }
    if(v>0) success++;
    paths.push(path);
  }
  const p10=[],p50=[],p90=[],years=[];
  for(let y=0;y<endYears;y++){ const col=paths.map(pa=>pa[y]).sort((a,b)=>a-b);
    p10.push(col[Math.floor(runs*0.1)]); p50.push(col[Math.floor(runs*0.5)]); p90.push(col[Math.floor(runs*0.9)]); years.push(p.year0+y+1); }
  return {successRate:success/runs, p10,p50,p90, years};
}
function simPlan(inp, mix, salaryGOverride){
  const years = Math.max(1, (inp.retireAge||60) - (inp.age||40));
  const g = (salaryGOverride!=null? salaryGOverride : inp.salaryG)/100;
  const pos = {}; PCLS.forEach(c=>pos[c.id]=Number(inp.holdings[c.id])||0);
  let salary = Number(inp.salary)||0, invested = 0;
  const total = ()=>PCLS.reduce((s,c)=>s+pos[c.id],0);
  const rows = [{year:0, age:inp.age, ...pos, total:total(), invested:0, salary}];
  for(let y=1; y<=years; y++){
    const annualInvest = Math.max(0, salary*12*((Number(inp.investRate)||0)/100) - eduCostYear(inp.kids, inp.eduCost, y-1));
    PCLS.forEach(c=>{
      pos[c.id] = pos[c.id]*(1+(Number(inp.returns[c.id])||0)/100) + annualInvest*((Number(mix[c.id])||0)/100);
    });
    invested += annualInvest;
    salary *= (1+g);
    rows.push({year:y, age:inp.age+y, ...pos, total:total(), invested, salary});
  }
  return rows;
}
function mixVol(mix){ // 加權年波動估計
  return PCLS.reduce((s,c)=>s+(Number(mix[c.id])||0)/100*c.vol, 0);
}
function simToTarget(inp, mix, target){
  const pos={}; PCLS.forEach(c=>pos[c.id]=Number(inp.holdings[c.id])||0);
  let salary=Number(inp.salary)||0;
  let total=PCLS.reduce((s,c)=>s+pos[c.id],0);
  if(total>=target) return {age:Number(inp.age)||0};
  for(let y=1;y<=60;y++){
    const ai=Math.max(0, salary*12*((Number(inp.investRate)||0)/100) - eduCostYear(inp.kids, inp.eduCost, y-1));
    PCLS.forEach(c=>{ pos[c.id]=pos[c.id]*(1+(Number(inp.returns[c.id])||0)/100)+ai*((Number(mix[c.id])||0)/100); });
    salary*=1+(Number(inp.salaryG)||0)/100;
    total=PCLS.reduce((s,c)=>s+pos[c.id],0);
    if(total>=target) return {age:(Number(inp.age)||0)+y};
  }
  return null;
}
function requiredSalary(inp, mix, target){
  const test=s=>{ const sim=simPlan({...inp,salary:s},mix); return sim[sim.length-1].total; };
  if(test(0)>=target) return 0;
  let lo=0, hi=1;
  while(test(hi)<target && hi<1e6) hi*=2;
  if(hi>=1e6) return null;
  for(let i=0;i<60;i++){ const mid=(lo+hi)/2; if(test(mid)>=target) hi=mid; else lo=mid; }
  return hi;
}
function requiredRate(inp, mix, target){
  const test=r=>{ const sim=simPlan({...inp,investRate:r},mix); return sim[sim.length-1].total; };
  if(test(0)>=target) return 0;
  if(test(100)<target) return null;
  let lo=0, hi=100;
  for(let i=0;i<40;i++){ const mid=(lo+hi)/2; if(test(mid)>=target) hi=mid; else lo=mid; }
  return hi;
}
function Planner(){
  const [inp,setInp] = useState(()=>({...DEF_PLAN, ...loadJSON(PLAN_KEY,{})}));
  const [preset,setPreset] = useState('custom');
  const [presets,setPresets] = useState(PMIX);
  const [planName,setPlanName] = useState('');
  const [savedPlans,setSavedPlans] = useState([]);
  const [supaMsg,setSupaMsg] = useState('');
  const [gov,setGov] = useState(GOV_DEFAULT);
  const [govSrc,setGovSrc] = useState('default');
  const cfg = loadCfg();
  const supaOn = !!(cfg.url && cfg.key);
  const refreshPlans = ()=>supaSelect('inv_plans','select=plan_name,updated_at&order=updated_at.desc').then(setSavedPlans).catch(()=>{});
  useEffect(()=>{ if(!supaOn) return;
    supaSelect('inv_plan_presets','select=*&order=sort_order').then(rows=>{
      if(rows && rows.length) setPresets(rows.map(r=>({id:r.id, nm:r.nm, ds:r.ds, mix:r.mix})));
    }).catch(()=>{});
    supaSelect('inv_gov_data','select=*').then(rows=>{
      if(rows && rows.length){ const g={...GOV_DEFAULT};
        rows.forEach(r=>{ g[r.k]={label:r.label, value:+r.value, unit:r.unit, as_of:r.as_of, source:r.source}; });
        setGov(g); setGovSrc('cloud');
      }
    }).catch(()=>{});
    refreshPlans();
  },[]);
  const savePlan = async ()=>{
    if(!planName.trim()){ setSupaMsg('請先輸入存檔名稱'); return; }
    try{ await supaUpsert('inv_plans',{plan_name:planName.trim(), email:cfg.email||null, data:inp, updated_at:new Date().toISOString()});
      setSupaMsg('✓ 已儲存到雲端'); refreshPlans(); }
    catch(e){ setSupaMsg('✗ '+e.message); }
  };
  const loadPlan = async (nm)=>{
    try{ const r=await supaSelect('inv_plans','select=data&plan_name=eq.'+encodeURIComponent(nm)+'&limit=1');
      if(r && r[0]){ setInp({...DEF_PLAN, ...r[0].data}); setPlanName(nm); setPreset('custom'); setSupaMsg('✓ 已載入「'+nm+'」'); } }
    catch(e){ setSupaMsg('✗ '+e.message); }
  };
  useEffect(()=>{ saveJSON(PLAN_KEY, inp); },[inp]);
  const set = (k,v)=>setInp(o=>({...o,[k]:v}));
  const setH = (k,v)=>setInp(o=>({...o,holdings:{...o.holdings,[k]:v}}));
  const setR = (k,v)=>setInp(o=>({...o,returns:{...o.returns,[k]:v}}));
  const setM = (k,v)=>{ setPreset('custom'); setInp(o=>({...o,mix:{...o.mix,[k]:v}})); };
  const [applyMsg,setApplyMsg] = useState('');
  const applyPreset = (pm)=>{ setPreset(pm.id); setInp(o=>({...o,mix:{...pm.mix}})); };
  const applySuggest = ()=>{ applyPreset(suggest); setApplyMsg('✓ 已把「'+suggest.nm+'」比例填入上方 ③ 新資金配置'); setTimeout(()=>setApplyMsg(''),4000); };
  const mixSum = PCLS.reduce((s,c)=>s+(Number(inp.mix[c.id])||0),0);
  const years = Math.max(1,(inp.retireAge||60)-(inp.age||40));
  const sim = useMemo(()=>simPlan(inp, inp.mix),[inp]);
  const last = sim[sim.length-1];
  const cur = sim[0].total;
  const monthlyInvest = (Number(inp.salary)||0)*((Number(inp.investRate)||0)/100);
  /* 各策略比較（同樣輸入，不同配置） */
  const compare = useMemo(()=>{
    const out = presets.map(pm=>{
      const s = simPlan(inp, pm.mix);
      return {id:pm.id, nm:pm.nm, ds:pm.ds, mix:pm.mix, rows:s, end:s[s.length-1]};
    });
    out.push({id:'custom', nm:'自訂配置', ds:'你目前設定的比例', mix:inp.mix, rows:sim, end:last});
    return out;
  },[inp,presets]);
  const best = compare.reduce((a,b)=>b.end.total>a.end.total?b:a);
  /* 加薪敏感度 */
  const sens = useMemo(()=>[0,3,5,10].map(gv=>{
    const s = simPlan(inp, inp.mix, gv);
    return {g:gv, total:s[s.length-1].total, invested:s[s.length-1].invested};
  }),[inp]);
  const suggest = presets.find(p=>p.id===(years>10?'agg':years>5?'bal':'cons')) || presets[0];
  const goal = Number(inp.goal)||0;        // 元
  const goalWan = goal/10000;              // 萬（試算函式以萬為單位）
  const goalAge = useMemo(()=>{ if(!goalWan) return null; const r=simToTarget(inp, inp.mix, goalWan); return r? r.age : null; },[inp]);
  const reqSalary = useMemo(()=>goalWan? requiredSalary(inp, inp.mix, goalWan) : null,[inp]);
  const reqRate = useMemo(()=>goalWan? requiredRate(inp, inp.mix, goalWan) : null,[inp]);
  const compColors = {cons:'#f0b90b', bal:'#4f8cff', agg:'#ff5d6c', lazy:'#2ecc8f', custom:'#e879f9'};
  /* 勞退自提（萬為單位顯示，計算用元） */
  const pensionCap = (gov.contrib_cap && gov.contrib_cap.value) || 150000;
  const pen = useMemo(()=>calcPension(inp, pensionCap),[inp,pensionCap]);
  const labor = calcLaborPension(inp.salary, inp.laborYears);
  const penPotWan = pen.pot/10000, penGainWan = pen.gain/10000;
  const grandTotal = last.total + penPotWan;   // 投資 + 勞退專戶
  return <div>
    <div className="page-title">規劃試算（填入你的數字）</div>
    <div className="page-sub">空白表單：填現金、薪水與各類投資金額 → 自動產生到退休的資產曲線，並比較不同配置策略與加薪情境。輸入自動儲存在本機。</div>
    <div className="grid32">
      <div>
        <div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))'}}>
          <div className="kpi"><div className="lab">目前總資產</div><div className="val">{fmtNum(cur)} 萬</div>
            <div className="sub">六類部位合計</div></div>
          <div className="kpi"><div className="lab">每月可投入</div><div className="val">{monthlyInvest.toFixed(1)} 萬</div>
            <div className="sub">月薪 {inp.salary||0} 萬 × {inp.investRate||0}%</div></div>
          <div className="kpi"><div className="lab">退休（{inp.retireAge} 歲）投資資產</div><div className="val up">{fmtNum(last.total)} 萬</div>
            <div className="sub">{years} 年後・自訂配置</div></div>
          <div className="kpi" style={{background:'linear-gradient(180deg,rgba(46,204,143,.10),transparent)'}}>
            <div className="lab">退休總資產（含勞退專戶）</div><div className="val up">{fmtNum(grandTotal)} 萬</div>
            <div className="sub">投資 {fmtNum(last.total)} ＋ 勞退 {fmtNum(penPotWan)} 萬</div></div>
        </div>
        <div className="card">
          <h3>資產成長曲線（自訂配置・各類別堆疊）</h3>
          <ChartBox type="line" height={300} data={{labels:sim.map(r=>r.age+'歲'),datasets:PCLS.map(c=>(
            {label:c.nm,data:sim.map(r=>r[c.id]),borderColor:c.col,backgroundColor:c.col+'66',fill:true,tension:.25,pointRadius:0,borderWidth:1}
          ))}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{y:{stacked:true,ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}},x:{ticks:{maxTicksLimit:12}}}}}/>
        </div>
        <div className="card">
          <h3>配置策略比較<small>同樣的薪水與投入，不同分配方式的差異</small></h3>
          <ChartBox type="line" height={300} data={{labels:sim.map(r=>r.age+'歲'),datasets:compare.map(s=>(
            {label:s.nm,data:s.rows.map(r=>r.total),borderColor:compColors[s.id],
             borderWidth:s.id==='custom'?2.5:1.6,borderDash:s.id==='custom'?[]:[6,4],tension:.25,pointRadius:0}
          ))}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}},x:{ticks:{maxTicksLimit:12}}}}}/>
          <table style={{marginTop:12}}><thead><tr><th>策略</th><th>退休總資產</th><th>投資收益</th><th>預估年波動</th><th>大跌年衝擊*</th><th>說明</th></tr></thead>
          <tbody>{compare.map(s=>{
            const vol=mixVol(s.mix);
            return <tr key={s.id} style={s.id===best.id?{background:'rgba(46,204,143,.07)'}:null}>
              <td><span style={{color:compColors[s.id],fontWeight:700}}>●</span> {s.nm}{s.id===best.id?' 🏆':''}</td>
              <td>{fmtNum(s.end.total)} 萬</td>
              <td>{fmtNum(s.end.total-cur-s.end.invested)} 萬</td>
              <td>±{vol.toFixed(1)}%</td>
              <td className="down">-{fmtNum(s.end.total*vol*2/100)} 萬</td>
              <td style={{textAlign:'left',color:'var(--muted)',whiteSpace:'normal'}}>{s.ds}</td></tr>;
          })}</tbody></table>
          <div style={{color:'var(--muted)',fontSize:12,marginTop:8}}>
            * 大跌年衝擊＝以「2 倍年波動」粗估單一壞年度的可能跌幅。報酬最高的策略波動也最大，「最好」取決於你能承受多少下跌——距離退休越近，越應該往保守配置移動。</div>
        </div>
        <div className="card">
          <h3>加薪敏感度<small>年薪成長率不同時，退休總資產差多少（自訂配置）</small></h3>
          <ChartBox type="bar" height={230} data={{labels:sens.map(s=>'年薪成長 '+s.g+'%'),datasets:[
            {label:'退休總資產',data:sens.map(s=>s.total),backgroundColor:sens.map(s=>s.g===Number(inp.salaryG)?'#2ecc8f':'rgba(79,140,255,.65)')},
            {label:'累計投入',data:sens.map(s=>s.invested+cur),backgroundColor:'rgba(139,152,173,.45)'},
          ]}} options={{maintainAspectRatio:false,
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
          <div style={{color:'var(--muted)',fontSize:12,marginTop:8}}>
            加薪後若維持相同投入比例（{inp.investRate||0}%），多出的投入會按你的配置比例自動分配。
            例：年薪成長 10% 相比 0%，退休資產多 {fmtNum(sens[3].total-sens[0].total)} 萬。
            想再放大效果，可以把加薪的部分優先提高「投入比例」。</div>
        </div>
      </div>
      <div>
        <div className="card">
          <h3>① 基本資料與薪資</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="field"><label>目前年齡</label><NumIn v={inp.age} on={v=>set('age',v)}/></div>
            <div className="field"><label>預計退休年齡</label><NumIn v={inp.retireAge} on={v=>set('retireAge',v)}/></div>
            <div className="field"><label>月薪（元）</label><YuanIn wan={inp.salary} on={v=>set('salary',v)} step={1000}/>
              <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{inp.salary?fmtWanHint(inp.salary):'例：6萬填 60000'}</div></div>
            <div className="field"><label>年薪成長率（%）</label><NumIn v={inp.salaryG} on={v=>set('salaryG',v)} step={1}/></div>
          </div>
          <div className="field"><label>薪資投入比例（%）— 每月拿多少 % 薪水投資</label>
            <NumIn v={inp.investRate} on={v=>set('investRate',v)} step={5}/></div>
        </div>
        <KidsCard kids={inp.kids||[]} eduCost={inp.eduCost} setKids={v=>set('kids',v)} setCost={v=>set('eduCost',v)}/>
        <div className="card">
          <h3>② 目前各類資產（元）<small>沒有就留 0・目前合計 {fmtNum(cur)} 萬</small></h3>
          {PCLS.map(c=><div className="field" key={c.id}>
            <label><span style={{color:c.col}}>●</span> {c.nm}　目前金額（元）／ 預期年化（%）</label>
            <div style={{display:'flex',gap:8}}>
              <YuanIn wan={inp.holdings[c.id]} on={v=>setH(c.id,v)} step={10000}/>
              <NumIn v={inp.returns[c.id]} on={v=>setR(c.id,v)} step={0.5} w={86}/>
            </div>
            {inp.holdings[c.id]>0 && <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{fmtWanHint(inp.holdings[c.id])}</div>}
          </div>)}
          <div style={{color:'var(--muted)',fontSize:11.5,lineHeight:1.6}}>
            預設年化僅供參考（現金1.5／債券4／黃金5／定期定額6／股票9／ETF 7），可依自己的判斷修改；歷史數據可到「資產曲線」頁查 10 年 CAGR。</div>
        </div>
        <div className="card">
          <h3>🎯 目標反推</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="field"><label>退休年齡（歲）</label>
              <NumIn v={inp.retireAge} on={v=>set('retireAge',Math.round(v))} step={1}/></div>
            <div className="field"><label>退休年份（西元）</label>
              <NumIn v={(new Date().getFullYear())+((Number(inp.retireAge)||0)-(Number(inp.age)||0))}
                on={v=>set('retireAge',(Number(inp.age)||0)+(Math.round(v)-(new Date().getFullYear())))} step={1}/></div>
          </div>
          <div style={{color:'var(--muted)',fontSize:11,marginTop:-2,marginBottom:6}}>兩者連動（依目前年齡 {inp.age||0} 歲、今年 {new Date().getFullYear()} 推算）。修改任一即更新下方反推。</div>
          <div className="field"><label>目標總資產（元）　※ 5千萬填 50000000、1億填 100000000</label>
            <NumIn v={inp.goal} on={v=>set('goal',v)} step={1000000}/>
            <div style={{color:goal>0?'var(--accent)':'var(--muted)',fontSize:12,marginTop:5}}>
              {goal>0? '＝ '+fmtNum(goalWan)+' 萬'+(goalWan>=10000? '（'+(goalWan/10000).toFixed(goalWan%10000?2:0)+' 億）':'') : '請輸入目標金額（元）'}</div></div>
          {goal>0 && <div style={{fontSize:13,lineHeight:2.1}}>
            <div>① 依目前條件，{goalAge!=null?
              <span>約 <b className="up" style={{fontSize:16}}>{goalAge} 歲</b>達標
                {goalAge<=inp.retireAge? <span className="up">（早於預計退休年齡 {inp.retireAge}，可考慮提前退休 ✓）</span>
                  : <span className="down">（晚於預計退休 {inp.retireAge} 歲，需調整下方 ② 或 ③）</span>}</span>
              : <span className="down">100 歲前無法達標，請調整參數</span>}</div>
            <div>② 想在 <b>{inp.retireAge} 歲</b>達標，月薪需約 {reqSalary!=null?
              <span><b className="up" style={{fontSize:16}}>{reqSalary<100? reqSalary.toFixed(1): fmtNum(reqSalary)} 萬</b>
                （目前 {inp.salary||0} 萬{reqSalary>(Number(inp.salary)||0)? '，還差 '+(reqSalary-(Number(inp.salary)||0)).toFixed(1)+' 萬' : '，已足夠 ✓'}）</span>
              : <span className="down">不可行</span>}</div>
            <div>③ 或月薪不變，投入比例需 {reqRate!=null?
              <span><b className="up" style={{fontSize:16}}>{Math.ceil(reqRate)}%</b>（目前 {inp.investRate||0}%{Math.ceil(reqRate)<=(Number(inp.investRate)||0)?'，已足夠 ✓':''}）</span>
              : <span className="down">100% 投入也不足 — 需提高報酬、延後退休或加薪</span>}</div>
          </div>}
          <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
            ① 假設達標前持續工作、依目前比例投入；②③ 以目前的配置與報酬假設反推，僅供方向參考。</div>
        </div>
        <div className="card" style={{border:'1px solid rgba(46,204,143,.4)'}}>
          <h3>🏛 勞退自提 6%（政府退休金）<small>自提可節稅＋保證收益</small></h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="field"><label>自提比例（0–6%）</label><NumIn v={inp.selfPct} on={v=>set('selfPct',Math.min(6,Math.max(0,v)))} step={1}/></div>
            <div className="field"><label>勞退基金預估年化（%）</label><NumIn v={inp.pensionR} on={v=>set('pensionR',v)} step={0.5}/></div>
            <div className="field"><label>你的綜所稅率（%）</label>
              <select value={inp.taxRate} onChange={e=>set('taxRate',parseInt(e.target.value))}>
                {TW_TAX_BRACKETS.map(b=><option key={b} value={b}>{b}%</option>)}</select></div>
            <div className="field"><label>計入雇主提撥6%</label>
              <select value={inp.inclEmployer?1:0} onChange={e=>set('inclEmployer',e.target.value==='1')}>
                <option value={1}>是（含雇主）</option><option value={0}>否（只算自提）</option></select></div>
          </div>
          <div style={{fontSize:13,lineHeight:1.95,marginTop:4}}>
            <div>每月自提 <b className="up">{Math.round(pen.selfMonthly).toLocaleString()}</b> 元
              {pen.empMonthly>0 && <span>＋雇主 {Math.round(pen.empMonthly).toLocaleString()} 元</span>}</div>
            <div>每年節稅約 <b className="up">{Math.round(pen.taxSaveYr).toLocaleString()}</b> 元
              （{years} 年共省 <b className="up">{fmtNum(pen.taxSaveTotal/10000)} 萬</b>）</div>
            <div>退休時勞退專戶累積 <b className="up" style={{fontSize:15}}>{fmtNum(penPotWan)} 萬</b>
              （投入 {fmtNum(pen.contrib/10000)}＋收益 {fmtNum(penGainWan)} 萬）</div>
          </div>
          <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
            自提部分不計入當年度所得（直接節稅）；提繳工資上限 {(pensionCap/10000).toFixed(0)} 萬/月（自提最高 6%＝{Math.round(pensionCap*0.06).toLocaleString()} 元/月）。
            {pen.capped && '※ 你的月薪已超過提繳上限，自提以上限計。'}
            勞退新制有「不低於 2 年定存」的保證收益，須年滿 60 歲才能請領。
          </div>
        </div>
        <div className="card" style={{border:'1px solid rgba(167,139,250,.4)'}}>
          <h3>🏛 勞保老年年金<small>退休後每月領、終身</small></h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="field"><label>投保年資（年）</label><NumIn v={inp.laborYears} on={v=>set('laborYears',v)} step={1}/></div>
            <div className="field"><label>平均月投保薪資（元）</label>
              <input value={Math.min((Number(inp.salary)||0)*10000,45800).toLocaleString()} disabled style={{opacity:.7}}/></div>
          </div>
          <div style={{fontSize:13,lineHeight:1.95}}>
            {labor.eligible? <div>預估每月可領 <b className="up" style={{fontSize:16}}>{Math.round(labor.monthly).toLocaleString()}</b> 元
              （年 {fmtNum(labor.monthly*12/10000)} 萬）<span style={{color:'var(--muted)'}}>・採{labor.useB?'B':'A'}式</span></div>
            : <div className="down">投保年資需滿 15 年才能請領年金（目前 {labor.years} 年）</div>}
          </div>
          <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
            取高者：A＝投保薪資×年資×0.775%＋3000；B＝投保薪資×年資×1.55%。月投保薪資上限 45,800 元，
            法定請領年齡 65 歲。此為勞保年金，與上方勞退（個人專戶）分開、可同時領。
          </div>
        </div>
        <div className="card">
          <h3>🏛 政府勞退數據<small>{govSrc==='cloud'?'雲端同步':'內建參考值'}</small></h3>
          <table style={{fontSize:12.5}}><tbody>
            {Object.entries(gov).map(([k,g])=><tr key={k}>
              <td style={{textAlign:'left'}}>{g.label}</td>
              <td><b>{g.unit==='元'? (+g.value).toLocaleString(): g.value}{g.unit==='%'?'%':g.unit==='元'?' 元':''}</b></td>
              <td style={{textAlign:'right',color:'var(--muted)'}}>{g.source?<a href={g.source} target="_blank" rel="noopener" style={{color:'var(--accent)'}}>來源↗</a>:''}</td>
            </tr>)}
          </tbody></table>
          <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
            資料時點 {gov.pension_fund_avg.as_of}。{govSrc==='cloud'?'數值由後台 inv_gov_data 維護，更新後所有客戶端即時同步。':'連線 Supabase 後改由雲端 inv_gov_data 即時同步；目前為內建參考值。'}
            勞退基金實際收益逐月公告，請以勞動基金運用局官網為準。
          </div>
        </div>
        <div className="card">
          <h3>③ 新資金配置比例（%）<small>合計需 100</small></h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
            {presets.map(pm=><button key={pm.id} className={'btn ghost'} style={preset===pm.id?{borderColor:'var(--accent)',color:'var(--accent)'}:null}
              onClick={()=>applyPreset(pm)}>{pm.nm}</button>)}
          </div>
          {PCLS.map(c=><div className="field" key={c.id} style={{marginBottom:8}}>
            <label><span style={{color:c.col}}>●</span> {c.nm}</label>
            <NumIn v={inp.mix[c.id]} on={v=>setM(c.id,v)} step={5}/>
          </div>)}
          <div className="bar-mini" style={{marginBottom:8}}>{PCLS.map(c=><div key={c.id}
            style={{width:(Number(inp.mix[c.id])||0)+'%',background:c.col}} title={c.nm}></div>)}</div>
          <div className={mixSum===100?'up':'down'} style={{fontSize:13,fontWeight:600}}>
            合計 {mixSum}%{mixSum===100?' ✓':'（請調整為 100%）'}</div>
        </div>
        <div className="card">
          <h3>系統建議</h3>
          <div style={{fontSize:13,lineHeight:1.8}}>
            距離退休還有 <b>{years} 年</b>，建議參考 <b style={{color:'var(--accent)'}}>{suggest.nm}</b>：
            <div className="bar-mini" style={{margin:'8px 0'}}>{PCLS.map(c=><div key={c.id}
              style={{width:(suggest.mix[c.id]||0)+'%',background:c.col}} title={c.nm+' '+(suggest.mix[c.id]||0)+'%'}></div>)}</div>
            <span style={{color:'var(--muted)',fontSize:12}}>{PCLS.map(c=>c.nm+' '+(suggest.mix[c.id]||0)+'%').join('・')}</span>
          </div>
          <div style={{color:'var(--muted)',fontSize:12,marginTop:10,lineHeight:1.7}}>
            原則：越接近退休，債券與現金比重越高；每年或每半年再平衡一次即可。
            按下方按鈕，會把上面這組建議比例自動填入「③ 新資金配置比例」欄位。</div>
          <button className="btn" style={{width:'100%',marginTop:10}} onClick={applySuggest}>套用建議配置到 ③</button>
          {applyMsg && <div className="up" style={{fontSize:12.5,marginTop:8,textAlign:'center',fontWeight:600}}>{applyMsg}</div>}
          <button className="btn ghost" style={{width:'100%',marginTop:8}} onClick={()=>{setInp({...DEF_PLAN}); setPreset('custom'); setApplyMsg('');}}>↺ 全部重設</button>
        </div>        <div className="card">
          <h3>☁ 雲端規劃存檔<small>{supaOn?'已連線':'未連線'}</small></h3>
          {supaOn ? <div>
            <div className="field"><label>存檔名稱</label>
              <input value={planName} placeholder="例：王先生退休規劃" onChange={e=>setPlanName(e.target.value)}/></div>
            <button className="btn" onClick={savePlan}>儲存到雲端</button>
            <div style={{marginTop:8,fontSize:13}} className={supaMsg.startsWith('✓')?'up':supaMsg.startsWith('✗')?'down':''}>{supaMsg}</div>
            {savedPlans.length>0 && <div style={{marginTop:12}}>
              <div style={{color:'var(--muted)',fontSize:12,marginBottom:6}}>已存規劃（點擊載入）：</div>
              {savedPlans.map(s=><span key={s.plan_name} className="pill" style={{cursor:'pointer',display:'inline-block',marginBottom:6}}
                onClick={()=>loadPlan(s.plan_name)}>{s.plan_name}</span>)}
            </div>}
          </div> : <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.7}}>
            尚未連線 Supabase。到「設定」填入 Project URL 與 anon key 後，即可把客戶規劃存到雲端、跨裝置載入，配置範本也會改從雲端 inv_plan_presets 載入。</div>}
        </div>

      </div>
    </div>
  </div>;
}
function Settings(){
  const [cfg,setCfg] = useState(loadCfg());
  const [msg,setMsg] = useState('');
  const save = ()=>{ localStorage.setItem(CFG_KEY,JSON.stringify(cfg)); setMsg('✓ 已儲存設定'); };
  const test = async ()=>{
    setMsg('測試中…');
    try{
      const r = await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/inv_snapshots?select=year&limit=1',
        {headers:{apikey:cfg.key, Authorization:'Bearer '+cfg.key}});
      if(r.ok) setMsg('✓ 連線成功（HTTP '+r.status+'）');
      else setMsg('✗ 連線失敗：HTTP '+r.status+'（請確認已執行 schema.sql 且 key 正確）');
    }catch(e){ setMsg('✗ 連線錯誤：'+e.message); }
  };
  return <div>
    <div className="page-title">系統設定</div>
    <div className="page-sub">目前資料來源：內建示範資料（Budget Plan 2026v1_May.xlsx 匯出）・連接 Supabase 後可改為雲端資料</div>
    <div className="grid2">
      <div className="card">
        <h3>Supabase 連線（全新專案）</h3>
        <div className="field"><label>Project URL</label>
          <input value={cfg.url||''} placeholder="https://xxxx.supabase.co" onChange={e=>setCfg({...cfg,url:e.target.value})}/></div>
        <div className="field"><label>anon key（唯讀）</label>
          <input value={cfg.key||''} placeholder="eyJhbGciOi..." onChange={e=>setCfg({...cfg,key:e.target.value})}/></div>
        <button className="btn" onClick={save}>儲存</button>{' '}
        <button className="btn ghost" onClick={test} disabled={!cfg.url||!cfg.key}>測試連線</button>
        <div style={{marginTop:10,fontSize:13}} className={msg.startsWith('✓')?'up':msg.startsWith('✗')?'down':''}>{msg}</div>
      </div>
      <div className="card">
        <h3>行情資料源</h3>
        <div className="field"><label>Twelve Data API key（美股／黃金／匯率用，twelvedata.com 免費申請）</label>
          <input value={cfg.tdKey||''} placeholder="貼上免費 API key" onChange={e=>setCfg({...cfg,tdKey:e.target.value.trim()})}/></div>
        <div className="field"><label>自動更新間隔（分鐘，0 = 關閉）</label>
          <select value={cfg.autoMin||0} onChange={e=>setCfg({...cfg,autoMin:parseInt(e.target.value)})}>
            <option value={0}>關閉（手動更新）</option><option value={5}>每 5 分鐘</option>
            <option value={15}>每 15 分鐘</option><option value={60}>每 60 分鐘</option>
          </select></div>
        <div className="field"><label>手動美元匯率（未連 Twelve Data 時折算用）</label>
          <input type="number" step="0.1" value={cfg.fx||31} onChange={e=>setCfg({...cfg,fx:parseFloat(e.target.value)||31})}/></div>
        <button className="btn" onClick={save}>儲存</button>
        <div style={{color:'var(--muted)',fontSize:12,marginTop:10,lineHeight:1.7}}>
          台股（TWSE）與比特幣（Binance）免 key 直接可用。<br/>
          Twelve Data 免費額度 800 次/天、8 次/分鐘，本系統用量遠低於上限。
        </div>
      </div>
      <div className="card">
        <h3>標的對應修改（進階）</h3>
        <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.7,marginBottom:8}}>
          JSON 格式覆寫預設對應。鍵為「帳戶|標的」，p 為資料源（twse / td / bn / manual）。</div>
        <textarea style={{width:'100%',height:110,background:'var(--panel2)',border:'1px solid var(--line)',borderRadius:8,color:'var(--text)',padding:10,fontSize:12.5,fontFamily:'Consolas,monospace'}}
          defaultValue={JSON.stringify(loadJSON(MAP_KEY,{'YFY|QQQ':{p:'twse',s:'00662',nm:'富邦NASDAQ',cur:'TWD'}}),null,1)} id="mapOverride"/>
        <div style={{marginTop:8}}>
          <button className="btn ghost" onClick={()=>{
            try{ const v=JSON.parse(document.getElementById('mapOverride').value); saveJSON(MAP_KEY,v); setMsg('✓ 對應已儲存，重新整理後生效'); }
            catch(e){ setMsg('✗ JSON 格式錯誤：'+e.message); }
          }}>儲存對應</button>
        </div>
      </div>
      <div className="card">
        <h3>部署資訊</h3>
        <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.9}}>
          ・本系統為單一 HTML 檔，放上 Web Station 任一資料夾即可使用（網址 /inv/）。<br/>
          ・資料表結構見 <b>schema.sql</b>，於 Supabase SQL Editor 執行後即可上傳資料。<br/>
          ・連線資訊與 API key 只存在瀏覽器 localStorage，不會上傳。<br/>
          ・前台手機版（客戶端）為下一階段開發項目。
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- 登入閘（client-side，輕量保護） ---------- */
function pwHash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return h;}
const INV_PW_HASH = 2087956275;
function Login({onOk}){
  const [v,setV]=useState(''); const [err,setErr]=useState(false);
  const submit=()=>{ if(pwHash(v)===INV_PW_HASH){ try{sessionStorage.setItem('plan_auth','1');}catch(e){} onOk(); } else { setErr(true); setV(''); } };
  return <div style={{position:'fixed',inset:0,background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,zIndex:200}}>
    <div className="card" style={{maxWidth:340,width:'100%'}}>
      <div style={{fontSize:18,fontWeight:700,padding:'4px 0 4px'}}>INV<span style={{color:'var(--accent)'}}>·</span>退休投資規劃</div>
      <div style={{color:'var(--muted)',fontSize:12.5,marginBottom:16}}>請輸入密碼登入試算系統</div>
      <div className="field"><label>密碼</label>
        <input type="password" value={v} autoFocus placeholder="請輸入密碼"
          onChange={e=>{setV(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==='Enter')submit();}}/></div>
      {err && <div className="down" style={{fontSize:13,marginBottom:10}}>密碼錯誤，請再試一次</div>}
      <button className="btn" style={{width:'100%'}} onClick={submit}>登入</button>
    </div>
  </div>;
}

/* ---------- 上傳 Excel 分析（純瀏覽器端解析，檔案不上傳） ---------- */
const MONTH_MAP = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function toMonthNum(v){
  if(v==null||v==='') return null;
  if(typeof v==='number') return (v>=1&&v<=12)? Math.round(v) : null;
  const s=String(v).trim().toLowerCase();
  if(MONTH_MAP[s.slice(0,3)]) return MONTH_MAP[s.slice(0,3)];
  const n=parseInt(s); return (n>=1&&n<=12)? n : null;
}
function toNum(v){ if(v==null||v===''||v==='-') return null; const n=parseFloat(String(v).replace(/[,\s%]/g,'')); return isNaN(n)?null:n; }
function aoa(ws){ return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}); }
function colBy(header, regs){ for(let i=0;i<header.length;i++){ const c=header[i]==null?'':String(header[i]); if(regs.some(r=>r.test(c))) return i; } return -1; }
function findHeaderRow(rows, mustRegs){
  for(let i=0;i<Math.min(rows.length,15);i++){
    const row=(rows[i]||[]).map(c=>c==null?'':String(c));
    if(mustRegs.every(group=>row.some(c=>group.test(c)))) return i;
  }
  return -1;
}
const COL = {
  year:[/^年$/,/year/i,/西元/], month:[/^月$/,/month/i,/月份/],
  net:[/淨資產/,/net.?worth/i], total:[/資產總額/,/總資產/,/total.?asset/i,/總市值/],
  cost:[/資產成本/,/成本/,/cost/i], pnl:[/損益/,/profit|pnl|gain/i],
  roi:[/報酬率/,/報酬/,/roi/i,/return/i], note:[/note/i,/備註/,/說明/],
  name:[/名稱/,/標的/,/股票/,/商品/,/^name$/i,/ticker/i,/代號/],
  ntd:[/ntd/i,/台幣/,/市值/,/金額/,/^value$/i,/評估價值/],
  cat:[/大類/,/類別/,/category/i,/type/i,/資產類別/],
  broker:[/券商/,/平台/,/broker/i,/帳戶/],
};
function parseTracker(wb){
  const names = wb.SheetNames;
  const ordered = [...names].sort((a,b)=> (/(tracker|淨值|淨資產|資產|總表|track)/i.test(b)?1:0)-(/(tracker|淨值|淨資產|資產|總表|track)/i.test(a)?1:0));
  for(const nm of ordered){
    const rows=aoa(wb.Sheets[nm]);
    const hr=findHeaderRow(rows,[COL.month, [...COL.net,...COL.total]]);
    if(hr<0) continue;
    const H=rows[hr];
    const ci={year:colBy(H,COL.year), month:colBy(H,COL.month), net:colBy(H,COL.net),
      total:colBy(H,COL.total), cost:colBy(H,COL.cost), pnl:colBy(H,COL.pnl), roi:colBy(H,COL.roi), note:colBy(H,COL.note)};
    if(ci.month<0 || (ci.net<0 && ci.total<0)) continue;
    const out=[]; let curYear=null;
    for(let i=hr+1;i<rows.length;i++){
      const r=rows[i]||[];
      const y = ci.year>=0? toNum(r[ci.year]) : null; if(y) curYear=y;
      const m = toMonthNum(r[ci.month]); if(!m) continue;
      const nw = ci.net>=0? toNum(r[ci.net]) : null;
      const ta = ci.total>=0? toNum(r[ci.total]) : null;
      if(nw==null && ta==null) continue;
      out.push({year:curYear||(out.length?out[out.length-1].year:1), month:m,
        net_worth: nw!=null? nw : ta, total_assets: ta!=null? ta : nw,
        total_cost: ci.cost>=0? toNum(r[ci.cost]):null, pnl: ci.pnl>=0? toNum(r[ci.pnl]):null,
        roi: ci.roi>=0? toNum(r[ci.roi]):null, note: ci.note>=0&&r[ci.note]? String(r[ci.note]).trim():''});
    }
    if(out.length>=2) return {sheet:nm, rows:out, cols:ci};
  }
  return null;
}
function parseHoldings(wb){
  for(const nm of wb.SheetNames){
    const rows=aoa(wb.Sheets[nm]);
    const hr=findHeaderRow(rows,[COL.name, COL.ntd]);
    if(hr<0) continue;
    const H=rows[hr];
    const ci={name:colBy(H,COL.name), ntd:colBy(H,COL.ntd), cat:colBy(H,COL.cat),
      broker:colBy(H,COL.broker), year:colBy(H,COL.year), month:colBy(H,COL.month)};
    if(ci.name<0||ci.ntd<0) continue;
    const all=[]; let curYear=null;
    for(let i=hr+1;i<rows.length;i++){
      const r=rows[i]||[];
      const nmv=r[ci.name]; const v=toNum(r[ci.ntd]);
      if(nmv==null||v==null) continue;
      const y=ci.year>=0?toNum(r[ci.year]):null; if(y)curYear=y;
      all.push({name:String(nmv).trim(), ntd:v, cat: ci.cat>=0&&r[ci.cat]?String(r[ci.cat]).trim():'其他',
        broker: ci.broker>=0&&r[ci.broker]?String(r[ci.broker]).trim():'', year:curYear, month: ci.month>=0?toMonthNum(r[ci.month]):null});
    }
    if(!all.length) continue;
    const hasYM = all.some(h=>h.year&&h.month);
    let ym=null, latest=all;
    if(hasYM){ all.forEach(h=>{ if(h.year&&h.month&&(!ym||h.year>ym[0]||(h.year===ym[0]&&h.month>ym[1]))) ym=[h.year,h.month]; });
      latest=all.filter(h=>h.year===ym[0]&&h.month===ym[1]); }
    // aggregate latest by name
    const agg={}; latest.forEach(h=>{ const k=h.name; (agg[k]=agg[k]||{name:h.name,cat:h.cat,ntd:0}).ntd+=h.ntd; });
    const holdings=Object.values(agg).sort((a,b)=>b.ntd-a.ntd);
    // alloc history by month+cat
    let hist=null;
    if(hasYM){ const am={}; all.forEach(h=>{ if(!h.year||!h.month)return; const k=h.year+'-'+String(h.month).padStart(2,'0');
      (am[k]=am[k]||{ym:k}); am[k][h.cat]=(am[k][h.cat]||0)+h.ntd; });
      hist=Object.values(am).sort((a,b)=>a.ym.localeCompare(b.ym)); }
    return {sheet:nm, holdings, ym, hist, total:holdings.reduce((s,h)=>s+h.ntd,0)};
  }
  return null;
}
const PALETTE=['#4f8cff','#2ecc8f','#a78bfa','#f0b90b','#ff5d6c','#22d3ee','#fb923c','#e879f9','#84cc16','#94a3b8','#f43f5e','#14b8a6'];
function AnalyzeUpload(){
  const [res,setRes]=useState(null);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [fname,setFname]=useState('');
  const inRef=useRef(null);
  const handle=(file)=>{
    if(!file) return;
    setBusy(true); setErr(''); setRes(null); setFname(file.name);
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const tracker=parseTracker(wb);
        const holdings=parseHoldings(wb);
        if(!tracker && !holdings){
          setErr('無法自動辨識。請確認 Excel 至少含「月份」加「淨資產或資產總額」欄位，或持倉的「名稱」加「市值/金額」欄位。');
          setRes({sheets:wb.SheetNames}); setBusy(false); return;
        }
        setRes({tracker, holdings, sheets:wb.SheetNames});
      }catch(ex){ setErr('解析失敗：'+ex.message); }
      setBusy(false);
    };
    reader.onerror=()=>{ setErr('讀取檔案失敗'); setBusy(false); };
    reader.readAsArrayBuffer(file);
  };
  const onDrop=(e)=>{ e.preventDefault(); handle(e.dataTransfer.files[0]); };
  const fmtN=v=>v==null?'-':Math.round(v).toLocaleString('en-US');
  const t=res&&res.tracker, h=res&&res.holdings;
  const last=t&&t.rows[t.rows.length-1], first=t&&t.rows[0];
  const lab=r=>r.year+'/'+String(r.month).padStart(2,'0');
  let catAgg={}, cats=[];
  if(h){ h.holdings.forEach(x=>catAgg[x.cat]=(catAgg[x.cat]||0)+x.ntd); cats=Object.keys(catAgg).sort((a,b)=>catAgg[b]-catAgg[a]); }
  const catColor={}; cats.forEach((c,i)=>catColor[c]=PALETTE[i%PALETTE.length]);
  return <div>
    <div className="page-title">上傳 Excel 分析</div>
    <div className="page-sub">上傳您長期填寫的資產 Excel（.xlsx），系統自動辨識月度淨資產與持倉並繪圖。檔案僅在您的瀏覽器解析，不會上傳到任何伺服器。</div>

    <div className="card" style={{borderStyle:'dashed',borderColor:'var(--accent)',textAlign:'center',padding:'26px 16px',cursor:'pointer'}}
      onClick={()=>inRef.current&&inRef.current.click()}
      onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
      <div style={{fontSize:30,marginBottom:8}}>📤</div>
      <div style={{fontWeight:600,marginBottom:4}}>點此選擇，或將 Excel 拖曳到這裡</div>
      <div style={{color:'var(--muted)',fontSize:12.5}}>支援 .xlsx / .xls / .csv　{fname && '・已選：'+fname}</div>
      <input ref={inRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
        onChange={e=>handle(e.target.files[0])}/>
    </div>
    {busy && <div className="card" style={{color:'var(--accent)'}}>解析中…</div>}
    {err && <div className="card"><div className="down">⚠ {err}</div>
      {res&&res.sheets && <div style={{color:'var(--muted)',fontSize:12.5,marginTop:8}}>偵測到的工作表：{res.sheets.join('、')}</div>}</div>}

    {t && <div>
      <div className="kpis">
        <div className="kpi"><div className="lab">最新淨資產（{lab(last)}）</div><div className="val">{fmtN(last.net_worth)}</div>
          <div className="sub">{t.sheet} 工作表・{t.rows.length} 個月</div></div>
        <div className="kpi"><div className="lab">期間變化</div>
          <div className={'val '+((last.net_worth-first.net_worth)>=0?'up':'down')}>{(last.net_worth-first.net_worth)>=0?'+':''}{fmtN(last.net_worth-first.net_worth)}</div>
          <div className="sub">自 {lab(first)} 起</div></div>
        <div className="kpi"><div className="lab">期間成長率</div>
          <div className={'val '+((last.net_worth-first.net_worth)>=0?'up':'down')}>{first.net_worth? ((last.net_worth/first.net_worth-1)*100).toFixed(1)+'%':'-'}</div>
          <div className="sub">{Math.round((t.rows.length-1)/12*10)/10} 年</div></div>
        {last.roi!=null && <div className="kpi"><div className="lab">最新總報酬率</div>
          <div className={'val '+(last.roi>=0?'up':'down')}>{(Math.abs(last.roi)<=2? last.roi*100 : last.roi).toFixed(1)}%</div>
          <div className="sub">來自 Excel</div></div>}
      </div>
      <div className="card">
        <h3>淨資產 / 資產總額 走勢<small>{t.sheet}・依您 Excel 原始數值</small></h3>
        <ChartBox type="line" height={300} data={{labels:t.rows.map(lab),datasets:[
          {label:'淨資產',data:t.rows.map(r=>r.net_worth),borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
          ...(t.rows.some(r=>r.total_assets!=null&&r.total_assets!==r.net_worth)?[{label:'資產總額',data:t.rows.map(r=>r.total_assets),borderColor:'#2ecc8f',tension:.3,pointRadius:0,borderWidth:2}]:[]),
          ...(t.rows.some(r=>r.total_cost!=null)?[{label:'投入成本',data:t.rows.map(r=>r.total_cost),borderColor:'#8b98ad',borderDash:[5,4],tension:.3,pointRadius:0,borderWidth:1.5}]:[]),
        ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
          plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()}}},
          scales:{x:{ticks:{maxTicksLimit:12}}}}}/>
      </div>
      {t.rows.some(r=>r.note) && <div className="card"><h3>Excel 筆記</h3>
        {t.rows.filter(r=>r.note).slice(-8).reverse().map((r,i)=><div className="note-row" key={i}><span className="d">{lab(r)}</span>{r.note}</div>)}</div>}
    </div>}

    {h && <div className="grid2">
      <div className="card">
        <h3>最新持倉配置{h.ym?'（'+h.ym[0]+'/'+String(h.ym[1]).padStart(2,'0')+'）':''}<small>{h.sheet}</small></h3>
        <ChartBox type="doughnut" height={250} data={{labels:cats,datasets:[{data:cats.map(c=>catAgg[c]),
          backgroundColor:cats.map(c=>catColor[c]),borderColor:'#121826',borderWidth:2}]}}
          options={{maintainAspectRatio:false,plugins:{legend:{position:'right'},
            tooltip:{callbacks:{label:c=>' '+c.label+': '+Math.round(c.parsed).toLocaleString()+'（'+(c.parsed/h.total*100).toFixed(1)+'%）'}}},cutout:'60%'}}/>
      </div>
      <div className="card">
        <h3>前十大持倉</h3>
        <ChartBox type="bar" height={250} data={{labels:h.holdings.slice(0,10).map(x=>x.name),datasets:[{label:'市值',
          data:h.holdings.slice(0,10).map(x=>x.ntd),backgroundColor:h.holdings.slice(0,10).map(x=>catColor[x.cat]||'#4f8cff')}]}}
          options={{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},
            tooltip:{callbacks:{label:c=>' '+Math.round(c.parsed.x).toLocaleString()}}}}}/>
      </div>
    </div>}
    {h && h.hist && h.hist.length>1 && <div className="card">
      <h3>配置變化（依月份）</h3>
      <ChartBox type="bar" height={280} data={{labels:h.hist.map(r=>r.ym),datasets:cats.map(c=>(
        {label:c,data:h.hist.map(r=>r[c]||0),backgroundColor:catColor[c]}))}}
        options={{maintainAspectRatio:false,interaction:{mode:'index'},
          plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()}}},
          scales:{x:{stacked:true,ticks:{maxTicksLimit:12}},y:{stacked:true}}}}/>
    </div>}

    {res && (t||h) && <div className="disclaimer" style={{marginTop:4}}>
      ✓ 已辨識：{t?('淨值走勢（'+t.sheet+'，'+t.rows.length+'月）'):''}{t&&h?'、':''}{h?('持倉（'+h.sheet+'，'+h.holdings.length+'檔）'):''}。
      若辨識不完整，請確認欄位名稱含「月份／淨資產／資產總額／名稱／市值」等關鍵字。</div>}
  </div>;
}

/* ---------- 退休試算 FIRE（客戶端獨立版，預設帶入規劃試算數字） ---------- */
function FireStandalone({p, setP, set, fireType, setFireType}){
  const plan = loadJSON(PLAN_KEY, {});
  const ftDef = FIRE_TYPES.find(f=>f.id===fireType) || FIRE_TYPES[0];
  const [vol,setVol]=useState(12);
  const [pension,setPension]=useState(()=>{const l=calcLaborPension(plan.salary,plan.laborYears);return Math.round(l.monthly*12/10000);});
  // 依 FIRE 類型調整：Lean/Fat 改年提領、Coast 停止投入、Barista 兼職分攤
  const simP = {...p,
    withdraw0: p.withdraw0*(ftDef.expMult||1),
    monthly: ftDef.coast? 0 : p.monthly,
    baristaIncome: ftDef.barista? (Number(p.baristaIncome)||0) : 0,
    baristaUntilAge: ftDef.barista? (Number(p.baristaUntilAge)||0) : 0};
  const sim = useMemo(()=>simulate(simP),[JSON.stringify(simP)]);
  const mc = useMemo(()=>monteCarlo(simP,(Number(vol)||0)/100,Number(pension)||0,500),[JSON.stringify(simP),vol,pension]);
  const retireAgeC = p.age0+(p.retireYear-p.year0);
  const atRetire = sim.find(r=>r.year===p.retireYear-1) || sim[0];
  const depleted = sim.find(r=>r.value<=0);
  const end = sim[sim.length-1];
  const effExp = p.withdraw0*(ftDef.expMult||1);
  const wdAtRetire = effExp*Math.pow(1+p.inflation, p.retireYear-p.year0);
  const rule4 = wdAtRetire/0.04;
  const ok = atRetire && atRetire.value>=rule4;
  const yearsToRetire = Math.max(0, p.retireYear-p.year0);
  const coastNum = rule4 / Math.pow(1+(p.rWork||0), yearsToRetire);
  const coastDone = p.asset0 >= coastNum;
  const labels = sim.map(r=>r.year);
  return <div>
    <div className="page-title">退休試算（FIRE 計算機）</div>
    <div className="page-sub">長線懶人投資：以年為單位試算至 100 歲，提領金額逐年隨通膨調整。預設值帶入你在「規劃試算」填的數字，可自由調整。單位：萬元。</div>
    <div className="card">
      <h3>🎚 FIRE 類型<small>選擇退休型態，下方試算自動調整</small></h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(132px,1fr))',gap:8}}>
        {FIRE_TYPES.map(f=><div key={f.id} onClick={()=>setFireType(f.id)}
          style={{cursor:'pointer',padding:'8px 10px',borderRadius:9,transition:'.15s',
            border:'1px solid '+(fireType===f.id?'var(--accent)':'var(--line)'),
            background:fireType===f.id?'rgba(79,140,255,.12)':'var(--panel2)'}}>
          <div style={{fontWeight:700,fontSize:13.5}}>{f.emoji} {f.nm}</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:2,lineHeight:1.35}}>{f.desc}</div>
        </div>)}
      </div>
      {ftDef.barista && <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
        <div className="field"><label>兼職年收入（元）</label><YuanIn wan={p.baristaIncome} on={v=>set('baristaIncome',v)} step={10000}/>
          <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{fmtWanHint(p.baristaIncome)}</div></div>
        <div className="field"><label>兼職到幾歲</label><NumIn v={p.baristaUntilAge} on={v=>set('baristaUntilAge',Math.round(v))} step={1}/></div>
      </div>}
      <div style={{color:'var(--muted)',fontSize:12,marginTop:10,lineHeight:1.7}}>
        目前型態 <b style={{color:'var(--text)'}}>{ftDef.emoji} {ftDef.nm}</b>　｜
        退休目標（4% 法則）：<b style={{color:'var(--text)'}}>{fmtNum(rule4)} 萬</b>
        （年支出 {fmtNum(effExp)} 萬{ftDef.expMult!==1? '＝基準 '+fmtNum(p.withdraw0)+' 萬 ×'+ftDef.expMult : ''}）
        {ftDef.coast && <span>　｜　Coast 數字：<b style={{color:'var(--text)'}}>{fmtNum(coastNum)} 萬</b>（{coastDone? <span className="up">✓ 已達標，可停止投入</span>:<span className="down">尚未達標，還差 {fmtNum(coastNum-p.asset0)} 萬</span>}）</span>}
        {ftDef.barista && <span>　｜　兼職期間每年提領可少 {fmtNum(p.baristaIncome)} 萬（{p.baristaUntilAge} 歲前）</span>}
      </div>
    </div>
    <div className="grid32">
      <div>
        <div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))'}}>
          <div className="kpi"><div className="lab">退休年（{retireAgeC} 歲）資產</div>
            <div className="val">{fmtNum(atRetire.value)} 萬</div>
            <div className="sub">4% 法則需求：{fmtNum(rule4)} 萬</div></div>
          <div className="kpi"><div className="lab">退休首年提領</div>
            <div className="val">{fmtNum(wdAtRetire)} 萬/年</div>
            <div className="sub">約 {fmtNum(wdAtRetire/12)} 萬/月（含通膨）</div></div>
          <div className="kpi"><div className="lab">100 歲時資產</div>
            <div className={'val '+(end.value>0?'up':'down')}>{fmtNum(end.value)} 萬</div>
            <div className="sub">{depleted? '⚠ '+(p.age0+(depleted.year-p.year0))+' 歲耗盡' : '✓ 終身不耗盡'}</div></div>
          <div className="kpi"><div className="lab">安全評估</div>
            <div className={'val '+(ok?'up':'down')}>{ok?'達標':'未達標'}</div>
            <div className="sub">退休資產 vs 4% 法則</div></div>
          <div className="kpi" style={{background:'linear-gradient(180deg,rgba(46,204,143,.10),transparent)'}}>
            <div className="lab">蒙地卡羅成功率</div>
            <div className={'val '+(mc.successRate>=0.8?'up':mc.successRate>=0.5?'':'down')}>{Math.round(mc.successRate*100)}%</div>
            <div className="sub">撐到 100 歲・500 次模擬</div></div>
        </div>
        <div className="card">
          <h3>資產曲線試算（到 100 歲）</h3>
          <ChartBox type="line" height={360} data={{labels,datasets:[
            {label:'淨資產',data:sim.map(r=>r.value),borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2.5},
          ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' 淨資產: '+Math.round(c.parsed.y).toLocaleString()+' 萬'},
              afterBody:items=>{const r=sim[items[0].dataIndex]; return r.withdraw? '提領: '+Math.round(r.withdraw).toLocaleString()+' 萬':'';}}},
            scales:{y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
        </div>
        <div className="card">
          <h3>逐年明細（每 5 年）</h3>
          <table><thead><tr><th>年份</th><th>年齡</th><th>淨資產(萬)</th><th>當年提領(萬)</th><th>階段</th></tr></thead>
          <tbody>{sim.filter((r,i)=>r.age%5===0||r.year===p.retireYear||i===sim.length-1).map(r=>
            <tr key={r.year}><td>{r.year}</td><td>{r.age}</td>
              <td>{fmtNum(r.value)}</td><td>{r.withdraw?fmtNum(r.withdraw):'-'}</td>
              <td><span className={'tag '+(r.year>=p.retireYear?'sell':'buy')}>{r.year>=p.retireYear?'退休提領':'累積投入'}</span></td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h3>蒙地卡羅模擬<small>進階壓力測試・500 種市場走勢・波動度 ±{vol}%</small></h3>
          <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap',marginBottom:10}}>
            <div><div style={{fontSize:34,fontWeight:800}} className={mc.successRate>=0.8?'up':mc.successRate>=0.5?'':'down'}>{Math.round(mc.successRate*100)}%</div>
              <div style={{color:'var(--muted)',fontSize:12}}>退休金撐到 100 歲的成功率</div></div>
            <div style={{flex:1,minWidth:180,color:'var(--muted)',fontSize:12.5,lineHeight:1.7}}>
              每年報酬隨機（常態分布：平均＝你設的報酬率、波動＝下方參數），退休後先扣政府年金再提領。
              {mc.successRate>=0.8?'　✓ 計畫穩健':mc.successRate>=0.5?'　△ 有風險，建議降低提領或延後退休':'　✗ 風險偏高，需調整參數'}
            </div>
          </div>
          <ChartBox type="line" height={300} data={{labels:mc.years,datasets:[
            {label:'樂觀（前10%）',data:mc.p90,borderColor:'#2ecc8f',pointRadius:0,borderWidth:1.5,fill:2,backgroundColor:'rgba(79,140,255,.07)'},
            {label:'中位數',data:mc.p50,borderColor:'#4f8cff',pointRadius:0,borderWidth:2.5},
            {label:'保守（後10%）',data:mc.p10,borderColor:'#ff5d6c',pointRadius:0,borderWidth:1.5},
          ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
        </div>
      </div>
      <div>
        <div className="card">
          <h3>試算參數</h3>
          <div className="field"><label>目前可投資資產（元）</label><YuanIn wan={p.asset0} on={v=>set('asset0',v)} step={100000}/>
            <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{p.asset0?fmtWanHint(p.asset0):'例：500萬填 5000000'}</div></div>
          <div className="field"><label>每月投入（元）</label><YuanIn wan={p.monthly} on={v=>set('monthly',v)} step={1000}/>
            <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{p.monthly?fmtWanHint(p.monthly):'例：3萬填 30000'}</div></div>
          <FireIn p={p} set={set} k="retireYear" lab="退休年份（西元）" step={1}/>
          <div className="field"><label>退休後年提領（元・今日購買力）</label><YuanIn wan={p.withdraw0} on={v=>set('withdraw0',v)} step={10000}/>
            <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{p.withdraw0?fmtWanHint(p.withdraw0):'例：120萬填 1200000'}</div></div>
          <FireIn p={p} set={set} k="rWork" lab="工作期年化報酬率（%）" step={0.5} pct/>
          <FireIn p={p} set={set} k="rRetire" lab="退休後年化報酬率（%）" step={0.5} pct/>
          <FireIn p={p} set={set} k="inflation" lab="通膨率（%）" step={0.1} pct/>
          <div className="field"><label>投資組合年化波動度（%）</label>
            <input type="number" step="1" value={vol||''} onChange={e=>setVol(parseFloat(e.target.value)||0)}/></div>
          <div className="field"><label>退休後政府年金年領（元・勞保+勞退）</label>
            <YuanIn wan={pension} on={v=>setPension(v)} step={10000}/>
            <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{pension?fmtWanHint(pension):'勞保年領預設帶入'}</div></div>
          <div className="pill">基準年 {p.year0}</div><div className="pill">{p.age0} 歲</div>
        </div>
        <div className="card">
          <h3>說明</h3>
          <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.8}}>
            ・退休前每年投入、退休後停止投入並提領，提領金額以「今日購買力」輸入，每年依通膨放大。<br/>
            ・4% 法則：退休首年提領 ÷ 4% ＝ 所需資產（Trinity Study／市場先生常用基準）。<br/>
            ・想更精準，可先到「規劃試算」填完整資料，本頁會自動帶入。<br/>
            ・退休後報酬率建議調低（提高債券/現金比重），波動越小越安心。
          </div>
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- 保障檢查（緊急預備金＋壽險缺口，投資前地基） ---------- */
const PROT_KEY='inv_protection';
function ProtectionCheck(){
  const plan = loadJSON(PLAN_KEY,{});
  const salary = Number(plan.salary)||0;
  const cash = plan.holdings? (Number(plan.holdings.cash)||0):0;
  const assetsSum = plan.holdings? Object.values(plan.holdings).reduce((s,v)=>s+(Number(v)||0),0):0;
  const [d,setD]=useState(()=>({
    monthlyExpense: Math.round((salary*0.6)*10)/10||3, efMonths:6, efCurrent: cash||0,
    debt:0, dependYears:15, eduFund:0, lifeCover:0, ...loadJSON(PROT_KEY,{})
  }));
  useEffect(()=>{ saveJSON(PROT_KEY,d); },[d]);
  const set=(k,v)=>setD(o=>({...o,[k]:v}));
  // 緊急預備金
  const efNeed = (Number(d.monthlyExpense)||0)*(Number(d.efMonths)||0);
  const efCur = Number(d.efCurrent)||0;
  const efRatio = efNeed? efCur/efNeed : 1;
  const efGap = Math.max(0, efNeed-efCur);
  const efOk = efRatio>=1, efMid = efRatio>=0.5;
  // 壽險缺口（需求法）
  const annualIncome = salary*12;
  const need = (Number(d.debt)||0) + (Number(d.monthlyExpense)||0)*12*(Number(d.dependYears)||0) + (Number(d.eduFund)||0);
  const cover = assetsSum + (Number(d.lifeCover)||0);
  const gap = Math.max(0, need-cover);
  const insOk = gap<=0;
  const tenCover = annualIncome*10;       // 雙十原則：保額≈年收入×10
  const tenPremium = annualIncome*0.1;    // 雙十原則：年保費≤年收入×10%
  const Bar=({ratio,col})=> <div style={{height:10,background:'var(--panel2)',borderRadius:6,overflow:'hidden',margin:'8px 0'}}>
    <div style={{height:'100%',width:Math.min(100,Math.max(2,ratio*100))+'%',background:col,transition:'width .3s'}}></div></div>;
  return <div>
    <div className="page-title">保障檢查</div>
    <div className="page-sub">開始投資前的地基：先備妥緊急預備金與基本壽險保障，避免市場下跌時被迫賤賣資產或讓家人陷入財務風險。預設值帶入你在「規劃試算」填的薪資與現金。</div>
    <div className="kpis">
      <div className="kpi"><div className="lab">緊急預備金達成率</div>
        <div className={'val '+(efOk?'up':efMid?'':'down')}>{Math.round(efRatio*100)}%</div>
        <div className="sub">{efOk?'✓ 充足':efMid?'△ 接近，再補一點':'✗ 不足，優先補滿'}</div></div>
      <div className="kpi"><div className="lab">建議緊急金（{d.efMonths} 個月）</div><div className="val">{fmtNum(efNeed)} 萬</div>
        <div className="sub">目前 {fmtNum(efCur)} 萬{efGap>0?'，缺 '+fmtNum(efGap)+' 萬':''}</div></div>
      <div className="kpi"><div className="lab">壽險保障缺口</div>
        <div className={'val '+(insOk?'up':'down')}>{insOk?'無缺口 ✓':fmtNum(gap)+' 萬'}</div>
        <div className="sub">需求 {fmtNum(need)}・可抵充 {fmtNum(cover)} 萬</div></div>
      <div className="kpi"><div className="lab">雙十原則參考保額</div><div className="val">{fmtNum(tenCover)} 萬</div>
        <div className="sub">年保費上限 {fmtNum(tenPremium)} 萬</div></div>
    </div>
    <div className="grid2">
      <div className="card" style={{border:'1px solid '+(efOk?'rgba(46,204,143,.4)':'rgba(255,93,108,.4)')}}>
        <h3>🪙 緊急預備金</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="field"><label>每月生活支出（元）</label><YuanIn wan={d.monthlyExpense} on={v=>set('monthlyExpense',v)} step={1000}/></div>
          <div className="field"><label>準備月數</label>
            <select value={d.efMonths} onChange={e=>set('efMonths',parseInt(e.target.value))}>
              <option value={3}>3 個月（收入穩定）</option><option value={6}>6 個月（建議）</option>
              <option value={12}>12 個月（收入波動/自營）</option></select></div>
          <div className="field" style={{gridColumn:'1 / 3'}}><label>目前可動用現金/活存（元）</label><YuanIn wan={d.efCurrent} on={v=>set('efCurrent',v)} step={10000}/></div>
        </div>
        <Bar ratio={efRatio} col={efOk?'#2ecc8f':efMid?'#f0b90b':'#ff5d6c'}/>
        <div style={{fontSize:13,lineHeight:1.9}}>
          建議至少 <b>{fmtNum(efNeed)} 萬</b>（{d.monthlyExpense} 萬 × {d.efMonths} 個月）。
          {efOk? <span className="up">　目前 {fmtNum(efCur)} 萬已足夠，多出的部分可投入長期投資。</span>
            : <span className="down">　目前 {fmtNum(efCur)} 萬，還差 <b>{fmtNum(efGap)} 萬</b>。建議先補滿緊急金，再增加投資部位。</span>}
        </div>
        <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
          緊急金應放在隨時可動用、低波動的地方（活存、高利數位帳戶、貨幣基金），不要放在股票或鎖定型商品。</div>
      </div>
      <div className="card" style={{border:'1px solid '+(insOk?'rgba(46,204,143,.4)':'rgba(255,93,108,.4)')}}>
        <h3>🛡 壽險保障缺口</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="field"><label>房貸＋其他負債（元）</label><YuanIn wan={d.debt} on={v=>set('debt',v)} step={100000}/></div>
          <div className="field"><label>需扶養年數（年）</label><NumIn v={d.dependYears} on={v=>set('dependYears',v)} step={1}/></div>
          <div className="field"><label>子女教育金預備（元）</label><YuanIn wan={d.eduFund} on={v=>set('eduFund',v)} step={100000}/></div>
          <div className="field"><label>現有壽險保額（元）</label><YuanIn wan={d.lifeCover} on={v=>set('lifeCover',v)} step={100000}/></div>
        </div>
        <Bar ratio={need? cover/need:1} col={insOk?'#2ecc8f':'#ff5d6c'}/>
        <div style={{fontSize:13,lineHeight:1.9}}>
          家庭保障需求約 <b>{fmtNum(need)} 萬</b>（負債 {fmtNum(d.debt)}＋家庭支出 {fmtNum(d.monthlyExpense*12)}/年×{d.dependYears}年＋教育金 {fmtNum(d.eduFund)}）。
          可抵充 <b>{fmtNum(cover)} 萬</b>（現有資產 {fmtNum(assetsSum)}＋壽險 {fmtNum(d.lifeCover)}）。
          {insOk? <span className="up">　保障充足，無明顯缺口。</span>
            : <span className="down">　保障缺口 <b>{fmtNum(gap)} 萬</b>，建議用定期壽險補足（保費低、純保障）。</span>}
        </div>
        <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
          雙十原則參考：壽險保額約年收入 10 倍（{fmtNum(tenCover)} 萬）、年總保費控制在年收入 10%（≤ {fmtNum(tenPremium)} 萬）內。
          此為粗估，實際保障規劃請洽專業保險顧問。</div>
      </div>
    </div>
    <div className="card">
      <h3>建議順序</h3>
      <div style={{fontSize:13,lineHeight:2}}>
        <div>① <b className={efOk?'up':'down'}>緊急預備金</b> {efOk?'✓ 已備妥':'← 先補滿（'+fmtNum(efGap)+' 萬）'}</div>
        <div>② <b className={insOk?'up':'down'}>基本壽險保障</b> {insOk?'✓ 無缺口':'← 補足缺口（'+fmtNum(gap)+' 萬，定期壽險）'}</div>
        <div>③ 醫療/實支實付、意外險（本工具未試算，建議一併檢視）</div>
        <div>④ 以上完成後，再依「規劃試算」配置長期投資 — 市場下跌時才不會被迫賣股應急。</div>
      </div>
    </div>
  </div>;
}

/* ---------- 進階分析：Coast FIRE ＋ 長照衝擊（市面少見） ---------- */
function simShock(p, shock){
  const rows=[]; let v=p.asset0;
  for(let year=p.year0+1;;year++){
    const age=p.age0+(year-p.year0); if(age>100) break;
    const retired=year>=p.retireYear;
    const r=retired?p.rRetire:p.rWork;
    const invest=retired?0:p.monthly*12;
    let wd=retired? p.withdraw0*Math.pow(1+p.inflation, year-p.year0):0;
    if(shock && age>=shock.age && age<shock.age+shock.years)
      wd += shock.monthly*12*Math.pow(1+p.inflation, year-p.year0);
    v=Math.max(0,(v-wd))*(1+r)+invest;
    rows.push({year,age,value:v});
  }
  return rows;
}
function coastYearsTo(asset0,monthly,r,coastNum){ let v=asset0; if(v>=coastNum)return 0; for(let y=1;y<=70;y++){v=v*(1+r)+monthly*12; if(v>=coastNum)return y;} return null; }
function AdvancedAnalysis({p, fireType}){
  const curY=new Date().getFullYear();
  const ftDef=FIRE_TYPES.find(f=>f.id===fireType)||FIRE_TYPES[0];
  const expMult=ftDef.expMult||1;            // 依上方選的 FIRE 類型調整退休目標
  // 共用上方「試算參數」，不再重複輸入
  const age0=Number(p.age0)||0;
  const retireAge=p.age0+(p.retireYear-p.year0);
  const asset0=Number(p.asset0)||0;
  const monthly=Number(p.monthly)||0;
  const rWork=Number(p.rWork)||0;            // 小數（如 0.07）
  const rRetire=Number(p.rRetire)||0;
  const inflation=Number(p.inflation)||0;
  const monthlyExp=(Number(p.withdraw0)||0)/12;   // 年提領 → 月支出
  // 長照衝擊情境（本頁專用）
  const [sh,setSh]=useState({shockAge:80, shockMonthly:8, shockYears:5});
  const setS=(k,v)=>setSh(o=>({...o,[k]:v}));
  const N=(k,lab,step)=> <div className="field"><label>{lab}</label><YuanIn wan={sh[k]} on={v=>setS(k,v)} step={step}/>
    {sh[k]>0 && <div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{fmtWanHint(sh[k])}</div>}</div>;
  const P=(k,lab,step)=> <div className="field"><label>{lab}</label><input type="number" step={step} value={sh[k]} onChange={e=>setS(k,parseFloat(e.target.value)||0)}/></div>;
  // ---- Coast FIRE ----
  const years=Math.max(1,retireAge-age0);
  const r=rWork;
  const target=monthlyExp*300*expMult;       // 4%法則：月支出×12÷0.04 = ×300（萬）；再乘 FIRE 類型倍率
  const coastNum=target/Math.pow(1+r,years);
  const coastRatio=coastNum? asset0/coastNum : 0;
  const coastDone=coastRatio>=1;
  const coastReachY=coastYearsTo(asset0,monthly,r,coastNum);
  const cLabels=[], cAsset=[], cTarget=[];
  for(let y=0;y<=years;y++){ cLabels.push(age0+y+' 歲'); cAsset.push(asset0*Math.pow(1+r,y)); cTarget.push(target); }
  // ---- 長照衝擊 ----
  const fp={age0,year0:curY,asset0,monthly,rWork,rRetire,inflation,retireYear:curY+(retireAge-age0),withdraw0:monthlyExp*12*expMult};
  const dep=[asset0,monthly,rWork,rRetire,inflation,monthlyExp,expMult,age0,retireAge,sh.shockAge,sh.shockMonthly,sh.shockYears].join(',');
  const base=useMemo(()=>simShock(fp,null),[dep]);
  const shocked=useMemo(()=>simShock(fp,{age:sh.shockAge,monthly:sh.shockMonthly,years:sh.shockYears}),[dep]);
  const baseEnd=base[base.length-1].value, shockEnd=shocked[shocked.length-1].value;
  const baseDep=base.find(x=>x.value<=0), shockDep=shocked.find(x=>x.value<=0);
  const shockCost=sh.shockMonthly*12*sh.shockYears;   // 名目總額（萬）
  const survives=shockEnd>0;
  return <div>
    <div className="page-title">進階退休分析</div>
    <div className="page-sub">目前 FIRE 類型：<b style={{color:'var(--accent)'}}>{ftDef.emoji} {ftDef.nm}</b>（退休目標已套用 ×{expMult}，隨上方切換同步）。兩項壓力測試：① Coast FIRE — 現有資產不再投入、光靠複利夠不夠退休；② 長照/醫療重大支出對退休金的衝擊。單位：元。</div>

    <div className="grid32">
      <div>
        <div className="card" style={{border:'1px solid '+(coastDone?'rgba(46,204,143,.5)':'rgba(79,140,255,.4)')}}>
          <h3>🏖 滑行達標檢測（{ftDef.emoji} {ftDef.nm}）<small>現有資產不再投入，能否靠複利滾到「{ftDef.nm}」退休目標</small></h3>
          <div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',marginBottom:14}}>
            <div className="kpi"><div className="lab">退休目標（4%法則）</div><div className="val">{fmtNum(target)} 萬</div>
              <div className="sub">月支出 {fmtNum(monthlyExp)} 萬 → 需 {fmtNum(target)} 萬</div></div>
            <div className="kpi"><div className="lab">滑行所需數字</div><div className="val">{fmtNum(coastNum)} 萬</div>
              <div className="sub">現在備妥此數，{years} 年後達標</div></div>
            <div className="kpi"><div className="lab">你的達成率</div>
              <div className={'val '+(coastDone?'up':'down')}>{Math.round(coastRatio*100)}%</div>
              <div className="sub">目前 {fmtNum(asset0)} 萬</div></div>
          </div>
          <div style={{height:18,background:'var(--panel2)',borderRadius:9,overflow:'hidden',position:'relative',marginBottom:8}}>
            <div style={{height:'100%',width:Math.min(100,Math.max(2,coastRatio*100))+'%',background:coastDone?'linear-gradient(90deg,#2ecc8f,#22d3ee)':'linear-gradient(90deg,#4f8cff,#a78bfa)'}}></div>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',textShadow:'0 1px 2px rgba(0,0,0,.4)'}}>{Math.round(coastRatio*100)}%</div>
          </div>
          <div style={{fontSize:13.5,lineHeight:1.8}}>
            {coastDone
              ? <span className="up">✓ 恭喜！你已達滑行門檻。現有資產光靠 {(rWork*100).toFixed(1)}% 複利，{years} 年後就能滾到退休目標，<b>之後不必再投入也能退休</b>——賺的錢可以放心花、轉職或減壓。</span>
              : <span>還差 <b className="down">{fmtNum(coastNum-asset0)} 萬</b>達到滑行門檻。{coastReachY!=null
                  ? <span>依目前每月投入 {fmtNum(monthly)} 萬，約 <b className="up">{coastReachY} 年後（{age0+coastReachY} 歲）</b>達到滑行門檻，屆時即可停止投入。</span>
                  : <span className="down">目前投入速度 70 年內難達標，建議提高投入或報酬率。</span>}</span>}
          </div>
          <ChartBox type="line" height={230} data={{labels:cLabels,datasets:[
            {label:'現有資產（不再投入）',data:cAsset,borderColor:'#4f8cff',backgroundColor:'rgba(79,140,255,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
            {label:'退休目標',data:cTarget,borderColor:'#2ecc8f',borderDash:[6,4],pointRadius:0,borderWidth:1.5},
          ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{x:{ticks:{maxTicksLimit:8}},y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
        </div>

        <div className="card" style={{border:'1px solid '+(survives?'rgba(46,204,143,.4)':'rgba(255,93,108,.5)')}}>
          <h3>🏥 長照／醫療重大衝擊壓力測試<small>晚年突發看護/醫療支出對退休金的衝擊</small></h3>
          <div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',marginBottom:12}}>
            <div className="kpi"><div className="lab">無衝擊・100 歲資產</div><div className={'val '+(baseEnd>0?'up':'down')}>{fmtNum(baseEnd)} 萬</div>
              <div className="sub">{baseDep?'⚠ '+baseDep.age+'歲耗盡':'✓ 不耗盡'}</div></div>
            <div className="kpi"><div className="lab">有衝擊・100 歲資產</div><div className={'val '+(shockEnd>0?'up':'down')}>{fmtNum(shockEnd)} 萬</div>
              <div className="sub">{shockDep?'⚠ '+shockDep.age+'歲耗盡':'✓ 撐得住'}</div></div>
            <div className="kpi"><div className="lab">衝擊總額</div><div className="val down">{fmtNum(shockCost)} 萬</div>
              <div className="sub">{sh.shockAge}歲起 {sh.shockMonthly}萬/月×{sh.shockYears}年</div></div>
          </div>
          <div style={{fontSize:13.5,lineHeight:1.8,marginBottom:10}}>
            {survives
              ? <span className="up">✓ 即使遇到此長照衝擊，退休金仍撐得住（100 歲剩 {fmtNum(shockEnd)} 萬）。但建議仍預留長照預備金或投保長照險以策安全。</span>
              : <span className="down">✗ 此長照衝擊會讓退休金在 <b>{shockDep?shockDep.age:'—'} 歲</b>耗盡（比無衝擊{baseDep?'提前 '+(baseDep.age-shockDep.age)+' 年':'時還能撐'}）。建議額外準備約 <b>{fmtNum(shockCost)} 萬</b>長照預備金，或投保長照／失能險轉嫁風險。</span>}
          </div>
          <ChartBox type="line" height={250} data={{labels:base.map(x=>x.age+'歲'),datasets:[
            {label:'無衝擊',data:base.map(x=>x.value),borderColor:'#2ecc8f',pointRadius:0,borderWidth:2,tension:.3},
            {label:'遇長照衝擊',data:shocked.map(x=>x.value),borderColor:'#ff5d6c',backgroundColor:'rgba(255,93,108,.06)',fill:true,pointRadius:0,borderWidth:2,tension:.3},
          ]}} options={{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
            plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+Math.round(c.parsed.y).toLocaleString()+' 萬'}}},
            scales:{x:{ticks:{maxTicksLimit:10}},y:{ticks:{callback:v=>v>=10000?(v/10000)+'億':v+'萬'}}}}}/>
        </div>
      </div>

      <div>
        <div className="card" style={{border:'1px solid rgba(79,140,255,.25)'}}>
          <div style={{color:'var(--muted)',fontSize:12.5,lineHeight:1.7}}>
            本頁的目前資產、每月投入、年齡、退休年份、報酬率、年支出等，<b style={{color:'var(--text)'}}>共用上方「退休試算」的試算參數</b>，在上方修改即同步更新；下方僅需設定長照衝擊情境。</div>
        </div>
        <div className="card">
          <h3>長照衝擊情境</h3>
          {P('shockAge','發生年齡',1)}
          {N('shockMonthly','每月額外支出（元）',5000)}
          {P('shockYears','持續年數',1)}
          <div style={{color:'var(--muted)',fontSize:11.5,marginTop:8,lineHeight:1.6}}>
            參考：台灣全日照顧（看護/機構）常見每月 6–10 萬；失能/失智可能持續多年。預設 80 歲起每月 8 萬、5 年。</div>
        </div>
      </div>
    </div>
  </div>;
}

/* ---------- App ---------- */
function FirePage(){
  const plan=loadJSON(PLAN_KEY,{});
  const curYear=new Date().getFullYear();
  const age0=Number(plan.age)||40;
  const retireAge=Number(plan.retireAge)||60;
  const holdingsSum=plan.holdings? Object.values(plan.holdings).reduce((s,v)=>s+(Number(v)||0),0):0;
  const monthly0=(Number(plan.salary)||0)*((Number(plan.investRate)||0)/100);
  const [fireType,setFireType]=useState('regular');
  const [p,setP]=useState({
    age0, year0:curYear, asset0:Math.round(holdingsSum)||500,
    monthly:Math.round((monthly0||3)*10)/10, rWork:.07, rRetire:.04, inflation:.03,
    retireYear:curYear+Math.max(1,(retireAge-age0)), withdraw0:120,
    baristaIncome:60, baristaUntilAge:65,
  });
  const set=(k,v)=>setP(o=>({...o,[k]:v}));
  return <div>
    <FireStandalone p={p} setP={setP} set={set} fireType={fireType} setFireType={setFireType}/>
    <AdvancedAnalysis p={p} fireType={fireType}/>
  </div>;
}
const PAGES = [
  {id:'plan', icon:'🧮', nm:'規劃試算'},
  {id:'fire', icon:'🔥', nm:'退休試算'},
  {id:'protect',icon:'🛡️', nm:'保障檢查'},
  {id:'upload',icon:'📤', nm:'上傳分析'},
  {id:'curve',icon:'📉', nm:'資產曲線'},
  {id:'set',  icon:'⚙️', nm:'設定'},
];
function App(){
  const [authed,setAuthed] = useState(()=>{try{return sessionStorage.getItem('plan_auth')==='1';}catch(e){return false;}});
  const [page,setPage] = useState('plan');
  const [menuOpen,setMenuOpen] = useState(false);
  const D = SEED;
  if(!authed) return <Login onOk={()=>setAuthed(true)}/>;
  return <div className="app">
    <div className="mtopbar">
      <button className="mmenu-btn" onClick={()=>setMenuOpen(o=>!o)} aria-label="選單">☰</button>
      <div className="mtopbar-title">{(PAGES.find(p=>p.id===page)||{}).nm}</div>
    </div>
    <div className={'mbackdrop'+(menuOpen?' show':'')} onClick={()=>setMenuOpen(false)}></div>
    <div className={'sidebar'+(menuOpen?' open':'')}>
      <div className="logo">INV<span>·</span>退休投資規劃</div>
      {PAGES.map(p=><div key={p.id} className={'nav-item'+(page===p.id?' active':'')} onClick={()=>{setPage(p.id);setMenuOpen(false);window.scrollTo(0,0);}}>
        <span>{p.icon}</span><span className="nav-txt">{p.nm}</span></div>)}
      <div style={{position:'absolute',bottom:16,left:14,right:14,fontSize:11,color:'var(--muted)',lineHeight:1.6}}>
        <span className="conn-dot" style={{background:loadCfg().url?'#2ecc8f':'#f0b90b'}}></span>
        {loadCfg().url?'Supabase 已連線':'本機模式（未連雲端）'}<br/>v1.7 客戶端 · <span style={{cursor:'pointer',color:'var(--accent)'}} onClick={()=>{try{sessionStorage.removeItem('plan_auth');}catch(e){} setAuthed(false);}}>登出</span>
      </div>
    </div>
    <div className="main">
      {page==='plan'&&<Planner/>}
      {page==='fire'&&<FirePage/>}
      {page==='protect'&&<ProtectionCheck/>}
      {page==='upload'&&<AnalyzeUpload/>}
      {page==='curve'&&<Curve/>}
      {page==='set'&&<Settings/>}
      <div className="disclaimer">⚠ 本系統僅供個人財務規劃參考，不構成投資建議。投資有風險，過去績效不代表未來。勞退/勞保數字為估算，以勞動部/勞保局公告為準。 | v1.7</div>
    </div>
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
