# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

純靜態的個人記帳網頁，部署在 GitHub Pages。支出資料以 AES-256-GCM 加密後存在 `data.json`，透過 GitHub Contents API 讀寫。無後端、無框架、無 node_modules。

**網址：** https://charliebai605.github.io/dailywork/

## 本地開發

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
```

沒有 build step、沒有 lint、沒有測試指令。直接改檔案、push、GitHub Pages 自動部署。

## 資料架構

**`data.json`** — 唯一的資料庫，存放加密後的支出陣列：
```json
{ "v": 1, "salt": "...", "iv": "...", "data": "..." }
```
解密後是一個 expense 物件陣列（不是整個 JSON 物件）：
```json
[{ "id": 1, "name": "...", "date": "YYYY-MM-DD", "category": "Food",
   "paymentMethod": "cash", "amountJPY": 0, "actualTWD": 21820,
   "estimateTWD": 21820, "isPaid": true, "notes": "" }]
```

**`rates.json`** — 明文匯率歷史，由 GitHub Actions 每天更新，不含敏感資料。

## 加密機制

- **演算法：** AES-256-GCM + PBKDF2（100,000 次迭代）
- **金鑰：** 從使用者密碼派生，僅存在瀏覽器記憶體與 `sessionStorage`
- **salt 重用：** `saveToGitHub()` 傳入 `existingSalt` 以保持相同 salt，只更新 iv
- **初始加密：** 使用 `encrypt.html` 工具將明文資料加密

## 核心流程

**讀取：** `fetch('data.json')` → `decryptData()` → `tracker.expenses[]`

**寫入：** 修改 `tracker.expenses[]` → `saveToGitHub()` → `encryptData()` → GitHub Contents API PUT（需要先 GET 取得 `sha`）

**注意：** 每次寫入前都要先 GET 取得最新的 `sha`，否則 GitHub API 會拒絕（409 conflict）。

## 付款方式與西瓜卡

`paymentMethod` 的值：`cash`、`suica`、`suica-topup`、`card`

西瓜卡餘額計算：`suica-topup` 的 `amountJPY` 總和 − `suica` 的 `amountJPY` 總和。

## 瀏覽器端儲存

| 儲存位置 | 內容 | 清除時機 |
|---------|------|---------|
| `sessionStorage.vault_pw` | 解鎖密碼 | 關閉分頁 |
| `localStorage.github_token` | GitHub PAT | 手動清除 |

## GitHub Actions

`.github/workflows/update-exchange-rate.yml` — 每天 UTC 08:00 更新 `rates.json`，不碰加密的 `data.json`。
