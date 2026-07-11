# ALICE Smart CRM v2

這是一套手機版顧客資料表單雛形，設計用途：

- 顧客掃 QR Code 後填寫資料
- 自動整理成 JSON
- 一般顧客模式不顯示下載功能
- 內部測試模式可下載 CSV / JSON
- 可接 Google Sheet
- 可擴充 Google Contacts
- 可依千軍 E 髮匯入格式調整欄位

## 快速使用

直接開啟：

```text
index.html
```

或部署到 GitHub Pages。

## 建議部署位置

```text
https://alicegroup.com.tw/customer/
```

## 使用模式

顧客填寫：

```text
https://alicegroup.com.tw/customer/
```

內部測試：

```text
https://alicegroup.com.tw/customer/?admin=1
```

顧客模式只顯示填寫與完成畫面，不顯示 JSON、CSV 或下載按鈕。
內部測試模式會顯示暫存、JSON、CSV 與 Google Sheet 測試工具。

## 已包含的欄位

- 基本資料
- 聯絡方式
- 職業與來源
- 問卷資料
- 頭髮與頭皮困擾
- 毛髮 / 膚色 / 風格分析
- 照片授權
- 行銷通知同意
- 設計師內部備註

## 重要提醒

千軍 E 髮的匯入格式必須另外確認。  
目前此版本先完成「顧客填寫流程」與「內部測試輸出」，後續再串接 Google Apps Script / Google Sheet 與千軍格式轉換。

## Google Sheet 串接

1. 建立一份 Google Sheet，例如：`ALICE Smart CRM 顧客資料`
2. 點選「擴充功能」->「Apps Script」
3. 將 `google_apps_script_sample.js` 的內容完整貼上
4. 儲存後先執行 `setupSheet()`，完成授權
5. 點選「部署」->「新增部署作業」->「網頁應用程式」
6. 執行身分選「自己」
7. 存取權選「知道連結的任何人」
8. 複製 Web App URL
9. 將 Web App URL 填入 `app.js`：

```js
const GOOGLE_APPS_SCRIPT_WEBAPP_URL = "貼上你的 Web App URL";
```

顧客模式送出後會自動送到 Google Sheet。
`?admin=1` 內部測試模式可按「送到 Google Sheet」手動測試。
