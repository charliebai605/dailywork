const OWNER = 'charliebai605';
const REPO = 'dailywork';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

// ── 加密工具 ──────────────────────────────────────────
async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function bytesToB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function decryptData(encrypted, password) {
  const salt = b64ToBytes(encrypted.salt);
  const iv = b64ToBytes(encrypted.iv);
  const data = b64ToBytes(encrypted.data);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function encryptData(obj, password, existingSalt = null) {
  const salt = existingSalt ? b64ToBytes(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify(obj))
  );
  return {
    v: 1,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(encrypted)
  };
}

// ── 密碼管理 ──────────────────────────────────────────
function getPassword() { return sessionStorage.getItem('vault_pw'); }
function savePassword(pw) { sessionStorage.setItem('vault_pw', pw); }
function clearPassword() { sessionStorage.removeItem('vault_pw'); }

// ── GitHub API ────────────────────────────────────────
function getToken() {
  return localStorage.getItem('github_token') || '';
}

async function githubGet(file) {
  const token = getToken();
  if (!token) throw new Error('請先輸入 GitHub Token');
  const res = await fetch(`${API}/${file}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error('無法取得資料，請確認 Token 是否正確');
  const json = await res.json();
  const content = JSON.parse(decodeURIComponent(escape(atob(json.content.replace(/\n/g, '')))));
  return { content, sha: json.sha, token };
}

async function githubPut(file, content, sha, token, message) {
  const res = await fetch(`${API}/${file}`, {
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

// ── 主程式 ────────────────────────────────────────────
class ExpenseTracker {
  constructor() {
    this.expenses = [];
    this.currentRate = 0.197;
    this.encryptedShell = null; // 保存 salt 供重新加密用
  }

  async init() {
    await this.updateExchangeRate();
    await this.unlock();
  }

  async unlock(forcePrompt = false) {
    let password = forcePrompt ? null : getPassword();

    if (!password) {
      document.getElementById('lock-screen').style.display = 'flex';
      return;
    }

    await this.loadAndDecrypt(password);
  }

  async loadAndDecrypt(password) {
    try {
      const res = await fetch('data.json');
      const raw = await res.json();

      if (raw.v === 1) {
        // 加密格式
        this.encryptedShell = raw;
        const decrypted = await decryptData(raw, password);
        // 相容兩種格式：只加密 expenses 陣列，或整個 JSON 物件
        this.expenses = Array.isArray(decrypted) ? decrypted : (decrypted.expenses || []);
      } else {
        // 舊的明文格式（相容）
        this.expenses = raw.expenses || [];
      }

      savePassword(password);
      document.getElementById('lock-screen').style.display = 'none';
      this.recalculateEstimates();
      this.render();
    } catch (err) {
      if (err.name === 'OperationError') {
        showLockError('密碼錯誤，請再試一次');
      } else {
        showLockError(`載入失敗：${err.message}`);
      }
    }
  }

  async updateExchangeRate() {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
      const data = await res.json();
      this.currentRate = data.rates?.TWD || 0.197;
    } catch { /* 使用預設值 */ }
    const el = document.getElementById('rate-display');
    if (el) el.textContent = this.currentRate.toFixed(4);
  }

  recalculateEstimates() {
    this.expenses.forEach(e => {
      if (e.amountJPY > 0) e.estimateTWD = Math.round(e.amountJPY * this.currentRate);
    });
  }

  getFilteredExpenses() {
    const cat = document.getElementById('filter-category')?.value || '';
    const payment = document.getElementById('filter-payment')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    return this.expenses.filter(e => {
      if (cat && e.category !== cat) return false;
      if (payment && (e.paymentMethod || 'cash') !== payment) return false;
      if (status === 'paid' && !e.isPaid) return false;
      if (status === 'pending' && e.isPaid) return false;
      return true;
    });
  }

  getSuicaStats() {
    let topup = 0, spent = 0;
    this.expenses.forEach(e => {
      if (e.paymentMethod === 'suica-topup') topup += e.amountJPY || 0;
      if (e.paymentMethod === 'suica') spent += e.amountJPY || 0;
    });
    return { topup, spent, balance: topup - spent };
  }

  async saveToGitHub(message) {
    const password = getPassword();
    const { sha, token } = await githubGet('data.json');
    const encrypted = await encryptData(
      this.expenses,
      password,
      this.encryptedShell?.salt
    );
    this.encryptedShell = encrypted;
    await githubPut('data.json', encrypted, sha, token, message);
  }

  render() {
    this.renderStats();
    this.renderSuicaPanel();
    this.renderCategoryStats();
    this.renderTable();
    const el = document.getElementById('rate-display');
    if (el) el.textContent = this.currentRate.toFixed(4);
  }

  renderSuicaPanel() {
    const { topup, spent, balance } = this.getSuicaStats();
    if (topup === 0) {
      document.getElementById('suica-panel').innerHTML = '';
      return;
    }
    const pct = topup > 0 ? Math.round((spent / topup) * 100) : 0;
    const balanceColor = balance < 2000 ? '#ef4444' : balance < 5000 ? '#f59e0b' : '#10b981';
    document.getElementById('suica-panel').innerHTML = `
      <div class="suica-card">
        <div class="suica-header">
          <span class="suica-title">🚇 西瓜卡</span>
          <span class="suica-balance" style="color:${balanceColor}">剩餘 ¥${fmt(balance)}</span>
        </div>
        <div class="suica-bar-wrap">
          <div class="suica-bar" style="width:${pct}%; background:${balanceColor}"></div>
        </div>
        <div class="suica-details">
          <span>儲值 ¥${fmt(topup)}</span>
          <span>已用 ¥${fmt(spent)}</span>
        </div>
      </div>
    `;
  }

  renderStats() {
    let paid = 0, pending = 0;
    this.expenses.forEach(e => {
      const amt = e.actualTWD || e.estimateTWD || 0;
      if (e.isPaid) paid += amt; else pending += amt;
    });
    document.getElementById('stats').innerHTML = `
      <div class="stat-card paid">
        <div class="stat-label">已支出</div>
        <div class="stat-value">NT$${fmt(paid)}</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-label">未來支出 (${this.expenses.filter(e => !e.isPaid).length} 筆)</div>
        <div class="stat-value">NT$${fmt(pending)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">總計</div>
        <div class="stat-value">NT$${fmt(paid + pending)}</div>
      </div>
    `;
  }

  renderCategoryStats() {
    const map = {};
    this.expenses.forEach(e => {
      const amt = e.actualTWD || e.estimateTWD || 0;
      map[e.category] = (map[e.category] || 0) + amt;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    document.getElementById('category-stats').innerHTML = sorted.map(([cat, amt]) => `
      <div class="cat-item">
        <span class="category-badge ${cat}">${getCatName(cat)}</span>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${total ? Math.round(amt / total * 100) : 0}%"></div>
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
        <td><span class="payment-badge ${e.paymentMethod || 'cash'}">${getPaymentName(e.paymentMethod)}</span></td>
        <td class="amount-cell">${e.amountJPY ? '¥' + fmt(e.amountJPY) : '-'}</td>
        <td class="twd-cell estimate">${e.estimateTWD ? 'NT$' + fmt(e.estimateTWD) : '-'}</td>
        <td class="twd-cell actual">${e.actualTWD ? 'NT$' + fmt(e.actualTWD) : '-'}</td>
        <td>
          <button class="status-badge ${e.isPaid ? 'paid' : 'pending'}" onclick="togglePaid(${e.id})">
            ${e.isPaid ? '✓ 已支出' : '⏳ 未支出'}
          </button>
        </td>
        <td class="notes">${e.notes || '-'}</td>
        <td class="action-cell">
          <button class="edit-btn" onclick="openForm(${e.id})">✏️</button>
          <button class="delete-btn" onclick="deleteExpense(${e.id}, '${e.name.replace(/'/g, "\\'")}')">🗑️</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('table-wrapper').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>日期</th><th>項目</th><th>分類</th><th>付款</th>
            <th>JPY</th><th>預估台幣</th><th>實際台幣</th>
            <th>狀態</th><th>備註</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}

// ── 工具函數 ──────────────────────────────────────────
function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function getCatName(c) {
  return { Housing: '住宿', Transport: '交通', Food: '食物', Flight: '機票', Other: '其他' }[c] || c;
}

function getPaymentName(p) {
  return { cash: '現金', suica: '🚇 西瓜卡', 'suica-topup': '🚇 儲值', card: '💳 信用卡' }[p] || '現金';
}

function showLockError(msg) {
  const el = document.getElementById('lock-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── 密碼輸入 ──────────────────────────────────────────
async function submitPassword() {
  const pw = document.getElementById('lock-password').value;
  if (!pw) return;
  document.getElementById('lock-error').style.display = 'none';
  await tracker.loadAndDecrypt(pw);
}

function lockApp() {
  clearPassword();
  location.reload();
}

// ── Modal 控制 ────────────────────────────────────────
function openForm(id = null) {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-id').value = id || '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-date').value = today;
  document.getElementById('f-category').value = 'Food';
  document.getElementById('f-jpy').value = '';
  document.getElementById('f-twd').value = '';
  document.getElementById('f-paid').checked = true;
  document.getElementById('f-notes').value = '';
  document.getElementById('form-msg').style.display = 'none';

  const savedToken = localStorage.getItem('github_token');
  if (savedToken) document.getElementById('f-token').value = savedToken;

  if (id) {
    const expense = tracker.expenses.find(e => e.id === id);
    if (expense) {
      document.getElementById('modal-title').textContent = '編輯支出';
      document.getElementById('f-name').value = expense.name;
      document.getElementById('f-date').value = expense.date;
      document.getElementById('f-category').value = expense.category;
      document.getElementById('f-payment').value = expense.paymentMethod || 'cash';
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

// ── CRUD ──────────────────────────────────────────────
async function saveExpense() {
  const id = document.getElementById('f-id').value;
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  const category = document.getElementById('f-category').value;
  const paymentMethod = document.getElementById('f-payment').value;
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
    const estimateTWD = jpy > 0 ? Math.round(jpy * tracker.currentRate) : (twd || 0);

    if (id) {
      const idx = tracker.expenses.findIndex(e => e.id === parseInt(id));
      if (idx !== -1) tracker.expenses[idx] = { ...tracker.expenses[idx], name, date, category, paymentMethod, amountJPY: jpy, actualTWD: twd, estimateTWD, isPaid, notes };
      await tracker.saveToGitHub(`編輯支出：${name}`);
      showMsg('✅ 已更新！', 'success');
    } else {
      const newId = Math.max(0, ...tracker.expenses.map(e => e.id)) + 1;
      tracker.expenses.push({ id: newId, name, date, category, paymentMethod, amountJPY: jpy, actualTWD: twd, estimateTWD, isPaid, notes });
      await tracker.saveToGitHub(`新增支出：${name}`);
      showMsg('✅ 已新增！', 'success');
    }

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
  try {
    tracker.expenses = tracker.expenses.filter(e => e.id !== id);
    await tracker.saveToGitHub(`刪除支出：${name}`);
    tracker.render();
  } catch (err) { alert(`❌ ${err.message}`); }
}

async function togglePaid(id) {
  try {
    const exp = tracker.expenses.find(e => e.id === id);
    if (!exp) return;
    exp.isPaid = !exp.isPaid;
    await tracker.saveToGitHub(`更新狀態：${exp.name}`);
    tracker.render();
  } catch (err) { alert(`❌ ${err.message}`); }
}

function exportCSV() {
  const header = ['日期', '項目', '分類', '金額(JPY)', '預估台幣', '實際台幣', '已支出', '備註'];
  const rows = tracker.expenses.map(e => [
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

// ── 初始化 ────────────────────────────────────────────
let tracker;
document.addEventListener('DOMContentLoaded', () => {
  tracker = new ExpenseTracker();
  tracker.init();

  document.getElementById('lock-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitPassword();
  });
});
