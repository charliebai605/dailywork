const OWNER = 'charliebai605';
const REPO = 'dailywork';
const FILE = 'data.json';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

class ExpenseTracker {
  constructor() {
    this.data = null;
    this.currentRate = 0.197;
    this.init();
  }

  async init() {
    await this.loadData();
    await this.updateExchangeRate();
    this.recalculateEstimates();
    this.render();
  }

  async loadData() {
    try {
      const response = await fetch('data.json');
      const text = await response.text();
      this.data = JSON.parse(text);
    } catch (error) {
      this.data = { expenses: [], exchangeRates: [], metadata: {} };
    }
  }

  async updateExchangeRate() {
    try {
      const btn = document.querySelector('.refresh-btn');
      if (btn) { btn.disabled = true; btn.textContent = '更新中...'; }

      const res = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
      const data = await res.json();
      this.currentRate = data.rates?.TWD || 0.197;

      if (!this.data.metadata) this.data.metadata = {};
      this.data.metadata.lastUpdated = new Date().toISOString();

      if (!this.data.exchangeRates) this.data.exchangeRates = [];
      const today = new Date().toISOString().split('T')[0];
      const existing = this.data.exchangeRates.find(r => r.date === today);
      if (existing) {
        existing.rate = this.currentRate;
      } else {
        this.data.exchangeRates.unshift({ date: today, rate: this.currentRate, source: 'exchangerate-api.com' });
        this.data.exchangeRates = this.data.exchangeRates.slice(0, 30);
      }

      if (btn) { btn.disabled = false; btn.textContent = '🔄 更新匯率'; }
    } catch {
      const btn = document.querySelector('.refresh-btn');
      if (btn) { btn.disabled = false; btn.textContent = '🔄 更新匯率'; }
    }
  }

  recalculateEstimates() {
    if (!this.data?.expenses) return;
    this.data.expenses.forEach(e => {
      if (e.amountJPY > 0) e.estimateTWD = Math.round(e.amountJPY * this.currentRate);
    });
  }

  getFilteredExpenses() {
    const cat = document.getElementById('filter-category')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    return (this.data?.expenses || []).filter(e => {
      if (cat && e.category !== cat) return false;
      if (status === 'paid' && !e.isPaid) return false;
      if (status === 'pending' && e.isPaid) return false;
      return true;
    });
  }

  render() {
    this.renderStats();
    this.renderCategoryStats();
    this.renderTable();
    this.renderFooter();
    const el = document.getElementById('rate-display');
    if (el) el.textContent = this.currentRate.toFixed(4);
  }

  renderStats() {
    const all = this.data?.expenses || [];
    let paid = 0, pending = 0;
    all.forEach(e => {
      const amt = e.actualTWD || e.estimateTWD || 0;
      if (e.isPaid) paid += amt; else pending += amt;
    });
    document.getElementById('stats').innerHTML = `
      <div class="stat-card paid">
        <div class="stat-label">已支出</div>
        <div class="stat-value">NT$${fmt(paid)}</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-label">未來支出 (${all.filter(e=>!e.isPaid).length} 筆)</div>
        <div class="stat-value">NT$${fmt(pending)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">總計</div>
        <div class="stat-value">NT$${fmt(paid + pending)}</div>
      </div>
    `;
  }

