/* ── Cursor ── */
const cur = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');

let mx=0,my=0,rx=0,ry=0;

document.addEventListener('mousemove',e=>{
  mx=e.clientX; my=e.clientY;
  cur.style.left=mx+'px';
  cur.style.top=my+'px';
});

(function animRing(){
  rx+=(mx-rx)*.12;
  ry+=(my-ry)*.12;
  ring.style.left=rx+'px';
  ring.style.top=ry+'px';
  requestAnimationFrame(animRing);
})();

/* ── Data ── */
let expenses = [];
let rowId = 0;

const CATEGORIES = ['Food','Subscriptions','Utilities','Transport','Shopping','Entertainment','Healthcare','Others'];
const CAT_CLASS = { 'Food':'tag-food','Subscriptions':'tag-sub','Utilities':'tag-util','Transport':'tag-trans','Shopping':'tag-misc','Entertainment':'tag-misc','Healthcare':'tag-util','Others':'tag-misc' };

function scrollToAnalyze(){ document.getElementById('analyze').scrollIntoView({behavior:'smooth'}); }

/* ── Add row ── */
function addRow(desc='',amt='',cat='Others',date=''){
  const today = date || new Date().toISOString().split('T')[0];
  const id = ++rowId;
  const div = document.createElement('div');
  div.className = 'expense-row';
  div.id = 'row-'+id;
  div.innerHTML = `
    <input placeholder="e.g. Netflix subscription" value="${desc}" id="desc-${id}" oninput="updateExpense(${id})"/>
    <input placeholder="0" type="number" value="${amt}" id="amt-${id}" oninput="updateExpense(${id})"/>
    <select class="col-cat" id="cat-${id}" onchange="updateExpense(${id})" style="background:transparent;border:none;color:var(--muted);font-family:var(--font-body);font-size:12px;cursor:none;outline:none;width:100%">
      ${CATEGORIES.map(c=>`<option value="${c}" style="background:#131820" ${c===cat?'selected':''}>${c}</option>`).join('')}
    </select>
    <input class="col-date" type="date" value="${today}" id="date-${id}" oninput="updateExpense(${id})" style="background:transparent;border:none;color:var(--muted);font-family:var(--font-body);font-size:12px;cursor:none;outline:none;width:100%"/>
    <button class="delete-btn" onclick="deleteRow(${id})">✕</button>
  `;
  document.getElementById('expenseRows').appendChild(div);
  expenses.push({id, desc, amt:parseFloat(amt)||0, cat, date:today});
  if(desc) showToast('Row added');
}

function updateExpense(id){
  const i = expenses.findIndex(e=>e.id===id);
  if(i===-1) return;
  expenses[i].desc = document.getElementById('desc-'+id).value;
  expenses[i].amt  = parseFloat(document.getElementById('amt-'+id).value)||0;
  expenses[i].cat  = document.getElementById('cat-'+id).value;
  expenses[i].date = document.getElementById('date-'+id).value;
}

function deleteRow(id){
  document.getElementById('row-'+id)?.remove();
  expenses = expenses.filter(e=>e.id!==id);
  showToast('Row removed');
}

/* ── Demo data ── */
function loadDemo(){
  document.getElementById('expenseRows').innerHTML=''; expenses=[]; rowId=0;
  const demo = [
    ['Netflix','649','Subscriptions'],['Amazon Prime','299','Subscriptions'],
    ['Hotstar','899','Subscriptions'],['Spotify','119','Subscriptions'],
    ['Swiggy Dinner','480','Food'],['Zomato Lunch','320','Food'],
    ['Uber Eats','270','Food'],['Random Snacks','150','Food'],
    ['Electricity','2100','Utilities'],['Internet','999','Utilities'],
    ['Mobile Plan','799','Utilities'],['Gym Membership','1500','Subscriptions'],
    ['Cab to Office','650','Transport'],['Petrol','1800','Transport'],
    ['New Shoes','2999','Shopping'],['Online Impulse Buy','1799','Shopping'],
    ['Movie Tickets','700','Entertainment'],['Coffee x30','1800','Food'],
    ['Cloud Storage','130','Subscriptions'],['VPN Service','250','Subscriptions'],
  ];
  const now = new Date();
  demo.forEach(([d,a,c],i)=>{
    const dt = new Date(now); dt.setDate(dt.getDate()-i*1.5);
    addRow(d,a,c,dt.toISOString().split('T')[0]);
  });
  showToast('Demo data loaded! Hit Analyze →');
  document.getElementById('analyze').scrollIntoView({behavior:'smooth'});
}

