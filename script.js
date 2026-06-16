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
    this.setupEventListeners();
  }

  async loadData() {
    try {
      const response = await fetch('data.json');
      const text = await response.text();
      this.data = JSON.parse(text);
    } catch (error) {
      console.error('Failed to load data:', error);
      this.data = { expenses: [], exchangeRates: [], metadata: {} };
    }
  }

  async updateExchangeRate() {
    try {
      const btn = document.querySelector('.refresh-btn');
      if (btn) btn.classList.add('loading');

      const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY', {
        headers: { 'Accept': 'application/json' }
      });

      const data = await response.json();
      this.currentRate = data.rates?.TWD || 0.197;

      // 更新metadata中的汇率
      if (!this.data.metadata) this.data.metadata = {};
      this.data.metadata.lastUpdated = new Date().toISOString();

      // 添加到历史记录
      if (!this.data.exchangeRates) this.data.exchangeRates = [];
      this.data.exchangeRates.unshift({
        date: new Date().toISOString().split('T')[0],
        rate: this.currentRate,
        source: 'exchangerate-api.com'
      });

      // 保持最近30条记录
      this.data.exchangeRates = this.data.exchangeRates.slice(0, 30);

      if (btn) btn.classList.remove('loading');
      this.showNotification('✅ 匯率已更新', 'success');
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      const btn = document.querySelector('.refresh-btn');
      if (btn) btn.classList.remove('loading');
      this.showNotification('⚠️ 無法更新匯率', 'error');
    }
  }

  recalculateEstimates() {
    if (!this.data.expenses) return;

    this.data.expenses.forEach(expense => {
      // 計算預估台幣（用當前匯率）
      if (expense.amountJPY > 0) {
        expense.estimateTWD = Math.round(expense.amountJPY * this.currentRate);
      }
      // 如果沒有實際台幣，用預估值
      if (!expense.actualTWD && expense.estimateTWD) {
        expense.actualTWD = expense.estimateTWD;
      }
    });
  }

  getStats() {
    const stats = {
      totalJPY: 0,
      totalEstimateTWD: 0,
      paidTWD: 0,
      pendingTWD: 0,
      pendingCount: 0
    };

    if (!this.data.expenses) return stats;

    this.data.expenses.forEach(expense => {
      stats.totalJPY += expense.amountJPY || 0;

      const amount = expense.actualTWD || expense.estimateTWD || 0;
      stats.totalEstimateTWD += amount;

      if (expense.isPaid) {
        stats.paidTWD += amount;
      } else {
        stats.pendingTWD += amount;
        stats.pendingCount += 1;
      }
    });

    return stats;
  }

  render() {
    this.renderStats();
    this.renderExchangeRate();
    this.renderTable();
    this.renderFooter();
  }

  renderStats() {
    const stats = this.getStats();
    const statsHtml = `
      <div class="stat-card paid">
        <div class="stat-label">已支出</div>
        <div class="stat-value">NT$${this.formatNumber(stats.paidTWD)}</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-label">未來支出</div>
        <div class="stat-value">NT$${this.formatNumber(stats.pendingTWD)}</div>
        <div class="stat-label" style="margin-top: 10px; font-size: 0.8em;">
          (${stats.pendingCount} 筆)
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">總支出</div>
        <div class="stat-value">NT$${this.formatNumber(stats.totalEstimateTWD)}</div>
      </div>
    `;

    const statsContainer = document.querySelector('.stats');
    if (statsContainer) {
      statsContainer.innerHTML = statsHtml;
    }
  }

  renderExchangeRate() {
    const rateHtml = `
      <div class="exchange-rate-info">
        <div>
          <div class="rate-label">當前匯率 (JPY → TWD)</div>
          <div class="rate-value">1 JPY = <span id="rate-display">${this.currentRate.toFixed(4)}</span> TWD</div>
        </div>
      </div>
      <button class="refresh-btn" onclick="tracker.updateExchangeRate(); tracker.recalculateEstimates(); tracker.render();">
        🔄 更新匯率
      </button>
    `;

    const rateBox = document.querySelector('.exchange-rate-box');
    if (rateBox) {
      rateBox.innerHTML = rateHtml;
    }
  }

  renderTable() {
    if (!this.data.expenses || this.data.expenses.length === 0) {
      const tableWrapper = document.querySelector('.table-wrapper');
      if (tableWrapper) {
        tableWrapper.innerHTML = '<p style="text-align: center; padding: 40px; color: #6b7280;">沒有記錄</p>';
      }
      return;
    }

    // 按日期排序
    const sorted = [...this.data.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));

    const rows = sorted.map(expense => `
      <tr>
        <td class="date-cell">${this.formatDate(expense.date)}</td>
        <td><strong>${expense.name}</strong></td>
        <td><span class="category-badge ${expense.category}">${this.getCategoryName(expense.category)}</span></td>
        <td class="amount-cell">¥${this.formatNumber(expense.amountJPY)}</td>
        <td class="twd-cell estimate">
          ${expense.estimateTWD ? `NT$${this.formatNumber(expense.estimateTWD)}` : '-'}
        </td>
        <td class="twd-cell actual">
          ${expense.actualTWD ? `NT$${this.formatNumber(expense.actualTWD)}` : '-'}
        </td>
        <td>
          <span class="status-badge ${expense.isPaid ? 'paid' : 'pending'}">
            ${expense.isPaid ? '✓ 已支出' : '⏳ 未支出'}
          </span>
        </td>
        <td class="notes">${expense.notes || '-'}</td>
        <td>
          <button class="delete-btn" onclick="deleteExpense(${expense.id}, '${expense.name}')">🗑️</button>
        </td>
      </tr>
    `).join('');

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>項目</th>
            <th>分類</th>
            <th>金額 (JPY)</th>
            <th>預估台幣</th>
            <th>實際台幣</th>
            <th>狀態</th>
            <th>備註</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.innerHTML = tableHtml;
    }
  }

  renderFooter() {
    if (!this.data.metadata) return;

    const lastUpdated = this.data.metadata.lastUpdated
      ? new Date(this.data.metadata.lastUpdated).toLocaleString('zh-TW')
      : '未知';

    const footerHtml = `
      <div class="last-updated">
        ⏰ 上次更新: ${lastUpdated}
      </div>
      <div>
        💾 數據來源: data.json | 匯率來源: exchangerate-api.com
      </div>
    `;

    const footer = document.querySelector('footer');
    if (footer) {
      footer.innerHTML = footerHtml;
    }
  }

  setupEventListeners() {
    // 刷新頁面時自動更新匯率
    window.addEventListener('focus', () => {
      this.updateExchangeRate().then(() => {
        this.recalculateEstimates();
        this.render();
      });
    });
  }

  showNotification(message, type = 'info') {
    // 簡單的通知顯示
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  }

  formatNumber(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  getCategoryName(category) {
    const names = {
      Housing: '住宿',
      Transport: '交通',
      Food: '食物',
      Flight: '機票',
      Other: '其他'
    };
    return names[category] || category;
  }
}

