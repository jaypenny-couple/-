# ALICE P0 修復狀態（2026-10-21）

**Draft PR #43 僅供審查。禁止合併、部署官網、修改正式 Security Rules 或正式資料。HR 自管備份已完成本機還原核對；持續寫入的一致性與員工切換驗收仍未解決，正式切換維持阻擋。** 本輪未升級 Blaze、未建立付費雲端資源。

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

- 四頁候選版採 Firebase Email/Password 登入、登出及後端核發 custom claims。角色矩陣：新客 `customer/manager` 可管理全部、`customer/designer` 只能以 `aliceDesigner` 對 `designer` 欄位查詢和操作自己的紀錄；預訂 `preorder/staff|manager`；缺貨 `stock/staff|manager`；HR `hr/manager`。每個專案都要求相符 `aliceApp`。UI 閘門只負責顯示，真正授權由候選 Security Rules 執行。
- 本機對 RTDB 私人備份只做設計師值的**彙總**核對，未輸出個資：既有資料的值均落在候選清單 `JAY`、`IRIS`、`SHERRY`、`CINDY`。後續若出現新設計師名稱，需同步調整帳號 claim 與頁面選單。原有 `records/<id>`、`reservations/<id>`、`stockItems/<id>` 及 HR `salon/main` 資料格式未遷移。
- 四個 Firebase 專案各有**獨立** Authentication 帳號庫；員工須在對應專案由可信任管理者建立／管理 Email/Password 帳號並驗證 email，再用 `assign-staff-claim.mjs` 由管理者對既有 UID 核發角色。腳本預設 dry run；正式建立帳號、啟用 provider 或套用 claim 都未執行。不能把前端選單、網址參數或 `auth != null` 當成管理授權。
- 候選 `security/rules/hr.firestore.rules` 已把 `salon/main` 的 `read`、`create`、`update` 留給 HR manager，**整份文件 `delete` 一律拒絕**。頁面內原有請假項目的刪除是更新 `salon/main` 陣列，不是刪除文件。
- 2026-10-21 `npm test` **8/8 通過**：Auth 閘門、四套 Emulator 權限規則及四頁瀏覽器合成資料流程。包含新增、讀取、必要編輯／刪除、登入登出、重整、斷線恢復、匿名與錯誤角色拒絕、設計師跨人資料拒絕、管理員工作流程，以及 HR manager 更新成功／整份文件刪除遭拒。缺貨頁原本沒有編輯功能；HR 編輯由文件更新與頁面流程覆蓋。沒有碰正式顧客資料。

## 仍需人工驗收

- 對 HR 自管備份設定可驗證的低寫入窗口或增量核對程序，處理備份時點後的正式寫入；再次確認是否需要保存 Firestore 索引及其他應用配置。不能把這次還原演練視為整個 Firebase 專案（含 Auth／規則／索引）的完整還原。
- 取得四專案實際員工名單、職責、設計師對應，分別建立和驗證帳號、核發 claim，讓在職員工以實際裝置檢查全部必要工作。四專案目前尚無已驗收的員工登入，因此本機測試不能代表正式可用性。
- HR 頁目前 500ms 防抖後以 `setDoc` 寫回**整份** `salon/main`；登出／權限變化會清除尚未送出的 timer，並行管理員的整份覆寫亦可能互相覆蓋。需要真實工作流程與並行編輯驗收、保存待寫入變更的設計或交易式改造，方能宣稱切換無資料遺失風險。
- 舊版已開啟的頁面無登入機制。新版頁面與新規則分階段上線時，快取／舊分頁可能遭拒絕；若新版先上線但 Auth provider 或 claim 未就緒，員工也會被擋。需有人值守、通知員工重整、明確切換窗口及回復方案，並先確認新舊資料同步與待送出資料；未取得使用者正式切換確認前不得部署。

## 正式部署阻擋與回復

1. **HR 文件樹自管備份、雜湊與還原已通過，但無法證明營運持續寫入期間的原子一致性。** 必須設計低寫入／增量核對與備份後變更處理。三份 RTDB 備份是 2026-10-20 時點，部署前也須再確認新寫入資料的保護方式。
2. **Auth provider、實際員工帳號／claims、四套真實操作驗收與 HR 並行寫入安全方案未完成。** 尤其不能把舊頁面在新規則下直接留給員工使用。
3. **未排定或核准正式切換。** PR 保持 Draft，候選規則不可部署。現行正式公開規則仍有高風險，不能作長期解法；同時不得為了快速關閉規則而阻斷營運。

預定回復：先停止進一步變更並保留錯誤與備份時間線；只在核對備份後新增／修改資料後，以受控方式恢復相容頁面與規則。若舊規則公開，恢復它只可作極短、有人值守的應急措施，並立即改採安全的員工替代流程。**不可直接用舊 JSON 覆寫正式 RTDB 根節點或 `salon/main`，以免抹去備份後的工作。**
