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

/* ── ANALYSIS ENGINE (Connecting to Python AI) ── */
async function analyzeExpenses() {
  const rows = expenses.filter(e => e.desc && e.amt > 0);
  
  if(rows.length < 2) {
    showToast("Please add at least 2 valid expenses.");
    return;
  }

  // Optional: show the loading overlay
  const loader = document.getElementById('loadingOverlay');
  if(loader) loader.classList.add('active');

  try {
    const res = await fetch("http://localhost:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        expenses: rows.map(e => ({ desc: e.desc, amount: e.amt, category: e.cat, date: e.date })),
        rules: customRules
      })
    });
    
    const result = await res.json();
    
    if(loader) loader.classList.remove('active');

    if(result.error) {
      showToast("Error: " + result.error);
      return;
    }

    renderResults(result); 
  } catch (error) {
    if(loader) loader.classList.remove('active');
    console.error(error);
    showToast("Failed to connect to Server");
  }
}

/* ── RENDER ── */
function renderResults(r){
  const el = document.getElementById('results');
  const con = document.getElementById('resultsContainer');
  el.style.display = 'block'; el.classList.add('visible');

  // The Python API returns health data slightly differently than the old JS
  const score = r.health.score;
  const grade = r.health.grade;
  const verdict = r.health.verdict;
  const totalSavings = r.health.total_savings;

  const gradeColor = grade==='A'?'var(--accent)':grade==='B'?'#64c8ff':grade==='C'?'var(--warn)':grade==='D'?'var(--accent2)':'var(--accent2)';
  const ringColor  = gradeColor;
  const circum = 2*Math.PI*54;
  const dashOffset = circum*(1-score/100);

  // Category bar data
  const catEntries = Object.entries(r.category_totals).sort((a,b)=>b[1]-a[1]);
  const maxCat = catEntries[0]?.[1]||1;
  const BAR_COLORS = ['var(--accent)','var(--accent3)','var(--warn)','var(--accent2)','#64c8ff','#f0a0ff','#80ffaa','#ffaa80'];

  con.innerHTML = `
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
          <text x="60" y="56" text-anchor="middle" class="score-center" fill="${ringColor}" font-family="Syne,sans-serif" font-weight="800" font-size="28">${score}</text>
          <text x="60" y="70" text-anchor="middle" class="score-center-label" fill="#5a6070" font-family="DM Mono,monospace" font-size="9">/100</text>
        </svg>
      </div>
      <div class="score-info">
        <div class="score-grade" style="color:${gradeColor}">${grade}</div>
        <div class="score-verdict">${verdict}</div>
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
            <div class="value" style="color:var(--accent)">₹${totalSavings.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>

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

    <div class="ai-summary" style="margin-top:32px">
      <div class="ai-badge">⬡ AI Analysis</div>
      <div class="ai-text">
        ${buildSummary(r)}
      </div>
    </div>

    <div class="section-tag" style="margin-top:48px">// Action Plan</div>
    <h3 class="section-title" style="font-size:28px;margin-bottom:24px">Your personalized <em>fix list</em></h3>
    <div class="rec-list">
      ${r.recommendations.map((rec,i)=>`
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
    if(ring){ const c=2*Math.PI*54; ring.style.strokeDashoffset = c*(1-score/100); }
    // Animate bars
    const catE = Object.entries(r.category_totals).sort((a,b)=>b[1]-a[1]);
    const mx = catE[0]?.[1]||1;
    catE.forEach(([,amt],i)=>{
      const bar = document.getElementById('bar-'+i);
      if(bar) setTimeout(()=>{ bar.style.width=(amt/mx*100)+'%'; },i*80);
    });
  }, 100);
  
  // Scroll to results
  document.getElementById('results').scrollIntoView({behavior: 'smooth'});
}