let tracker;
document.addEventListener('DOMContentLoaded', () => {
  tracker = new ExpenseTracker();

  // 設置今天的日期為預設
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;

  // 從 localStorage 讀取儲存的 token
  const savedToken = localStorage.getItem('github_token');
  if (savedToken) {
    document.getElementById('f-token').value = savedToken;
  }
});

async function deleteExpense(id, name) {
  if (!confirm(`確定要刪除「${name}」嗎？`)) return;

  const token = localStorage.getItem('github_token');
  if (!token) {
    alert('請先在新增支出表單中輸入 GitHub Token');
    toggleForm();
    return;
  }

  const OWNER = 'charliebai605';
  const REPO = 'dailywork';
  const FILE = 'data.json';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

  try {
    const getRes = await fetch(API, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
    });

    if (!getRes.ok) throw new Error('無法取得資料');

    const fileData = await getRes.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, '')))));

    content.expenses = content.expenses.filter(e => e.id !== id);
    content.metadata.lastUpdated = new Date().toISOString();

    const putRes = await fetch(API, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `刪除支出：${name}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))).replace(/\n/g, ''),
        sha: fileData.sha
      })
    });

    if (!putRes.ok) throw new Error('刪除失敗');

    tracker.data = content;
    tracker.recalculateEstimates();
    tracker.render();

  } catch (err) {
    alert(`❌ ${err.message}`);
  }
}

function toggleForm() {
  const form = document.getElementById('add-form');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    document.getElementById('f-name').focus();
    clearFormMsg();
  }
}

function clearFormMsg() {
  const msg = document.getElementById('form-msg');
  msg.style.display = 'none';
  msg.innerHTML = '';
}

function showFormMsg(text, type) {
  const msg = document.getElementById('form-msg');
  msg.className = type === 'success' ? 'msg-success' : 'msg-error';
  msg.innerHTML = text;
  msg.style.display = 'block';
}

async function addExpense() {
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  const category = document.getElementById('f-category').value;
  const jpy = parseFloat(document.getElementById('f-jpy').value) || 0;
  const twd = document.getElementById('f-twd').value ? parseFloat(document.getElementById('f-twd').value) : null;
  const isPaid = document.getElementById('f-paid').checked;
  const notes = document.getElementById('f-notes').value.trim();
  const token = document.getElementById('f-token').value.trim();

  if (!name) return showFormMsg('❌ 請填寫項目名稱', 'error');
  if (!date) return showFormMsg('❌ 請填寫日期', 'error');
  if (!token) return showFormMsg('❌ 請填寫 GitHub Token', 'error');

  // 儲存 token 到 localStorage
  localStorage.setItem('github_token', token);

  const submitBtn = document.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '儲存中...';

  try {
    // 從 GitHub 取得最新 data.json
    const OWNER = 'charliebai605';
    const REPO = 'dailywork';
    const FILE = 'data.json';
    const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;

    const getRes = await fetch(API, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!getRes.ok) {
      const err = await getRes.json();
      throw new Error(err.message || '無法取得資料');
    }

    const fileData = await getRes.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, '')))));

    // 計算預估台幣
    const estimateTWD = jpy > 0 ? Math.round(jpy * tracker.currentRate) : (twd || 0);

    // 新增記錄
    const newId = Math.max(...content.expenses.map(e => e.id), 0) + 1;
    content.expenses.push({
      id: newId,
      name,
      date,
      category,
      amountJPY: jpy,
      actualTWD: twd,
      estimateTWD,
      isPaid,
      notes
    });

    content.metadata.lastUpdated = new Date().toISOString();

    // 推送回 GitHub
    const putRes = await fetch(API, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `新增支出：${name}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))).replace(/\n/g, ''),
        sha: fileData.sha
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || '儲存失敗');
    }

    // 更新本地資料
    tracker.data = content;
    tracker.recalculateEstimates();
    tracker.render();

    showFormMsg('✅ 已成功新增！', 'success');

    // 清空表單
    document.getElementById('f-name').value = '';
    document.getElementById('f-jpy').value = '';
    document.getElementById('f-twd').value = '';
    document.getElementById('f-notes').value = '';
    document.getElementById('f-paid').checked = false;

  } catch (err) {
    showFormMsg(`❌ ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '儲存';
  }
}
