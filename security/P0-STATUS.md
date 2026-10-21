# ALICE P0 修復狀態（2026-10-21）

**Draft PR #43 僅供審查。禁止合併、部署官網、修改正式 Security Rules 或正式資料。HR 自管備份已完成本機還原；候選交易式寫入已在 Emulator 驗證。最後備份窗口、實際員工帳號與正式切換驗收未完成，正式切換維持阻擋。** 本輪未升級 Blaze、未建立付費雲端資源。

## 已實際完成並驗證

| 專案 | 正式服務與已知資料路徑 | 正式生效規則（2026-10-20 Console 核對） | 正式備份 |
| --- | --- | --- | --- |
| `new-customer-management-system` | RTDB，`records`，`asia-southeast1` 實例 | 根節點 `.read: true`、`.write: true` | 2026-10-20 完整根節點唯讀 JSON、規則、SHA-256 已存本機受限目錄 |
| `pre-order-registration` | RTDB，`reservations`，`asia-southeast1` 實例 | 根節點 `.read: true`、`.write: true` | 同上 |
| `restocking-list` | RTDB，`stockItems`，`firebaseio.com` 實例 | 根節點 `.read: true`、`.write: true` | 同上 |
| `hr-system-ad937` | Firestore Native `(default)`，`asia-east1`；正式遞迴盤點找到 `salon/main`，無其他集合或子集合 | `match /{document=**}` 下 `allow read, write: if true` | 2026-10-21 自管唯讀文件備份，SHA-256 及本機 Emulator 還原核對通過；不是託管原子快照 |

- GitHub Pages 的正式部署來源為本公開儲存庫 `main` 根目錄；本 PR 位於 `codex/p0-firebase-auth-staging`，仍為 Draft。四專案 2026-10-20 均為 Spark；當時 Console 顯示本機 Google 帳號均為擁有者、Authentication 均尚未啟用。正式資料不在此 PR。
- 三套 RTDB 各由 Firebase CLI 確認只有一個實例，對 `/` 做官方唯讀 JSON 匯出；三份 JSON 格式、檔案大小與 SHA-256 已獨立驗證，備份時間與專案／實例寫入私人 manifest。四份當時生效規則也已私人保存。私人目錄 ACL 限本機使用者與 SYSTEM；沒有提交 JSON、個資、憑證或 Token。
- 正式規則的匿名讀寫與整批修改／刪除風險已由 Console 規則確認。沒有用匿名身分讀取或寫入正式顧客資料；**有資料暴露風險，但無證據證明已發生外洩。** 原版新客頁先讀取全部 `records` 再在前端依設計師篩選，無資料層級隔離。
- 使用者已親自完成 ADC 登入；ADC 類型為 `authorized_user`，沒有 `quota_project_id`。2026-10-21 以此 ADC 對 HR Firestore 執行 `listCollectionIds` 唯讀 API **成功**，因此該配額警告沒有阻擋本次 Firestore 讀取，實際 IAM 讀取能力已驗證。2026-10-20 Console 顯示帳號為擁有者；本次只以 API 驗證了所需的讀取能力，沒有修改 IAM、配額專案或建立服務帳戶金鑰。

## 免費 HR Firestore 備份評估

