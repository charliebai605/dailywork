# 🇯🇵 日本實習支出記帳

暑期赴日實習期間的個人支出記帳系統，支援 JPY/TWD 自動匯率換算。

🔗 **網頁：https://lixingmanei.netlify.app**

---

## 功能

- 新增、編輯、刪除支出記錄
- 一鍵切換已支出 / 未支出狀態
- 按分類或狀態篩選
- 分類支出統計圖
- JPY → TWD 自動匯率換算（每天自動更新）
- 匯出 CSV
- 手機、平板、電腦皆可使用

---

## 使用方式

直接打開網頁即可。第一次新增或編輯支出時需輸入 GitHub Token，之後瀏覽器會記住，不需要再輸入。

**GitHub Token：** 存放在瀏覽器 localStorage，不會上傳至任何地方。

---

## 新增支出

點擊頁面底部的「＋ 新增支出」按鈕，填寫表單後儲存。資料會直接同步至 GitHub。

若支出為台幣（如機票），JPY 欄填 `0`，在實際台幣欄填入金額即可。

---

## 資料結構

所有支出資料儲存於 `data.json`，也可以直接編輯此檔案後 push 至 GitHub。

```json
{
  "expenses": [
    {
      "id": 1,
      "name": "項目名稱",
      "date": "2026-06-29",
      "category": "Housing",
      "amountJPY": 125000,
      "actualTWD": null,
      "estimateTWD": 24625,
      "isPaid": false,
      "notes": "備註"
    }
  ]
}
```

**分類選項：** `Housing`（住宿）、`Transport`（交通）、`Food`（食物）、`Flight`（機票）、`Other`（其他）

---

## 匯率自動更新

GitHub Actions 每天 UTC 08:00（台灣時間 16:00）自動抓取最新 JPY/TWD 匯率並更新 `data.json`。也可在網頁上點「🔄 更新匯率」手動更新。

---

## 用 Claude 掃描收據

在 Claude App（iOS / 網頁）的 Project 中上傳收據照片，Claude 會識別內容並透過 GitHub API 自動新增記錄。
