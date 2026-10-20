# ALICE P0 修復狀態（2026-10-20）

**此分支只供審查與測試。不得直接併入 `main`、發布任何候選規則或用正式資料執行測試。**

## 已核對的範圍

| 專案 | 原始碼使用的服務與路徑 | 原始碼目前登入 | 正式生效規則／資料庫實例 |
| --- | --- | --- | --- |
| `new-customer-management-system` | RTDB `records`，`asia-southeast1` URL | 無 | Console 顯示根節點 `.read: true`、`.write: true`；Spark |
| `pre-order-registration` | RTDB `reservations`，`asia-southeast1` URL | 無 | Console 顯示根節點 `.read: true`、`.write: true`；Spark |
| `restocking-list` | RTDB `stockItems`，`firebaseio.com` URL | 無 | Console 顯示根節點 `.read: true`、`.write: true`；Spark |
| `hr-system-ad937` | Firestore `salon/main` | 無 | Console 顯示 `match /{document=**}` 下 `allow read, write: if true`；Spark |

GitHub Pages API 顯示官網部署來源為本儲存庫 `main` 根目錄（legacy build）。本機原始碼由公開儲存庫克隆，開發分支為 `codex/p0-firebase-auth-staging`。2026-10-20 透過這台電腦已登入的 Firebase Console 查到四專案正式生效規則與 Spark 方案；四份規則另存私人受限目錄，記錄大小及 SHA-256。**這是已確認的公開讀寫漏洞，應視為可能已暴露顧客及 HR 資料；尚無證據判定是否有人實際取得資料。** Console「使用者和權限」顯示目前帳號在四專案皆為**擁有者**；四個 Authentication 頁都顯示「開始使用」，尚未啟用。Firebase CLI 起初不可用，後續只在本機測試依賴安裝；`firebase login:list` 顯示無已授權 CLI 帳號。gcloud 與 ADC 憑證也不存在。

## 風險評估

| 風險 | 證據 | 程度 | 修復 |
| --- | --- | --- | --- |
| 新客跨設計師讀取 | `新客管理.html` 原版讀取整個 `records`，僅在前端篩選；正式規則允許任何人讀取 | **極高，全部記錄存在公開讀取風險** | 本分支改為 `designer` 條件查詢，候選 RTDB 規則以後端核發的設計師 claim 限制查詢及單筆讀寫 |
| 無真正員工授權 | 四頁原版無 Auth 登入與角色判斷，且正式規則允許所有人讀寫 | **極高，已確認匿名存取風險** | 本分支加入 Auth 登入閘門與角色候選規則 |
| 可整批刪除 | 三個正式 RTDB 根節點 `.write: true`；HR Firestore 所有文件 `write: if true` | **極高，已確認可被未授權修改／刪除的規則設定** | 候選規則只允許授權角色操作指定資料，RTDB 不授予集合根節點寫入 |
| 持久型 HTML 注入 | 預訂與缺貨頁原版將資料庫欄位直接寫入 `innerHTML` | 高；資料若含 HTML 可執行頁面腳本 | 本分支對預訂文字轉義、缺貨改用 `textContent` |
| HR 整份文件覆寫 | `休假進修管理.html` 使用單一 `salon/main` 文件及 `setDoc` 寫入整份狀態 | 中；並行編輯／還原可能覆蓋他人更新 | 本次保留格式與流程；切換前需實際備份、並行操作驗收，後續規劃交易式資料拆分 |

**規則可允許匿名讀／寫／刪除已由正式 Console 驗證，但沒有讀取或試寫真實資料來測試。** 是否曾實際外洩、Firestore 其他 collection、額外 RTDB 實例及完整正式資料路徑仍待查。不得將「存在暴露風險」寫成「已確認有人外洩資料」。

## 本分支修改

- 四頁加入 Email/Password 登入、登出、角色檢查、權限不足與連線失敗提示。管理角色僅認可 Firebase ID token 的 custom claims；前端顯示檢查不是安全邊界。
- 新客仍用既有 `records/<id>` 格式，設計師僅能按原有 `designer` 值查詢。管理者可切換設計師，設計師只能進入自己的設計師頁。
- `security/rules/` 存放**尚未部署**的規則。角色矩陣：新客 `manager` 或指定 `designer`；預訂與缺貨 `staff` 或 `manager`；HR 僅 `manager`。每個專案另要求相符 `aliceApp` claim。
- `assign-staff-claim.mjs` 是可信任管理環境用的 Admin SDK 腳本，預設唯讀 dry run；`--apply` 要求專案、UID、角色及儲存既有 claims 的私人備份路徑。本次未執行正式 claim 變更。
- Firebase Emulator 與本機瀏覽器用合成資料測試，所有 Auth、RTDB、Firestore 呼叫在 `localhost` 轉向 Emulator，不連正式資料庫。