官方 [Firestore 免費額度](https://firebase.google.com/docs/firestore/quotas)為每天 50,000 次文件讀取；[Firestore 定價](https://cloud.google.com/firestore/pricing)將 `listCollectionIds` 請求計為讀取，列舉文件也耗用讀取。2026-10-21 Firebase Console Usage 在備份前後均顯示本期 **6 次讀取**，但 Console 指標可能延遲，不能當成即時精確帳單。API 預檢、盤點、匯出的保守讀取上限分別為 1、28、28 次；匯出另設 100 次硬上限與 20,000 次營運保留量，計入觀察值仍遠低於 50,000。官方託管匯出需要付費條件；使用者已拒絕 Blaze 與任何付費，故完全不啟用。

本分支新增 `security/firestore-self-backup.mjs`，以官方 Google Firestore API 用戶端與使用者 ADC 做**應用程式自行管理的唯讀文件複本**：

1. `inventory` 從資料庫根部以 `listCollectionIds`、分頁 `listDocuments(showMissing)` 遞迴列舉每個頂層 collection、document、子 collection 與缺失的父文件；記錄完整路徑、建立／更新時間，保留在私人目錄。此步有預設 5,000、最高 10,000 的保守讀取預算。
2. `export` 重新遞迴掃描並保存 Firestore REST `Value` 原始型別結構、文件路徑、集合路徑、建立／更新時間、讀取時點、專案與資料庫；附 SHA-256、位元組數、UTC 時間與讀取預算 manifest。僅在最近 Console 讀數加上盤點上限、匯出上限與 20,000 次營運保留量不超過 50,000 時允許執行；超額即停。輸出只允許在現有本機受保護的 ALICE 私人備份目錄，程式不含正式寫入 API。
3. `restore-emulator` 只接受 `127.0.0.1` Firestore Emulator，先驗 SHA-256 與大小，再還原至 `demo-alice-backup-restore`，並重新列舉比較文件路徑、集合路徑、是否存在及所有欄位型別與值。建立／更新時間只記錄於備份，Firestore 不能以此方式恢復原伺服器時間；Security Rules、索引、Auth 帳號與自訂 claims 也不是此文件複本的一部分，需各自保存／重建。

**正式 HR 備份已執行並核對：** 以 ADC 及 `readTime=2026-10-21T01:48:28.262Z` 遞迴盤點，找到頂層 `salon`、實存文件 `salon/main` 各 1，沒有子集合或缺失父文件。再以同樣的完整樹遍歷唯讀匯出，文件路徑與建立／更新版本和盤點一致。JSON 為 13,394 bytes，SHA-256 `f41a3e69f38f9d868344f94db7ddac304c739db7389845107639ea504394b2ed`；UTC 匯出時間、來源專案、資料型別、文件 metadata、讀取預算與雜湊記於私人 manifest。備份、manifest、驗證紀錄與 Emulator 日誌都放在 `%LOCALAPPDATA%/ALICE-P0-PRIVATE-BACKUPS/20261021-HR-FIRESTORE`，該子目錄 ACL 關閉繼承，只允許目前使用者與 SYSTEM。獨立重算 SHA-256、大小及 JSON 格式通過；在乾淨的 localhost Emulator 還原正式備份後，重新列舉並核對 1 條集合路徑、1 份文件路徑及全部欄位型別／值成功。正式資料未寫回正式環境。

**合成資料測試另行通過：** 6 份實存文件、1 個缺失父文件、5 條集合路徑及巢狀子集合已匯出，在乾淨 Emulator 上還原並重新讀回比對成功；測了大整數、時間、位元組、地理點、參照、陣列與 map 型別。

**一致性限制：** 文件列表採同一次掃描的 `readTime`；集合 ID 列表 API 無相同 `readTime`。盤點與匯出分兩次掃描，路徑及文件版本已相符，但持續新增／刪除集合、同時寫入與後續營運寫入仍可能使自管複本不是可證明的單一時間點快照。建立／更新時間有保存在備份，Emulator 不能恢復原伺服器 metadata；規則、索引、Auth 帳號及 claims 需另行保存。正式切換前仍需低寫入時段或增量核對方案，不能用這份備份直接覆寫正式文件。官方 REST 的 [列舉文件](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/listDocuments)與 [ADC](https://firebase.google.com/docs/admin/setup)文件是工具依據。

## 僅在本機測試通過

- 四頁候選版採 Firebase Email/Password 登入、登出及後端核發 custom claims。角色矩陣：新客 `customer/manager` 可管理全部、`customer/designer` 只能以 `aliceDesigner` 對 `designer` 欄位查詢和操作自己的紀錄；預購只接受 `preorder/staff`；缺貨只接受 `stock/staff`；HR `hr/manager` 須逐人批准。每個專案都要求相符 `aliceApp`。UI 閘門只負責顯示，真正授權由候選 Security Rules 執行。
- 本機對 RTDB 私人備份只做設計師值的**彙總**核對，未輸出個資：既有資料的值均落在候選清單 `JAY`、`IRIS`、`SHERRY`、`CINDY`。後續若出現新設計師名稱，需同步調整帳號 claim 與頁面選單。原有 `records/<id>`、`reservations/<id>`、`stockItems/<id>` 及 HR `salon/main` 資料格式未遷移。
- 四個 Firebase 專案各有**獨立** Authentication 帳號庫；員工須在對應專案由可信任管理者建立／管理 Email/Password 帳號並驗證 email，再用 `assign-staff-claim.mjs` 由管理者對既有 UID 核發角色。腳本預設 dry run；正式建立帳號、啟用 provider 或套用 claim 都未執行。不能把前端選單、網址參數或 `auth != null` 當成管理授權。
- 候選 `security/rules/hr.firestore.rules` 已把 `salon/main` 的 `read`、`create`、`update` 留給 HR manager，**整份文件 `delete` 一律拒絕**。頁面內原有請假項目的刪除是更新 `salon/main` 陣列，不是刪除文件。
- 2026-10-21 `npm test` **17/17 通過**：Auth 閘門、四套 Emulator 權限規則、四頁瀏覽器合成資料流程、HR 並行合併與衝突、整份匯入版本指紋、兩類快照差異分類，以及舊版匿名頁遭拒／新版管理員讀取舊格式模擬。外部帳號切換保留未送出表單也已驗證；預購／缺貨 manager claim 在登入閘門、RTDB 規則及核發工具皆遭拒，staff 原有 CRUD 通過。沒有碰正式顧客資料。

## 第三階段：HR 並行寫入修復（僅候選版）

- `休假進修管理.html` 已移除 500ms 防抖及整份 `setDoc` 覆寫。每個操作立即以 Firestore `runTransaction` 讀取最新 `salon/main`，只更新有變動的四個陣列欄位；陣列內以紀錄 ID 比對。同一紀錄若被另一台裝置修改或刪除，拒絕覆寫；不同紀錄同時新增／修改可合併。保留文件的其他未知欄位與原資料格式。匯入與清空也須比對文件版本，衝突就停止。
- 右下角明示「正在儲存／已重新讀回確認／未確認」，取得伺服器寫入及讀回結果前不稱已儲存。失敗時保留本機草稿、停止繼續編輯，提供重試、下載草稿或明確確認後放棄；待確認操作時阻止頁面內登出並觸發離頁警示。外部登出／帳號切換時，未送出表單留在原頁且資料區鎖定，只有原帳號能恢復。作業系統強制結束、瀏覽器 crash 或斷電可略過 `beforeunload`，未確認操作與未送出欄位仍可能遺失，這是無法由網頁攔截的剩餘營運風險。
- 即時更新在有人填寫表單時延後重繪，避免另一裝置的更新清掉未送出的輸入；提交時由交易合併或提示衝突。舊版配額若沒有 `id`，可用員工與年度辨識；原配額刪除漏呼叫儲存的問題已修正。私人正式 HR 備份已核對，目前配額陣列為空；「無 id 舊配額」是**合成相容性測試**，不是正式資料現況。
- 兩個獨立瀏覽器工作階段在 Emulator 驗證：不同請假紀錄都保留；同一合成員工的並行更名使第二台顯示衝突而不覆蓋；拒絕規則下顯示未儲存、阻止登出，網路恢復後操作仍被封鎖；待確認操作與未送出表單在外部登出後均不交給另一帳號，原帳號重登後草稿仍在。合成舊格式文件的員工／配額／請假／進修、匯入及清空流程通過，未知欄位保留。這些結果**不等於正式員工驗收**。強制結束仍可能丟失記憶體草稿。

## 最後備份與增量核對方案（尚未對正式資料執行新快照）

- 新增 `security/compare-snapshots.mjs`／`snapshot-diff.js`，只讀私人 B0、B1 快照，按三套 RTDB 的單筆 ID、HR 的完整集合／文件路徑及四個陣列項目分類新增、修改、刪除；未知 RTDB 根節點另列。詳細 ID 與前後雜湊只寫私人 ledger，終端只報數量。合成資料測試新增／修改／刪除分類通過；既有四份私人備份各與自身比對均為零差異，這只是格式驗證，**不是備份後正式變更的核對結果**。
- 正式切換的低寫入窗口開始後，請員工停寫並回報最後操作，再在私人受限目錄取得三套 RTDB 根節點與 HR 完整文件樹的唯讀 B1 快照，重新驗 JSON、大小、SHA-256、規則快照及 HR Emulator 還原；B0→B1 差異逐筆與營運紀錄核對，尤其確認刪除。停寫期間再取得 B2 並做同樣驗證，B1→B2 應為零；若有未解釋變更或時間不足，停止切換。正式切換後 B3 只與核准操作核對，**絕不以舊備份覆寫正式資料**。
- **22:00–22:30（臺北時間）只是候選停寫時段，尚未排定。**業主需確認日期、員工通知及是否接受規則切換到網站更新期間的服務等待。Runbook 已設 G1–G8 必須逐項留證，包含 B1/B2、B1→B2 零差異、關閉舊分頁、新版登入、Security Rules 切換、網站部署及 B3 核對；任何一項缺證據則 No-Go。本輪未暫停任何服務。詳見 [P0-CUTOVER-RUNBOOK.md](P0-CUTOVER-RUNBOOK.md)。

## 員工帳號與權限矩陣

| 職責 | 必須建立帳號的 Firebase 專案 | 權限 claim | 驗收重點 |
| --- | --- | --- | --- |
| 新客管理員 | `new-customer-management-system` | `customer/manager` | 全部設計師的單筆工作流程；不可整批刪除 |
| 設計師 | 同上 | `customer/designer`＋核准的 `aliceDesigner` | 只查詢及操作本人代碼；跨設計師拒絕 |
| 商品預購操作人員（含需操作的店長） | `pre-order-registration` | `preorder/staff` | 原有預購新增、查詢、編輯、刪除；候選版沒有 manager 專屬操作 |
| 缺貨登記人員（含需操作的店長） | `restocking-list` | `stock/staff` | 原有缺貨新增、查詢、刪除；候選版沒有 manager 專屬操作 |
| HR 管理人員 | `hr-system-ad937` | `hr/manager` | 員工、配額、請假、進修；整份文件刪除拒絕 |

每個專案的 Auth 帳號及 UID 獨立；跨系統員工需在各自專案建帳號。已在本機受限目錄建立私人權限確認表（七列角色範本）及逐人實機驗收表（十二項檢查範本）；表單含尚未填寫的可用時段、裝置與驗收人欄位，未填入真實姓名或信箱，未提交 GitHub。員工名單及可用時段尚未提供，故沒有排定個別實機時段。新客設計師、預購 staff、缺貨 staff 為建議最低角色；預購與缺貨頁無 manager 專屬操作，候選版只接受 staff；新客 manager 僅依跨設計師管理職責批准；HR manager 僅在逐人批准後核發。業主須私下確認每位正式員工的核准 email、所需系統／角色、職責、設計師代碼（如適用）、主管核准及離職停用方式；**尚未建立正式帳號、啟用正式 provider 或核發正式 claims**。

正式 Auth dry-run 計畫已列於 Runbook：Provider 啟用、逐人帳號建立及逐組 claims 核發分開批准；帳號存在且信箱驗證後才用 ADC 對該 UID 執行 `assign-staff-claim.mjs` 唯讀 dry run。該模式只讀取既有帳號，不建立帳號或修改 claims；`--apply` 是需另行批准的正式權限變更。本階段未連正式 Auth 執行 dry run。

## 四套系統高權限操作檢查

- 新客 manager 可以讀取全部設計師紀錄並單筆刪除；只核發給明確負責跨設計師管理的人員。設計師仍受資料庫規則限制在本人紀錄。
- 預購與缺貨候選頁沒有 manager 專屬操作，舊候選規則曾讓 manager 與 staff 權限完全相同。已從兩頁登入白名單、候選資料庫規則及 claims 核發白名單移除 manager；所有實際需要操作的人員使用個人 `staff` 帳號，Emulator 已驗證 manager claims 遭拒絕。正式規則未修改。
- 預購 staff 可讀完整共用預購清單（包含顧客聯絡資料）、新增、更新取貨日期及刪除任一預購；資料庫規則也允許直接更新同一預購的其他欄位。缺貨 staff 可讀完整共用清單、新增及刪除任一項目。這與目前共用操作頁相符，但業主仍需確認每位操作人員皆應看到全清單並可刪除任一項目；若要縮限需先在獨立 Emulator 依舊資料欄位驗證。
- HR `manager` 對整份 `salon/main` 有讀取與更新能力，包含員工、配額、請假、進修、匯入及清空；整份文件刪除遭拒。必須逐人核准其 HR 工作範圍，並確認是否需要整份匯入／清空權限。不能用隱藏前端按鈕作權限控制。

## 仍需人工驗收

- 業主確認低寫入窗口與操作員，正式再做 B1/B2 快照和差異核對，處理現有備份時點後的寫入；再次確認是否需要保存 Firestore 索引及其他應用配置。自管文件還原不等於整個 Firebase 專案（含 Auth／規則／索引）的完整還原。
- 取得四專案實際員工名單、職責、設計師對應，分別建立和驗證帳號、核發 claim，讓在職員工以實際裝置檢查全部必要工作。四專案目前尚無已驗收的員工登入，因此本機測試不能代表正式可用性。
- 候選 HR 交易式寫入已通過本機測試；仍需實際 HR 管理員以真實裝置驗收並行、離頁、切換帳號與離線後恢復。瀏覽器強制關閉可略過離頁警示，故員工須看到雲端讀回確認才離開；未送出表單在強制關閉時仍可能遺失，列為未消除風險。
- 舊版已開啟的頁面無登入機制。新版頁面與新規則分階段上線時，快取／舊分頁可能遭拒絕；若新版先上線但 Auth provider 或 claim 未就緒，員工也會被擋。需有人值守、通知員工重整、明確切換窗口及回復方案，並先確認新舊資料同步與待送出資料；未取得使用者正式切換確認前不得部署。

## 正式部署阻擋與回復

1. **HR 文件樹自管備份、雜湊與還原已通過，但營運持續寫入期間仍非託管原子快照。** B1/B2 低寫入與增量核對尚未執行；三份 RTDB 備份仍為 2026-10-20 時點。
2. **Auth provider、實際員工帳號／claims、四套真實操作與 HR 並行驗收未完成。** 舊開啟頁面無 Auth，新規則下會被拒絕；需完成舊分頁與新版交接程序。
3. **未排定或核准正式切換。** PR 保持 Draft，候選規則不可部署。現行正式公開規則仍有高風險，不能作長期解法；同時不得為了快速關閉規則而阻斷營運。

## 需要業主確認的最少事項

1. 私下核准正式員工識別、信箱、每人所需 Firebase 專案與最低角色；確認設計師代碼，對每個 manager 說明必要職責，並指定帳號停用負責人。
2. 逐專案批准是否啟用 Email/Password provider；逐人批准建立帳號；逐組批准完整 Custom Claims。這三類正式 Auth 變更分別確認，未核准前均不執行。
3. 選定或拒絕 22:00–22:30 候選停寫時段，指定負責人與員工通知方式，確認可接受 G5 規則切換到 G6 網站更新期間的服務等待。
4. 正式切換時另行批准 Runbook G1–G8 的備份／差異證據、舊分頁關閉、新版實機登入、候選 Security Rules 與 GitHub Pages 部署；四套 B1→B2 必須零差異，否則停止。
5. 確認預購 staff 是否需讀取完整清單中的顧客聯絡資料並刪除任一預購、缺貨 staff 是否需刪除任一共用項目，以及每位 HR manager 是否需要使用整份匯入／清空功能。未確認前不擴大候選角色或正式權限。

目前未排程窗口、未停寫、未建立正式帳號、未啟用 provider、未核發 claims，未改規則、未合併或部署。

預定回復：先停止進一步變更並保留錯誤與備份時間線；只在核對備份後新增／修改資料後，以受控方式恢復相容頁面與規則。若舊規則公開，恢復它只可作極短、有人值守的應急措施，並立即改採安全的員工替代流程。**不可直接用舊 JSON 覆寫正式 RTDB 根節點或 `salon/main`，以免抹去備份後的工作。**