/* ── CSV ── */
function handleCSV(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(Boolean);
    document.getElementById('expenseRows').innerHTML=''; expenses=[]; rowId=0;
    lines.slice(1).forEach(line=>{
      const cols = line.split(',').map(s=>s.trim().replace(/"/g,''));
      if(cols.length>=2) addRow(cols[0],cols[1],cols[2]||'Others',cols[3]||'');
    });
    showToast(`Loaded ${lines.length-1} rows from CSV`);
  };
  reader.readAsText(file);
}

/* ── ANALYSIS ENGINE (Python logic ported to JS) ── */
function analyzeExpenses(){
  const rows = expenses.filter(e=>e.desc && e.amt>0);
  if(rows.length<2){ showToast('Add at least 2 expenses!'); return; }

  document.getElementById('loadingOverlay').classList.add('active');

  setTimeout(()=>{
    const result = runLeakDetector(rows);
    renderResults(result);
    document.getElementById('loadingOverlay').classList.remove('active');
    document.getElementById('results').scrollIntoView({behavior:'smooth'});
  }, 1800);
}

function runLeakDetector(rows){
  const total = rows.reduce((s,e)=>s+e.amt,0);

  // Category totals
  const catTotals = {};
  rows.forEach(e=>{
    catTotals[e.cat] = (catTotals[e.cat]||0) + e.amt;
  });

  // Detect leaks
  const leaks = [];

  // 1. Subscription creep
  const subs = rows.filter(e=>e.cat==='Subscriptions');
  const subTotal = subs.reduce((s,e)=>s+e.amt,0);
  if(subs.length>=3){
    leaks.push({
      name:'Subscription Creep',
      severity:'high',
      amount:subTotal,
      saving:Math.round(subTotal*0.4),
      tip:`You have ${subs.length} active subscriptions totalling ₹${subTotal.toLocaleString('en-IN')}. Many overlap in content — audit and cancel at least ${Math.floor(subs.length*0.4)} of them.`,
      items:subs.map(s=>s.desc)
    });
  }

  // 2. Food delivery over-spend
  const food = rows.filter(e=>e.cat==='Food');
  const foodTotal = food.reduce((s,e)=>s+e.amt,0);
  if(foodTotal > total * 0.22){
    leaks.push({
      name:'Food Delivery Overload',
      severity:'high',
      amount:foodTotal,
      saving:Math.round(foodTotal*0.45),
      tip:`Food expenses are ${Math.round(foodTotal/total*100)}% of your total spend — well above the recommended 15%. Cooking at home even 3 days/week could recover ₹${Math.round(foodTotal*0.45).toLocaleString('en-IN')}/month.`,
      items:food.map(f=>f.desc)
    });
  }

  // 3. Impulse shopping
  const shop = rows.filter(e=>e.cat==='Shopping');
  const shopTotal = shop.reduce((s,e)=>s+e.amt,0);
  if(shopTotal > total * 0.15){
    leaks.push({
      name:'Impulse Purchases',
      severity:'med',
      amount:shopTotal,
      saving:Math.round(shopTotal*0.5),
      tip:`Shopping is ${Math.round(shopTotal/total*100)}% of spending. Apply a 48-hour rule before any purchase over ₹500 to cut impulse buys by ~50%.`,
      items:shop.map(s=>s.desc)
    });
  }

  // 4. Transport redundancy
  const trans = rows.filter(e=>e.cat==='Transport');
  const transTotal = trans.reduce((s,e)=>s+e.amt,0);
  if(trans.length>=3 && transTotal>1000){
    leaks.push({
      name:'Transport Waste',
      severity:'med',
      amount:transTotal,
      saving:Math.round(transTotal*0.3),
      tip:`Multiple transport entries detected. Consider carpooling, monthly pass, or WFH days to reduce ₹${Math.round(transTotal*0.3).toLocaleString('en-IN')}/month.`,
      items:trans.map(t=>t.desc)
    });
  }

  // 5. Entertainment
  const ent = rows.filter(e=>e.cat==='Entertainment');
  const entTotal = ent.reduce((s,e)=>s+e.amt,0);
  if(entTotal > total * 0.1){
    leaks.push({
      name:'Entertainment Excess',
      severity:'low',
      amount:entTotal,
      saving:Math.round(entTotal*0.35),
      tip:'Entertainment exceeds 10% of your budget. Look for free events, family-share plans, and early-bird discounts.',
      items:ent.map(e=>e.desc)
    });
  }

  // 6. Utility spike
  const util = rows.filter(e=>e.cat==='Utilities');
  const utilTotal = util.reduce((s,e)=>s+e.amt,0);
  if(utilTotal > 3500){
    leaks.push({
      name:'Utility Overspend',
      severity:'low',
      amount:utilTotal,
      saving:Math.round(utilTotal*0.2),
      tip:'Utilities are high. Check for background AC/heating, vampire appliances, and consider a lower mobile plan tier.',
      items:util.map(u=>u.desc)
    });
  }

  // Compute health score
  const leakTotal = leaks.reduce((s,l)=>s+l.amount,0);
  const leakPct = leakTotal/total;
  let score = Math.round(100 - leakPct*120);
  score = Math.max(5, Math.min(100, score));

  const grade = score>=85?'A':score>=70?'B':score>=55?'C':score>=40?'D':'F';
  const verdict = score>=85?'Excellent control — minimal leaks detected':
                  score>=70?'Good shape, but a few leaks worth fixing':
                  score>=55?'Several leaks draining your budget':
                  score>=40?'Significant financial leakage detected':'Critical — money is flowing out fast';

  const totalSavings = leaks.reduce((s,l)=>s+l.saving,0);

  const recs = generateRecs(leaks, rows, total);

  return {rows, total, catTotals, leaks, score, grade, verdict, totalSavings, recs};
}

function generateRecs(leaks, rows, total){
  const recs = [];
  const high = leaks.filter(l=>l.severity==='high');
  const med  = leaks.filter(l=>l.severity==='med');

  if(high.find(l=>l.name.includes('Subscription'))){
    recs.push({title:'Subscription Audit Sprint',desc:'List every subscription. Cancel anything unused for 30+ days. Merge overlapping services (e.g. one streaming platform instead of three).',saving:'Save up to ₹1,200/month'});
  }
  if(high.find(l=>l.name.includes('Food'))){
    recs.push({title:'Meal Prep 3×/Week',desc:'Cook 3 batch meals per week. This alone typically halves food delivery spend with minimal time investment.',saving:'Save up to ₹1,800/month'});
  }
  if(med.find(l=>l.name.includes('Shopping'))){
    recs.push({title:'48-Hour Purchase Rule',desc:'Add items to cart, wait 48 hours. 60% of impulse items get abandoned naturally — no willpower required.',saving:'Save up to ₹900/month'});
  }
  if(med.find(l=>l.name.includes('Transport'))){
    recs.push({title:'Transport Optimization',desc:'Evaluate monthly metro/bus pass vs per-ride cost. Batch errands to reduce individual trips. Explore WFH negotiation.',saving:'Save up to ₹500/month'});
  }
  recs.push({title:'Zero-Based Budget Review',desc:'Assign every rupee a job at the start of the month. Studies show this alone reduces spending by 15% in the first month.',saving:'Ongoing control'});
  recs.push({title:'Automate Savings First',desc:'Set up auto-transfer of 20% income to savings the moment salary arrives. What you don\'t see, you don\'t spend.',saving:'Builds long-term wealth'});

  return recs;
}

/* ── RENDER ── */
function renderResults(r){
  const el = document.getElementById('results');
  const con = document.getElementById('resultsContainer');
  el.style.display = 'block'; el.classList.add('visible');

  const gradeColor = r.grade==='A'?'var(--accent)':r.grade==='B'?'#64c8ff':r.grade==='C'?'var(--warn)':r.grade==='D'?'var(--accent2)':'var(--accent2)';
  const ringColor  = gradeColor;
  const circum = 2*Math.PI*54;
  const dashOffset = circum*(1-r.score/100);

  // Category bar data
  const catEntries = Object.entries(r.catTotals).sort((a,b)=>b[1]-a[1]);
  const maxCat = catEntries[0]?.[1]||1;
  const BAR_COLORS = ['var(--accent)','var(--accent3)','var(--warn)','var(--accent2)','#64c8ff','#f0a0ff','#80ffaa','#ffaa80'];

  con.innerHTML = `
    <!-- Score -->
    <div class="section-tag">// Results</div>
    <h2 class="section-title" style="margin-bottom:32px">Your Financial <em>Health Report</em></h2>

    <div class="score-hero">
      <div class="score-ring-wrap">
        <svg class="score-svg" viewBox="0 0 120 120">
          <circle class="score-ring-bg" cx="60" cy="60" r="54"/>
          <circle class="score-ring-fg" id="scoreRing" cx="60" cy="60" r="54"
            stroke="${ringColor}"
            stroke-dasharray="${circum}"
            stroke-dashoffset="${circum}"/>
          <text x="60" y="56" text-anchor="middle" class="score-center" fill="${ringColor}" font-family="Syne,sans-serif" font-weight="800" font-size="28">${r.score}</text>
          <text x="60" y="70" text-anchor="middle" class="score-center-label" fill="#5a6070" font-family="DM Mono,monospace" font-size="9">/100</text>
        </svg>
      </div>
      <div class="score-info">
        <div class="score-grade" style="color:${gradeColor}">${r.grade}</div>
        <div class="score-verdict">${r.verdict}</div>
        <div class="score-meta">
          <div class="score-meta-item">
            <div class="label">Total Spend</div>
            <div class="value">₹${r.total.toLocaleString('en-IN')}</div>
          </div>
          <div class="score-meta-item">
            <div class="label">Leaks Found</div>
            <div class="value" style="color:var(--accent2)">${r.leaks.length}</div>
          </div>
          <div class="score-meta-item">
            <div class="label">Potential Savings</div>
            <div class="value" style="color:var(--accent)">₹${r.totalSavings.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leaks -->
    <div class="section-tag" style="margin-top:48px">// Detected Leaks</div>
    <h3 class="section-title" style="font-size:28px;margin-bottom:0">${r.leaks.length} expense leak${r.leaks.length!==1?'s':''} <em>identified</em></h3>
    ${r.leaks.length===0?'<p style="color:var(--muted);margin-top:16px">No significant leaks detected. Your spending looks well-controlled! 🎉</p>':''}
    <div class="leaks-grid">
      ${r.leaks.map((l,i)=>`
        <div class="leak-card leak-${l.severity}" style="animation-delay:${i*0.08}s">
          <div class="leak-severity">
            <div class="sev-dot"></div>
            ${l.severity==='high'?'HIGH LEAK':l.severity==='med'?'MEDIUM LEAK':'LOW LEAK'}
          </div>
          <div class="leak-name">${l.name}</div>
          <div class="leak-amount">₹${l.amount.toLocaleString('en-IN')}</div>
          <div class="leak-tip">${l.tip}</div>
          <div class="leak-saving">💡 Potential saving: ₹${l.saving.toLocaleString('en-IN')}/mo</div>
        </div>
      `).join('')}
    </div>

    <!-- Chart -->
    <div class="chart-wrap" style="margin-top:40px">
      <div class="chart-title">Spending Breakdown by Category</div>
      <div class="bar-chart">
        ${catEntries.map(([cat,amt],i)=>`
          <div class="bar-row">
            <div class="bar-label">${cat}</div>
            <div class="bar-track">
              <div class="bar-fill" id="bar-${i}" style="width:0%;background:${BAR_COLORS[i%BAR_COLORS.length]}"></div>
            </div>
            <div class="bar-val" style="color:${BAR_COLORS[i%BAR_COLORS.length]}">₹${amt.toLocaleString('en-IN')}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- AI Summary -->
    <div class="ai-summary" style="margin-top:32px">
      <div class="ai-badge">⬡ AI Analysis</div>
      <div class="ai-text">
        ${buildSummary(r)}
      </div>
    </div>

    <!-- Recs -->
    <div class="section-tag" style="margin-top:48px">// Action Plan</div>
    <h3 class="section-title" style="font-size:28px;margin-bottom:24px">Your personalized <em>fix list</em></h3>
    <div class="rec-list">
      ${r.recs.map((rec,i)=>`
        <div class="rec-item" style="animation-delay:${i*0.1}s">
          <div class="rec-num">${String(i+1).padStart(2,'0')}</div>
          <div class="rec-body">
            <div class="rec-title">${rec.title}</div>
            <div class="rec-desc">${rec.desc}</div>
            <div class="rec-save">${rec.saving}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Animate ring
  setTimeout(()=>{
    const ring = document.getElementById('scoreRing');
    if(ring){ const c=2*Math.PI*54; ring.style.strokeDashoffset = c*(1-r.score/100); }
    // Animate bars
    const catE = Object.entries(r.catTotals).sort((a,b)=>b[1]-a[1]);
    const mx = catE[0]?.[1]||1;
    catE.forEach(([,amt],i)=>{
      const bar = document.getElementById('bar-'+i);
      if(bar) setTimeout(()=>{ bar.style.width=(amt/mx*100)+'%'; },i*80);
    });
  }, 100);
}

function buildSummary(r){
  const highLeaks = r.leaks.filter(l=>l.severity==='high');
  const pct = Math.round(r.leaks.reduce((s,l)=>s+l.amount,0)/r.total*100);
  let txt = `Your total monthly expenditure is <strong>₹${r.total.toLocaleString('en-IN')}</strong>, of which approximately <strong>${pct}%</strong> flows through detected leak areas. `;

  if(highLeaks.length>0){
    txt += `The most critical leaks are in <strong>${highLeaks.map(l=>l.name).join(' and ')}</strong> — these alone account for ₹${highLeaks.reduce((s,l)=>s+l.amount,0).toLocaleString('en-IN')} and should be addressed first. `;
  }
  if(r.totalSavings>0){
    txt += `By implementing the recommendations below, you could realistically recover <strong>₹${r.totalSavings.toLocaleString('en-IN')}/month</strong> — that's <strong>₹${(r.totalSavings*12).toLocaleString('en-IN')} per year</strong> redirected to savings or investments. `;
  }
  txt += `Focus on the high-severity items first, then revisit this analysis in 30 days to track progress.`;
  return txt;
}

/* ── Toast ── */
function showToast(msg){
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}

/* ── Init with 3 empty rows ── */
addRow('Netflix','649','Subscriptions');
addRow('Swiggy Dinner','480','Food');
addRow('Electricity Bill','2100','Utilities');