# 記帳啦啦啦 🇯🇵

暑期赴日實習期間的個人支出記帳系統，支援 JPY/TWD 自動匯率換算。

🔗 **網頁：https://charliebai605.github.io/dailywork/**

---

## 功能

- 開啟網頁需輸入密碼解鎖
- 新增、編輯、刪除支出記錄
- 一鍵切換已支出 / 未支出狀態
- 按分類或狀態篩選
- 分類支出統計圖
- JPY → TWD 自動匯率換算（每天自動更新）
- 匯出 CSV

---

## 安全機制

所有支出資料以 **AES-256-GCM** 加密後才存入 `data.json`。

- 密碼只在瀏覽器本地運算，不上傳任何地方
- 沒有密碼，`data.json` 只是一串亂碼
- 新增、編輯、刪除時自動重新加密，操作體驗與一般記帳 app 相同

---

## 使用方式

打開網頁 → 輸入密碼解鎖 → 正常使用。

第一次新增或編輯支出時需輸入 GitHub Token，之後瀏覽器會記住。同一個瀏覽器 session 內密碼也只需輸入一次。

---

## 架構

```
瀏覽器
├── 打開網頁（GitHub Pages 提供）
├── 輸入密碼解密 data.json
└── 新增/編輯/刪除 → 重新加密 → GitHub API → data.json

GitHub
├── data.json        ← 加密的支出資料
├── rates.json       ← 匯率歷史（不加密）
└── GitHub Actions   ← 每天自動更新 rates.json
```

---

## 初次設定加密

使用 `encrypt.html` 工具將現有明文資料加密，產生加密後的 `data.json` 內容。
