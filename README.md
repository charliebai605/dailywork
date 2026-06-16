# 🇯🇵 日本實習支出記帳系統

一個簡單但功能完整的支出記帳系統，用於記錄日本暑期實習期間的支出。

## ✨ 功能

- 📊 **支出總覽** - 實時顯示已支出、未來支出、總支出
- 💱 **自動匯率更新** - 每天自動從 [exchangerate-api.com](https://exchangerate-api.com) 獲取最新 JPY/TWD 匯率
- 🔢 **自動計算** - 自動計算預估台幣金額
- 📱 **響應式設計** - 在手機、平板、電腦上都能使用
- 📈 **匯率歷史** - 保存最近30天的匯率變化
- 🚀 **GitHub Actions** - 定時自動更新匯率，無需手動操作

## 📁 文件結構

```
.
├── index.html                    # 主頁面
├── data.json                     # 支出數據和匯率歷史
├── style.css                     # 樣式表
├── script.js                     # 前端邏輯
├── .github/workflows/
│   └── update-exchange-rate.yml  # GitHub Actions 自動化腳本
└── README.md                     # 說明文件
```

## 🚀 快速開始

### 本地使用

1. **克隆或下載此項目**
   ```bash
   git clone <repo-url>
   cd <project-folder>
   ```

2. **在本地運行**
   
   使用 Python 簡單 HTTP 服務器：
   ```bash
   python3 -m http.server 8000
   ```
   
   然後打開瀏覽器：http://localhost:8000

### GitHub Pages 部署

1. **上傳到 GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: Add expense tracker"
   git push origin main
   ```

2. **啟用 GitHub Pages**
   - 進入倉庫設置 (Settings)
   - 找到 "Pages" 選項
   - 選擇 "Deploy from a branch"
   - 選擇 main 分支，保存
   
3. **訪問你的頁面**
   - https://你的用戶名.github.io/倉庫名

## 📝 添加新支出

編輯 `data.json` 文件，在 `expenses` 陣列中添加新記錄：

```json
{
  "id": 5,
  "name": "新支出項目",
  "date": "2026-07-10",
  "category": "Food",
  "amountJPY": 5000,
  "actualTWD": null,
  "estimateTWD": null,
  "isPaid": false,
  "notes": "備註說明"
}
```

### 字段說明

| 字段 | 類型 | 說明 |
|------|------|------|
| id | number | 唯一識別號 |
| name | string | 支出項目名稱 |
| date | string | 支出日期 (YYYY-MM-DD) |
| category | string | 分類 (Housing/Transport/Food/Flight/Other) |
| amountJPY | number | 日元金額 |
| actualTWD | number | 實際台幣金額 (支出時填) |
| estimateTWD | number | 預估台幣金額 (自動計算) |
| isPaid | boolean | 是否已支出 |
| notes | string | 備註 |

## 🔄 匯率自動更新

### 本地更新

在瀏覽器中點擊 "🔄 更新匯率" 按鈕，即可手動更新。

### 自動定時更新

設置了 GitHub Actions 工作流，每天早上 8 點 UTC 自動更新：

1. **工作流文件** - `.github/workflows/update-exchange-rate.yml`
2. **更新時間** - 每天 08:00 UTC (台灣時間 16:00)
3. **手動觸發** - 可在 GitHub Actions 中手動運行

要修改更新時間，編輯工作流文件中的 `cron` 參數。

## 💾 數據備份

所有數據都存儲在 `data.json` 中：
- 支出記錄
- 匯率歷史
- 元數據 (最後更新時間等)

定期commit到GitHub，自動保存版本歷史。

## 🎨 自定義

### 修改樣式

編輯 `style.css` 修改顏色、字體等：

```css
:root {
  --primary: #2563eb;        /* 主色調 */
  --success: #10b981;        /* 成功色 */
  --warning: #f59e0b;        /* 警告色 */
  --danger: #ef4444;         /* 危險色 */
}
```

### 修改分類

在 `data.json` 中修改支出分類選項：

```json
"select": {
  "options": [
    {"name": "Housing", "color": "blue"},
    {"name": "新分類", "color": "purple"}
  ]
}
```

同時更新 `script.js` 中的分類名稱映射。

## 📊 支出分析

頁面頂部自動顯示：
- **已支出** - 已實際支付的總金額
- **未來支出** - 計劃支付的金額（未來日期）
- **總支出** - 全部支出合計

## 🔐 隱私

- 所有數據都存儲在本地或你的 GitHub 倉庫
- 不需要任何外部帳戶或服務（除了匯率API）
- 匯率數據來自公開的 exchangerate-api.com

## 📱 瀏覽器相容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移動設備瀏覽器（iOS Safari, Chrome mobile 等）

## 🤝 貢獻

歡迎提出改進建議！

## 📄 授權

自由使用，無限制。

---

**使用愉快！祝實習順利！** 🎓
