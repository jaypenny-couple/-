# ALICE P0 正式切換演練與最後備份 Runbook

**狀態：僅供 Draft PR #43 審查。這份文件不是正式切換授權。不得依此自行暫停員工、啟用 Auth、改正式規則、合併或部署。**

## 角色與人員確認表

四個 Firebase 專案各有獨立 Auth 使用者庫；同一員工若操作兩套系統，需在兩個專案分別有帳號、UID 和 claims。公開 PR 只保留角色設計；正式員工姓名、電子郵件、UID 與在職狀態請保存在私人驗收表。

| 職責 | Firebase 專案 | 必要 claims | 可用資料與操作 | 應拒絕 |
| --- | --- | --- | --- | --- |
| 新客管理員 | `new-customer-management-system` | `aliceApp=customer`, `aliceRole=manager` | 全部 `records/<id>` 新增、查詢、編輯、單筆刪除及設計師切換 | `records` 根節點整批刪除 |
| 設計師 | 同上 | `aliceApp=customer`, `aliceRole=designer`, `aliceDesigner=<核准代碼>` | 僅以 `designer` 條件查詢及操作自己代碼的紀錄 | 全量查詢、他人紀錄及變更紀錄所屬設計師 |
| 預購操作人員／管理員 | `pre-order-registration` | `aliceApp=preorder`, `aliceRole=staff` 或 `manager` | `reservations/<id>` 原有單筆工作流程 | 未授權者及集合根節點整批刪除 |
| 缺貨操作人員／管理員 | `restocking-list` | `aliceApp=stock`, `aliceRole=staff` 或 `manager` | `stockItems/<id>` 原有單筆工作流程 | 未授權者及集合根節點整批刪除 |
| HR 管理員 | `hr-system-ad937` | `aliceApp=hr`, `aliceRole=manager` | `salon/main` 讀取、建立、交易式更新；頁內員工／配額／請假／進修操作 | 整份 `salon/main` 文件刪除、其他 Firestore 文件 |

目前候選設計師代碼為 `JAY`、`IRIS`、`SHERRY`、`CINDY`；正式對應人員、在職狀態與可見範圍須由業主確認。每位員工需提供：內部員工編號或私下辨識方式、公司核准電子郵件、要操作的系統、各系統職責、設計師代碼（如適用）、主管核准人及停用／離職流程。不得把這份個人資料提交公開 PR。

正式 Auth 啟用、帳號建立、email 驗證與 claims 核發皆待業主明確確認。由可信任管理者在各專案建立帳號，先以 `assign-staff-claim.mjs` dry run 核對，核准後才使用 `--apply` 並把原 claims 備份至私人目錄。每人須實際登入、登出、重整及完成自身必要工作；跨系統及錯誤角色須拒絕。

## 最後備份與增量核對

1. 切換前一天預檢四個資料庫實例、目前生效規則、Spark 用量、Firebase CLI／ADC 可用及私人儲存目錄 ACL。低寫入窗口開始後，先請員工停止四套系統寫入並回報最後操作，再從**正式根路徑**取得 B1 唯讀快照：三套 RTDB 用已驗證的私人 `backup-rtdb-readonly-local.ps1`；HR 用 `firestore-self-backup.mjs inventory`、額度檢查後 `export`。每次 HR 匯出要重新查當日 Console 讀數，保留 20,000 次營運讀取餘量；若 IAM、配額或完整性不符即停。
2. 保存快照的 UTC 時間、專案／實例、規則版本、大小與 SHA-256。不要把 JSON、manifest、詳細差異、憑證或員工資料放入 repo。RTDB JSON 要解析與驗雜湊；HR 要核對完整集合樹及 manifest，並在**本機 localhost Emulator**還原、重新列舉路徑和欄位。若 HR 新出現 collection/subcollection，先檢查備份工具是否涵蓋。
3. 用 `security/compare-snapshots.mjs` 在私人目錄比較基準快照 B0 與最新 B1。RTDB 按 `records`、`reservations`、`stockItems` 單筆 ID 分出新增／修改／刪除，並檢查未知根節點；HR 同時比較完整文件路徑、集合路徑及 `salon/main` 四個陣列的每個項目。工具只在終端顯示數量；ID、路徑、前後雜湊保留在私人 change ledger。
4. 主管以營運紀錄逐項核對 B0→B1 的新增、修改、刪除。**刪除必須有人確認是業務操作**；出現未知根節點、無法辨識的 HR 舊列、未預期刪除、雜湊不符或對不起來的筆數，立即停止切換並調查。差異工具不能自行證明刪除意圖。
5. 員工持續停寫時再次取得 B2，做 B1→B2 比較。預期新增／修改／刪除皆為零；若非零，先找出仍在寫入的裝置或程序、延長窗口並重做最後快照。B1、B2 都需完成全套雜湊及 HR Emulator 還原核對。這是降低 Firestore 自管遍歷非原子性的人工控制，不能取代託管原子快照。
6. 正式切換後再取得 B3，只把 B2→B3 差異與已核准的新操作比對；不以 B0、B1 或 B2 直接覆寫任何正式路徑。