function buildSummary(r){
  const highLeaks = r.leaks.filter(l=>l.severity==='high');
  const pct = Math.round(r.leaks.reduce((s,l)=>s+l.amount,0)/r.total*100);
  let txt = `Your total monthly expenditure is <strong>₹${r.total.toLocaleString('en-IN')}</strong>, of which approximately <strong>${pct}%</strong> flows through detected leak areas. `;

  if(highLeaks.length>0){
    txt += `The most critical leaks are in <strong>${highLeaks.map(l=>l.name).join(' and ')}</strong> — these alone account for ₹${highLeaks.reduce((s,l)=>s+l.amount,0).toLocaleString('en-IN')} and should be addressed first. `;
  }
  if(r.health.total_savings>0){
    txt += `By implementing the recommendations below, you could realistically recover <strong>₹${r.health.total_savings.toLocaleString('en-IN')}/month</strong> — that's <strong>₹${(r.health.total_savings*12).toLocaleString('en-IN')} per year</strong> redirected to savings or investments. `;
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

/* ── Custom Rules Engine ── */
let customRules = [];

function addCustomRule() {
  const name = document.getElementById('ruleName').value;
  const cat = document.getElementById('ruleCat').value;
  const pct = parseFloat(document.getElementById('rulePct').value);
  const min = parseFloat(document.getElementById('ruleMin').value);
  const sev = document.getElementById('ruleSev').value;

  if(!name || !pct || !min) {
    showToast("Please fill in Rule Name, Max %, and Min Amount");
    return;
  }

  customRules.push({ name, category: cat, max_pct: pct, min_amount: min, severity: sev });
  
  // Clear inputs
  document.getElementById('ruleName').value = '';
  document.getElementById('rulePct').value = '';
  document.getElementById('ruleMin').value = '';

  renderRules();
  showToast("Custom rule added!");
}

function removeRule(index) {
  customRules.splice(index, 1);
  renderRules();
}

function renderRules() {
  const container = document.getElementById('activeRulesList');
  if(customRules.length === 0) {
    container.innerHTML = `<div style="color:var(--muted); font-size:12px; margin-top:16px;">Using AI Default Rules. Add a rule above to override.</div>`;
    return;
  }

  container.innerHTML = customRules.map((r, i) => `
    <div class="active-rule-item">
      <div><strong>${r.name}</strong> • ${r.category} > ${r.max_pct}% AND > ₹${r.min_amount} (${r.severity})</div>
      <button onclick="removeRule(${i})" style="background:none; border:none; color:var(--accent2); cursor:pointer;">✕</button>
    </div>
  `).join('');
}

// Initialize empty rules display
renderRules();

function toggleDropdown() {
  document.getElementById('dropdownOptions').classList.toggle('show');
}

function selectSeverity(value, text) {
  // Update the hidden input value
  document.getElementById('ruleSev').value = value;
  // Update the displayed text
  document.querySelector('.dropdown-selected').innerText = text;
  // Close the dropdown
  document.getElementById('dropdownOptions').classList.remove('show');
}

// Close dropdown if clicked outside
window.onclick = function(event) {
  if (!event.target.matches('.dropdown-selected')) {
    const dropdowns = document.getElementsByClassName("dropdown-options");
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].classList.remove('show');
    }
  }
}
/* ── Custom Dropdown Logic ── */
function toggleDropdown(menuId, event) {
  event.stopPropagation(); // Prevent immediate closing
  // Close all other dropdowns first
  document.querySelectorAll('.dropdown-options').forEach(menu => {
    if (menu.id !== menuId) menu.classList.remove('show');
  });
  // Toggle the clicked one
  document.getElementById(menuId).classList.toggle('show');
}

function setOption(inputId, displayId, value, text = null) {
  document.getElementById(inputId).value = value;
  document.getElementById(displayId).innerText = text || value;
}

// Close dropdowns if the user clicks anywhere else on the screen
window.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-options').forEach(menu => {
    menu.classList.remove('show');
  });
});