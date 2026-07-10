# Codex 任務說明：ALICE Smart CRM v2

## 目標
把手機版顧客資料表單部署成可用系統，並完成：

1. 顧客手機填寫資料
2. 送出後寫入 Google Sheet
3. 可建立 Google Contacts
4. 可匯出千軍 E 髮可匯入格式
5. 後續可接 ALICE 官網 / GitHub Pages / PWA

## 目前檔案
- `index.html`：手機版表單
- `style.css`：ALICE 品牌風格
- `app.js`：表單邏輯、JSON/CSV 匯出、Webhook 預留
- `google_apps_script_sample.js`：Google Sheet / Contacts 範例
- `manifest.json`、`service-worker.js`：PWA 基礎

## 第一階段任務
1. 將本資料夾部署到 GitHub Pages，例如：
   - `/customer/`
   - 或獨立 repo：`alice-smart-crm`

2. 建立 Google Sheet：
   - Sheet 名稱：`customers`

3. 建立 Google Apps Script：
   - 貼上 `google_apps_script_sample.js`
   - 部署為 Web App
   - 將 Web App URL 填入 `app.js`：
     ```js
     const GOOGLE_APPS_SCRIPT_WEBAPP_URL = "貼上URL";
     ```

4. 測試：
   - 手機填寫一筆測試資料
   - 確認可下載 JSON
   - 確認可下載 CSV
   - 確認 Google Sheet 有新增資料

## 第二階段任務：Google Contacts
1. 啟用 People API Advanced Service
2. 在 `google_apps_script_sample.js` 取消：
   ```js
   // createGoogleContact_(payload);
   ```
3. 測試建立聯絡人
4. 建議聯絡人備註包含：
   - LINE ID
   - 來源
   - 介紹人
   - 頭髮困擾
   - 風格偏好
   - 照片授權
   - 內部備註

## 第三階段任務：千軍 E 髮
目前 `app.js` 已經有：
```js
integrations.qianjunEHair
```

但實際欄位名稱必須依千軍 E 髮支援的匯入格式調整。

請確認千軍 E 髮是否支援：
- CSV 匯入
- Excel 匯入
- 會員資料匯入模板
- 本機資料庫匯入
- API
- 若都沒有，只能評估 RPA 模擬輸入

## 注意事項
- 不要把 Google Apps Script Web App URL 放在公開 repo，正式版建議改成環境變數或後端代理。
- 正式上線前，請確認個資告知、照片授權與行銷通知文字是否符合店內需求。
- 照片授權必須獨立欄位，不能和會員資料同意混在一起。