## 正式備份：尚未完成

1. Firebase Console 已確認四專案生效規則、Spark 方案、擁有者角色與 Auth 尚未啟用；仍需核對額外實例。四份現行規則已存私人受限目錄。RTDB 仍需完成完整唯讀資料匯出。不要以匿名 REST 讀取來探測。
2. 在私有、受保護且位於公開 repo 之外的目錄，對三個 RTDB **各實例的 `/` 根節點**做官方 Console Export JSON 或執行 P0 ZIP 的 `scripts/backup-rtdb-readonly.ps1`。Console 匯出操作已啟動但本機瀏覽器沒有交回可驗證的下載檔，因此**目前不能算備份成功**。Firebase CLI 尚待帳號登入。逐份驗證 JSON 可解析、非錯誤回應，記錄專案／實例／UTC 時間／大小／SHA-256。ZIP 腳本只涵蓋硬編碼的三個實例，**不會備份規則，也不保證發現額外實例**；必須另行核對。
3. Firestore 目前是 **Spark**；HR 專案的 Firebase Storage 頁也顯示必須升級 Blaze 才可使用，未確認已有適合匯出的私人 GCS bucket。官方 managed export 需要 Blaze 計費、合適 GCS bucket 和帳號／服務代理 IAM；匯出會計入文件讀取及 GCS 儲存費用。**不得自行升級或啟動匯出。** 取得使用者明確付費同意後才可處理。確認操作完成、bucket 產物與可還原的目標／程序。`salon/main` 的頁面 JSON 匯出不足以代表整個 Firestore 專案。
4. 所有資料、既有規則、claim 回復檔及操作紀錄只能存私人位置。**任一正式備份失敗，停止正式規則修改。**

## 驗收與正式切換門檻

- 已保存四套正式資料及生效規則，可驗證並演練到獨立測試環境還原；記錄備份時點後的增量處理方案。
- 確認 Email/Password provider、授權網域、員工帳號及角色對應；管理員在可信任環境核發 claims。`aliceDesigner` 必須與現有資料的設計師值完全一致。每個 Firebase 專案各自登入。
- 於獨立測試環境以代表性的**合成**舊資料執行四頁實際操作：新增、查詢、編輯、刪除、登入／登出、重新整理、拒絕權限不足、斷線與恢復；確認 HR 並行編輯與備份／還原流程。
- 排定有人值守的低流量切換。先確認所有實際員工可登入並使用新頁面，再在明確使用者確認後切換配套規則；監控 `permission-denied`、現場流程與資料筆數。GitHub Pages 快取與舊開啟頁面可能造成短暫版本不一致，需預先通知並逐頁重整。
- 發生故障時停止進一步修改，保留錯誤紀錄，讓員工先用安全替代流程。回復前端到相容版本與規則到私有保存的對應版本；若原規則公開，回復只可作極短應變，須另設限制及立即再切回。資料還原應先比較備份後新增／修改的紀錄，**不可直接覆寫正式根節點或 `salon/main`**。

## 已做測試與缺口

- `security` 目錄執行 `npm test`：Firebase Emulator 4 組規則測試、登入閘門 2 組 DOM 測試、四頁本機瀏覽器 2 組工作流程測試，共 **8/8 通過**。包含合成資料新增／查詢／刪除、新客與預訂編輯、匿名與錯誤角色拒絕、跨設計師拒絕、整批刪除拒絕、登入／登出／重整及斷線／恢復 UI。缺貨頁原本沒有編輯功能；HR 的一般請假列表原本只有新增／刪除，Firestore 規則測試已覆蓋文件編輯。四頁 module JavaScript 語法檢查與 JSON 格式檢查通過。
- 尚未以實際員工帳號和獨立測試專案執行人工驗收；正式規則、實際備份、帳號佈建、還原演練與部署均未完成。此分支**不可併入正式來源**。

## 官方依據

- [RTDB 按條件查詢的規則](https://firebase.google.com/docs/database/security/rules-conditions)
- [Admin SDK 自訂 claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Emulator 規則測試](https://firebase.google.com/docs/rules/unit-tests)
- [RTDB Console JSON 匯出](https://firebase.google.com/docs/database/manage-data-console)
- [Firestore 匯出、IAM 與計費](https://firebase.google.com/docs/firestore/manage-data/export-import)