離線差異工具的範例（把尖括號改成私人快照的絕對路徑；輸出目錄必須已設好受限 ACL）：

```powershell
node security/compare-snapshots.mjs --project new-customer-management-system --before "<B0-RTDB-JSON>" --after "<B1-RTDB-JSON>" --private-dir "<PRIVATE-DIR>"
node security/compare-snapshots.mjs --project hr-system-ad937 --before "<B0-FIRESTORE-JSON>" --after "<B1-FIRESTORE-JSON>" --private-dir "<PRIVATE-DIR>"
```

另以相同格式處理 `pre-order-registration` 與 `restocking-list`。每次比較都要獨立核對輸入檔 SHA-256 與其備份 manifest；工具的詳細 ledger 只保存在私人目錄。B1→B2 及 B2→B3 也用同一程序。

### 候選低寫入窗口（尚未排定）

建議由業主選定某個**打烊後 22:00–22:30，臺北時間**的 30 分鐘窗口。影響範圍：四套管理頁的新增、修改、刪除暫停；員工須停止按下儲存或刪除，並回報最後一筆操作。這是**人員協調的暫停**，本文件不會對正式系統套用讀取限定規則，也不會中斷網站。舊版 HR 頁沒有可靠的雲端寫入成功提示，因此不能只憑頁面顯示認定最後操作完成；主管要用 B1 與操作紀錄核對。新版頁正式上線後，離頁前才以「已儲存至雲端並重新讀取確認」為必要條件。若有人無法停寫、快照有差異、任何員工尚有未確認變更，取消當次窗口並另排。日期、時段與對員工的通知須業主確認後才執行。

## 切換演練與正式 Go/No-Go

1. **本機／測試環境：**用 Emulator 合成舊格式資料驗證四頁合法角色的新增、查詢、編輯、必要刪除、登入／登出、重整、斷線／恢復。HR 以兩個獨立瀏覽器工作階段測不同列並行合併、同列衝突拒絕、寫入拒絕後提示／重試、待寫入時阻止登出、未送出表單避免被遠端更新清空。匿名、錯誤角色、跨設計師與 HR 整份刪除必須拒絕。
2. **舊／新版交接：**目前正式舊頁沒有 Auth；候選新規則生效後，舊分頁會被拒絕。正式切換前須通知員工完成舊頁操作、確認 B2 已涵蓋、關閉舊分頁，再以新版登入。GitHub Pages 快取及開啟中的舊分頁須在現場逐台確認。不得把 Emulator 結果宣稱為正式員工驗收。
3. **上線前門檻：**四套新的私人快照／規則快照與雜湊通過，B1→B2 零差異或已逐項解釋，HR Emulator 還原通過，實際員工帳號與 claims 核對、每個職責人工操作通過，HR 沒有未確認變更，業主明確確認切換與窗口。任何一項不滿足則 No-Go。
4. **取得正式確認後的部署順序：**先由業主授權啟用 Auth、建立並驗收帳號／claims；在有人值守窗口完成最後備份，確認舊頁關閉與待寫入歸零；再配套部署新前端及候選規則，逐頁登入驗證。切換後監看 permission-denied、讀寫錯誤、資料筆數與現場可用性。此步驟本 PR **未執行**。

## 異常與安全回復

- 任何備份、雜湊、差異、員工登入或 HR 寫入確認失敗：停止切換，不改正式資料；保留錯誤時間、版本與私人快照。若已切換，先停止進一步部署，讓員工以受控的離線工作紀錄保留新操作，待核對後逐筆補入。
- 不直接恢復公開舊規則作為長期方案；舊頁在安全規則下不能正常使用。優先回到上一個已驗收、與安全規則相容的 Auth 版本。若沒有可用版本，暫採人工流程並修復候選版本；任何極短應急規則回退也須業主另行確認暴露風險。
- 不用舊 JSON 覆寫 RTDB 根節點或 `salon/main`。若需補資料，先比較 B2、B3 與離線工作紀錄，只對確認缺失的項目逐筆恢復，再重新備份、雜湊與核對。