  renderCategoryStats() {
    const all = this.data?.expenses || [];
    const map = {};
    all.forEach(e => {
      const amt = e.actualTWD || e.estimateTWD || 0;
      map[e.category] = (map[e.category] || 0) + amt;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    document.getElementById('category-stats').innerHTML = sorted.map(([cat, amt]) => `
      <div class="cat-item">
        <span class="category-badge ${cat}">${getCatName(cat)}</span>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${total ? Math.round(amt/total*100) : 0}%"></div>
        </div>
        <span class="cat-amt">NT$${fmt(amt)}</span>
      </div>
    `).join('');
  }

  renderTable() {
    const expenses = this.getFilteredExpenses()
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!expenses.length) {
      document.getElementById('table-wrapper').innerHTML =
        '<p style="text-align:center;padding:40px;color:#6b7280;">沒有符合條件的記錄</p>';
      return;
    }

    const rows = expenses.map(e => `
      <tr>
        <td class="date-cell">${fmtDate(e.date)}</td>
        <td><strong>${e.name}</strong></td>
        <td><span class="category-badge ${e.category}">${getCatName(e.category)}</span></td>
        <td class="amount-cell">${e.amountJPY ? '¥' + fmt(e.amountJPY) : '-'}</td>
        <td class="twd-cell estimate">${e.estimateTWD ? 'NT$' + fmt(e.estimateTWD) : '-'}</td>
        <td class="twd-cell actual">${e.actualTWD ? 'NT$' + fmt(e.actualTWD) : '-'}</td>
        <td>
          <button class="status-badge ${e.isPaid ? 'paid' : 'pending'}" onclick="togglePaid(${e.id})" title="點擊切換">
            ${e.isPaid ? '✓ 已支出' : '⏳ 未支出'}
          </button>
        </td>
        <td class="notes">${e.notes || '-'}</td>
        <td class="action-cell">
          <button class="edit-btn" onclick="openForm(${e.id})" title="編輯">✏️</button>
          <button class="delete-btn" onclick="deleteExpense(${e.id}, '${e.name.replace(/'/g, "\\'")}')" title="刪除">🗑️</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('table-wrapper').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>日期</th><th>項目</th><th>分類</th>
            <th>JPY</th><th>預估台幣</th><th>實際台幣</th>
            <th>狀態</th><th>備註</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderFooter() {
    const last = this.data?.metadata?.lastUpdated;
    const el = document.getElementById('last-updated');
    if (el && last) el.textContent = `⏰ 上次更新: ${new Date(last).toLocaleString('zh-TW')}`;
  }
}

// === 工具函數 ===
function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function getCatName(c) {
  return { Housing:'住宿', Transport:'交通', Food:'食物', Flight:'機票', Other:'其他' }[c] || c;
}

function getToken() {
  const t = localStorage.getItem('github_token');
  if (t) return t;
  const el = document.getElementById('f-token');
  return el ? el.value.trim() : '';
}

async function githubGet() {
  const token = getToken();
  if (!token) throw new Error('請先輸入 GitHub Token');
  const res = await fetch(API, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error('無法取得資料，請確認 Token 是否正確');
  const file = await res.json();
  const content = JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g, '')))));
  return { content, sha: file.sha, token };
}

async function githubPut(content, sha, token, message) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      sha
    })
  });
  if (!res.ok) throw new Error('儲存失敗');
}

// === Modal 控制 ===
function openForm(id = null) {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-id').value = id || '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-date').value = today;
  document.getElementById('f-category').value = 'Food';
  document.getElementById('f-jpy').value = '';
  document.getElementById('f-twd').value = '';
  document.getElementById('f-paid').checked = false;
  document.getElementById('f-notes').value = '';
  document.getElementById('form-msg').style.display = 'none';

  const savedToken = localStorage.getItem('github_token');
  if (savedToken) document.getElementById('f-token').value = savedToken;

  if (id) {
    // 編輯模式：填入現有資料
    const expense = tracker.data.expenses.find(e => e.id === id);
    if (expense) {
      document.getElementById('modal-title').textContent = '編輯支出';
      document.getElementById('f-name').value = expense.name;
      document.getElementById('f-date').value = expense.date;
      document.getElementById('f-category').value = expense.category;
      document.getElementById('f-jpy').value = expense.amountJPY || '';
      document.getElementById('f-twd').value = expense.actualTWD || '';
      document.getElementById('f-paid').checked = expense.isPaid;
      document.getElementById('f-notes').value = expense.notes || '';
    }
  } else {
    document.getElementById('modal-title').textContent = '新增支出';
  }

  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('f-name').focus();
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

// === CRUD ===
async function saveExpense() {
  const id = document.getElementById('f-id').value;
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  const category = document.getElementById('f-category').value;
  const jpy = parseFloat(document.getElementById('f-jpy').value) || 0;
  const twd = document.getElementById('f-twd').value ? parseFloat(document.getElementById('f-twd').value) : null;
  const isPaid = document.getElementById('f-paid').checked;
  const notes = document.getElementById('f-notes').value.trim();
  const token = document.getElementById('f-token').value.trim();

  if (!name) return showMsg('❌ 請填寫項目名稱', 'error');
  if (!date) return showMsg('❌ 請填寫日期', 'error');
  if (!token) return showMsg('❌ 請填寫 GitHub Token', 'error');
  localStorage.setItem('github_token', token);

  const btn = document.querySelector('.submit-btn');
  btn.disabled = true; btn.textContent = '儲存中...';

  try {
    const { content, sha } = await githubGet();
    const estimateTWD = jpy > 0 ? Math.round(jpy * tracker.currentRate) : (twd || 0);

    if (id) {
      // 編輯
      const idx = content.expenses.findIndex(e => e.id === parseInt(id));
      if (idx !== -1) {
        content.expenses[idx] = { ...content.expenses[idx], name, date, category, amountJPY: jpy, actualTWD: twd, estimateTWD, isPaid, notes };
      }
      await githubPut(content, sha, token, `編輯支出：${name}`);
      showMsg('✅ 已更新！', 'success');
    } else {
      // 新增
      const newId = Math.max(0, ...content.expenses.map(e => e.id)) + 1;
      content.expenses.push({ id: newId, name, date, category, amountJPY: jpy, actualTWD: twd, estimateTWD, isPaid, notes });
      content.metadata.lastUpdated = new Date().toISOString();
      await githubPut(content, sha, token, `新增支出：${name}`);
      showMsg('✅ 已新增！', 'success');
    }

    tracker.data = content;
    tracker.recalculateEstimates();
    tracker.render();
    setTimeout(() => closeModal(), 800);
  } catch (err) {
    showMsg(`❌ ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '儲存';
  }
}

async function deleteExpense(id, name) {
  if (!confirm(`確定要刪除「${name}」嗎？`)) return;
  const token = getToken();
  if (!token) { openForm(); return; }

  try {
    const { content, sha } = await githubGet();
    content.expenses = content.expenses.filter(e => e.id !== id);
    content.metadata.lastUpdated = new Date().toISOString();
    await githubPut(content, sha, token, `刪除支出：${name}`);
    tracker.data = content;
    tracker.recalculateEstimates();
    tracker.render();
  } catch (err) {
    alert(`❌ ${err.message}`);
  }
}

async function togglePaid(id) {
  const token = getToken();
  if (!token) { alert('請先在表單中輸入 GitHub Token'); openForm(); return; }

  try {
    const { content, sha } = await githubGet();
    const exp = content.expenses.find(e => e.id === id);
    if (!exp) return;
    exp.isPaid = !exp.isPaid;
    content.metadata.lastUpdated = new Date().toISOString();
    await githubPut(content, sha, token, `更新狀態：${exp.name}`);
    tracker.data = content;
    tracker.render();
  } catch (err) {
    alert(`❌ ${err.message}`);
  }
}

// === 匯出 CSV ===
function exportCSV() {
  const expenses = tracker.data?.expenses || [];
  const header = ['日期', '項目', '分類', '金額(JPY)', '預估台幣', '實際台幣', '已支出', '備註'];
  const rows = expenses.map(e => [
    e.date, e.name, getCatName(e.category),
    e.amountJPY || 0, e.estimateTWD || 0, e.actualTWD || '',
    e.isPaid ? '是' : '否', e.notes || ''
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `支出記帳_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function showMsg(text, type) {
  const el = document.getElementById('form-msg');
  el.className = type === 'success' ? 'msg-success' : 'msg-error';
  el.textContent = text;
  el.style.display = 'block';
}

let tracker;
document.addEventListener('DOMContentLoaded', () => {
  tracker = new ExpenseTracker();
});
