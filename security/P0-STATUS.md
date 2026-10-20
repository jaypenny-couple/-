# ALICE P0 修復狀態（2026-10-20）

**此分支只供審查與測試。不得直接併入 `main`、發布任何候選規則或用正式資料執行測試。**

## 已核對的範圍

| 專案 | 原始碼使用的服務與路徑 | 原始碼目前登入 | 正式生效規則／資料庫實例 |
| --- | --- | --- | --- |
| `new-customer-management-system` | RTDB `records`，`asia-southeast1` URL | 無 | 未取得管理權限，待核對 |
| `pre-order-registration` | RTDB `reservations`，`asia-southeast1` URL | 無 | 未取得管理權限，待核對 |
| `restocking-list` | RTDB `stockItems`，`firebaseio.com` URL | 無 | 未取得管理權限，待核對 |
| `hr-system-ad937` | Firestore `salon/main` | 無 | 未取得管理權限，待核對 |

GitHub Pages API 顯示官網部署來源為本儲存庫 `main` 根目錄（legacy build）。本機原始碼由公開儲存庫克隆，開發分支為 `codex/p0-firebase-auth-staging`。四個前端 `authDomain` 顯示 Auth SDK 可整合的 Firebase 專案設定，**不代表** Email/Password 提供者已啟用或帳號已存在。Firebase CLI 起初不可用且沒有登入設定；gcloud 與 ADC 憑證也不存在。後續僅在本機安裝 Firebase Tools 測試依賴，沒有取得正式專案權限。

## 風險評估

| 風險 | 證據 | 程度 | 修復 |
| --- | --- | --- | --- |
| 新客跨設計師讀取 | `新客管理.html` 原版讀取整個 `records`，僅在前端篩選 | 高；若正式規則允許讀取即暴露全部記錄 | 本分支改為 `designer` 條件查詢，候選 RTDB 規則以後端核發的設計師 claim 限制查詢及單筆讀寫 |
| 無真正員工授權 | 四頁原版無 Auth 登入與角色判斷，直接讀寫資料庫 | 高；實際匿名風險取決於未知的正式規則 | 本分支加入 Auth 登入閘門與角色候選規則 |
| 可能整批刪除 | 前端沒有整批刪除按鈕，但若正式 `.write` 過寬，可直接呼叫資料庫 API | 高，待正式規則驗證 | 候選規則只允許單筆寫入，不授予集合根節點寫入 |
| 持久型 HTML 注入 | 預訂與缺貨頁原版將資料庫欄位直接寫入 `innerHTML` | 高；資料若含 HTML 可執行頁面腳本 | 本分支對預訂文字轉義、缺貨改用 `textContent` |
| HR 整份文件覆寫 | `休假進修管理.html` 使用單一 `salon/main` 文件及 `setDoc` 寫入整份狀態 | 中；並行編輯／還原可能覆蓋他人更新 | 本次保留格式與流程；切換前需實際備份、並行操作驗收，後續規劃交易式資料拆分 |

**匿名讀／寫、目前是否能刪全部資料、過期測試規則、Firestore 其他 collection、完整正式資料路徑、Auth provider 狀態都尚未經管理介面驗證。不得將風險推測寫成已確認外洩。**

## 本分支修改

- 四頁加入 Email/Password 登入、登出、角色檢查、權限不足與連線失敗提示。管理角色僅認可 Firebase ID token 的 custom claims；前端顯示檢查不是安全邊界。
- 新客仍用既有 `records/<id>` 格式，設計師僅能按原有 `designer` 值查詢。管理者可切換設計師，設計師只能進入自己的設計師頁。
- `security/rules/` 存放**尚未部署**的規則。角色矩陣：新客 `manager` 或指定 `designer`；預訂與缺貨 `staff` 或 `manager`；HR 僅 `manager`。每個專案另要求相符 `aliceApp` claim。
- `assign-staff-claim.mjs` 是可信任管理環境用的 Admin SDK 腳本，預設唯讀 dry run；`--apply` 要求專案、UID、角色及儲存既有 claims 的私人備份路徑。本次未執行正式 claim 變更。
- Firebase Emulator 與本機瀏覽器用合成資料測試，所有 Auth、RTDB、Firestore 呼叫在 `localhost` 轉向 Emulator，不連正式資料庫。

## 正式備份：尚未完成

1. 先以 Firebase／Google Cloud Console 核對四專案擁有權、實例、規則、Authentication provider、計費方案與 IAM。RTDB 至少需能唯讀取得資料及目前規則；帳號／規則部署後續需要 Auth 管理及 Firebase Rules 發布權限。不要以匿名 REST 讀取來探測。
2. 在私有、受保護且位於公開 repo 之外的目錄，對三個 RTDB **各實例的 `/` 根節點**做官方 Console Export JSON 或執行 P0 ZIP 的 `scripts/backup-rtdb-readonly.ps1`。逐份保存目前生效規則。驗證 JSON 可解析、非錯誤回應，記錄專案／實例／UTC 時間／大小／SHA-256。ZIP 腳本只涵蓋硬編碼的三個實例，**不會備份規則，也不保證發現額外實例**；必須另行核對。
3. Firestore 官方 managed export 需要 Blaze 計費、合適 GCS bucket 和帳號／服務代理 IAM；匯出會計入文件讀取及 GCS 儲存費用。先核對方案、bucket、權限與費用，再取得使用者付費同意，才可啟動 ZIP 腳本。確認操作完成、bucket 產物與可還原的目標／程序。`salon/main` 的頁面 JSON 匯出不足以代表整個 Firestore 專案。
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
