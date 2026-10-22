# ALICE P0 修復狀態（2026-10-22）

**Draft PR #43 僅供審查。禁止合併、部署官網、修改正式 Security Rules 或正式資料。HR 自管備份已完成本機還原；候選交易式寫入已在 Emulator 驗證。最後備份窗口、實際員工帳號與正式切換驗收未完成，正式切換維持阻擋。** 本輪未升級 Blaze、未建立付費雲端資源。

**業主已核准的營運決策：**預購與缺貨系統在正式安全切換初期不提供任何刪除功能。一般員工、主管及舊 manager 均須由網頁、SDK、REST 遭 Rules 拒絕；取消、重複及誤登紀錄改走人工交班。正式刪除工具列為上線後待獨立批准功能；候選工具只可連 localhost Emulator，不得新增正式刪除路徑。此決策不略過 G1–G8、備份、權限或員工驗收門檻。

## 第十階段：正式 Authentication Provider 啟用準備（唯讀／Emulator；尚未啟用）

**檢查時間：2026-10-22（臺北時間）。**四個 Firebase Project ID 均由本機 Firebase CLI 專案清單核對，且各自的 Firebase Console 顯示 Spark 方案。Console 的 Authentication 頁面均停在「開始使用」初始設定頁，未顯示已設定的登入 Provider；本輪沒有點擊開始設定或儲存任何正式設定。

| 正式專案 | Project ID | 方案 | Console Authentication 狀態 | Email/Password / 其他 Provider | 操作者管理權限 | Auth 使用者數 |
| --- | --- | --- | --- | --- | --- | --- |
| 新客管理 | `new-customer-management-system` | Spark，已在 Console 核對 | 初始「開始使用」頁；未見已完成設定 | 頁面未列 Provider；目前狀態未能由設定 API 獨立讀回 | 專案可見及 CLI 可列清單；啟用所需 IAM 角色未驗證 | 未驗證 |
| 商品預購 | `pre-order-registration` | Spark，已在 Console 核對 | 初始「開始使用」頁；未見已完成設定 | 頁面未列 Provider；目前狀態未能由設定 API 獨立讀回 | 專案可見及 CLI 可列清單；啟用所需 IAM 角色未驗證 | 未驗證 |
| 缺貨登記 | `restocking-list` | Spark，已在 Console 核對 | 初始「開始使用」頁；未見已完成設定 | 頁面未列 Provider；目前狀態未能由設定 API 獨立讀回 | 專案可見及 CLI 可列清單；啟用所需 IAM 角色未驗證 | 未驗證 |
| HR | `hr-system-ad937` | Spark，已在 Console 核對 | 初始「開始使用」頁；未見已完成設定 | 頁面未列 Provider；目前狀態未能由設定 API 獨立讀回 | 專案可見及 CLI 可列清單；啟用所需 IAM 角色未驗證 | 未驗證 |

**查核限制與安全影響：**本機 Firebase CLI 可列出四個專案，但不能據此推定有啟用 Authentication 的 IAM 權限。ADC 沒有 quota project；使用它呼叫 Identity Toolkit `projects.getConfig` 時收到要求 quota project 的 403，因此沒有安全地取得設定 API 的 Provider 清單。Admin SDK `listUsers` 也未成功，故四個專案的 Auth 使用者數均標為未驗證；沒有輸出或保存任何帳號身分。Console 初始頁沒有顯示其他 Provider，但這不等於設定 API 的完整 Provider 清單。沒有為了測試權限而執行正式寫入，也沒有設定 quota project、改 IAM 或建立金鑰。

本輪可見的設定衝突是正式 Security Rules 仍為公開規則（見上方正式規則盤點）。只啟用 Provider 不建立帳號、不授予資料權限，也不會修復或收緊 Security Rules；正式安全切換仍須在獨立批准與 G1–G8 程序中完成。Email/Password 單獨啟用不需升級 Blaze 或建立付費資源；官方 Firebase Auth 方案與密碼驗證說明見[方案說明](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)及[密碼驗證文件](https://firebase.google.com/docs/auth/web/password-auth)。

**候選版測試：**在本機 Auth、RTDB、Firestore Emulator 以合成帳號與資料執行完整 `npm test`。新增真實 Auth Emulator 瀏覽器案例：錯誤密碼登入失敗、無 Claims 帳號即使密碼正確也不能進入受保護資料頁；既有案例涵蓋 Email/Password 登入、登出、重新整理、錯誤 App／角色、設計師資料隔離、預購／缺貨 SDK 與 REST 刪除遭拒、HR 交易式寫入及斷線恢復。2026-10-22 全套結果 **27/27 通過、0 失敗、0 跳過**。全部是 Emulator 證據，非正式帳號驗收。

**逐專案正式啟用準備：**若業主批准單一專案，操作員應先再次核對 Console 專案 ID、Spark 方案、目前 Provider 頁及設定權限，記錄設定前狀態，再於 Firebase Console「Authentication → 開始使用／Sign-in method」只啟用 Email/Password 並儲存。隨即重新開啟該專案的 Provider 設定頁，確認 Email/Password 已啟用，其他 Provider 未變，並記錄時間、操作者與私人證據位置。若出現專案 ID 不符、非 Spark、意外 Provider、IAM 不足、頁面要求啟用付費服務或設定結果無法讀回，立即停止該專案；不以其他 API、CLI 權限捷徑或正式寫入測試替代。若設定後有異常，停止帳號建立，依同一 Console 設定頁將 Email/Password 恢復到變更前狀態並重新讀回核對；不刪除任何使用者，也不改資料庫規則。正式帳號尚未建立，使用者數與設定 API 讀回限制須在操作前重新檢查。

**本次正式操作核准待辦：**只需逐項回答是否允許在以下各 Firebase 正式專案啟用 Email/Password Provider：`new-customer-management-system`、`pre-order-registration`、`restocking-list`、`hr-system-ad937`。這項核准只涵蓋 Provider 開關，不涵蓋建立個人帳號、核發 Custom Claims、修改 Security Rules、合併 PR 或部署網站。業主尚未核准，故本輪沒有正式寫入。

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
- 2026-10-21 第六階段完成後 `npm test` **19/19 通過**（本機 Emulator）：Auth 閘門、四套規則、四頁瀏覽器合成流程、HR 並行與快照工具、預購／缺貨刪除權限分離及 Custom Claims 策略測試。預購 staff 可新增與改取貨日期，但刪除、改其他欄位、清空必要欄位與多路徑刪除均遭拒；缺貨 staff 可讀取與新增但不能任意更新或刪除。核准合成 staff 單筆刪除通過、整批刪除拒絕。正式員工與正式環境尚未驗收。

## 第六階段：預購與缺貨刪除權限分離（候選版）

- 第六至第八階段曾評估 Custom Claims 與 RTDB 授權列；第九階段已將兩者都移出預購／缺貨刪除判定。`aliceCanDelete` 與 `deletionAuthorizations` 現在均不授予客戶端刪除權。
- 私人備份欄位統計確認預購舊格式為 9 個欄位（`id`、`reservationDate`、`customerName`、`contactPlatform`、`product`、`quantity`、`phone`、`pickupDate`、`createdAt`），缺貨為 4 個欄位（`vendor`、`item`、`timestamp`、`date`）。新紀錄須通過必填欄位與型別驗證；預購舊紀錄的既有欄位不可竄改或移除，只有 `pickupDate` 可更新。缺欄或錯型的舊預購紀錄可能無法做該更新，故切換前需重新用最新 B1 重跑檢查。缺貨頁原本只讀／新增／刪除，候選規則拒絕既有項目更新。個人資料值未列入報告。
- 預購及缺貨網頁已移除刪除按鈕、授權列監聽與直接刪除函式。一般員工及主管均由本機工具以外的網頁介面無法發起刪除。
- `security/staff-claim-policy.js` 驗證專案、完整角色與逐人逐專案核准紀錄，清除殘留的 `aliceCanDelete`。正式 Claims 核發仍硬性停用；私人員工表欄位已改為 `LocalToolDeleteEligible`、`LocalToolApprovalRef`，預設維持不具資格，員工識別欄保持原狀且不公開。
- 歷史 Custom Claims 與授權清單刪除方案均已退役。身份工具不再建立或沿用刪除 claim；舊 `aliceCanDelete=true` token 也不能繞過候選 Rules。
- 第六階段的測試記錄屬歷史結果；第九階段全套測試結果見下方，已重新驗證所有候選規則與瀏覽器頁面。

## 第七階段：正式備份相容性與撤權方案評估（僅唯讀／Emulator）

- 唯讀讀取本機受限備份 `%LOCALAPPDATA%/ALICE-P0-PRIVATE-BACKUPS/20261020-P0/20261020_184155`；僅輸出欄位統計，不輸出紀錄值、姓名、電話或其他顧客個資。預購備份 2 筆：9 個必要欄位缺漏數皆為 0、型別錯誤數皆為 0、額外欄位紀錄數為 0；兩筆 `pickupDate` 均為字串。缺貨備份 5 筆：4 個必要欄位缺漏數皆為 0、型別錯誤數皆為 0、額外欄位紀錄數為 0。
- 將正式備份副本載入本機 Realtime Database Emulator（不是正式資料庫），使用一般合成 staff token 對每筆既有預購紀錄改寫合成 `pickupDate`，2/2 通過；沒有缺欄、錯型或多餘欄位造成拒絕。這證明的是該備份時點資料與當前候選規則相容，不代表切換當天新增資料仍相同。缺貨資料的 staff 任意編輯測試 5/5 遭拒；此與缺貨頁目前只提供讀取／新增一致。原備份副本只存在本機 Emulator，正式資料未更動。
- 比較方案：Custom Claims 方案簡單、規則與目前 staff 認證一致；頁面每次刪除前強制刷新 token 可降低一般操作的撤權延遲，但舊的有效 ID token 仍可能直接呼叫規則授權的刪除，直到該 token 更新／過期。資料庫授權清單方案以 `auth.uid` 在各專案自己的 RTDB 查詢授權列，Rules 每次刪除均讀最新列；移除列後，持舊 token 的直接刪除也遭拒。每套資料庫只存 UID、專案 ID、App、staff 角色及刪除旗標；Rules 禁止一般用戶讀取他人授權列或寫入清單，管理者透過受信任 Admin SDK/ADC 寫入。
- 授權清單可在 Spark 使用，不需 Blaze 或新雲端服務；RTDB 官方 Spark 方案目前包含 1 GB 儲存、每月 10 GB 下載、100 個同時連線，資料列本身很小，但頁面讀／監聽授權列會增加少量下載流量，仍須在正式使用量中監控。資料庫由 Auth token 對應到授權列是 Firebase Rules 官方支援的做法，規則可用 `root` 查驗其他路徑。[RTDB Rules 條件](https://firebase.google.com/docs/database/security/rules-conditions)；[Spark/Realtime Database 配額與計費](https://firebase.google.com/docs/database/usage/billing)。
- 第七、八階段授權清單測試為歷史記錄，已由第九階段「所有客戶端皆不得刪除」方案取代。

## 第八階段：RTDB 授權清單方案（歷史候選，已由第九階段取代）

第八階段曾以每個專案獨立的 `/deletionAuthorizations/<uid>` 列控制刪除，測試也證明舊 token 撤權即時生效。但任一授權 UID 仍能透過原子多路徑 `update()` 同時刪除多筆，無法滿足「只有受保護的本機管理工具能刪除」的業主新決策。故第九階段已移除 Rules、前端、Claims 管理工具與快照比較流程對此清單的依賴。若正式備份中仍出現同名根節點，差異工具會列為未知根節點要求人工檢查，絕不自動刪除。

## 第九階段：本機單筆刪除管理工具（候選版）

- 預購與缺貨 RTDB Rules 對任何登入身分都不允許刪除既有紀錄。預購只接受既有 staff 的新增與受欄位驗證保護的更新（取貨日期）；缺貨 staff 只可新增。`remove()`、`set(null)`、整筆破壞性覆寫、多路徑刪除及根節點刪除均由 Emulator 規則測試拒絕。舊 `aliceCanDelete` claim 和殘留授權列不能改變結果。
- 兩個網頁已移除刪除按鈕、監聽、確認流程與直接刪除程式。正常登入、查詢、新增和預購取貨日期修改保留。快照差異工具不再把已退役的授權列當成受管理資料；若該根節點實際存在，會標示為未知並要求人工核對，不會清除。
- 新增 `security/delete-single-record-local.mjs`，只接受固定 project allowlist 和一個紀錄 ID，且強制 localhost RTDB Emulator；沒有正式環境 `--apply` 選項。操作者須符合本機私人核准檔 `DELETE-OPERATORS-APPROVAL.json`，逐專案列出 Windows 身分、店長／核准主管角色、核准人、時間和參考；工具不會自行建立名單。交互操作需再次輸入完整 ID 和 `DELETE`。讀取紀錄後只顯示路徑、ID 與內容雜湊，不顯示顧客資料。
- 工具先將指定紀錄完整 JSON 存入 `%LOCALAPPDATA%/ALICE-P0-PRIVATE-BACKUPS/RECORD-DELETIONS` 受限目錄，再讀回驗證 SHA-256。交易呼叫前持久化 `DELETE_ATTEMPTING` 稽核標記；明確未提交記為 `DELETE_NOT_EXECUTED`，交易逾時／回應不明記為 `DELETE_OUTCOME_UNKNOWN`，已提交但後續讀取或集合核對失敗記為 `DELETE_COMMITTED_UNVERIFIED`，成功讀回才記為 `DELETED_AND_VERIFIED`。未知／已提交未驗證／已成功的同一專案與 ID 都拒絕直接重試，須先核對私有稽核、備份雜湊和資料現況。
- 本機 Emulator 全套 `npm test`：**27/27 通過、0 失敗、0 跳過**（2026-10-22 最後重跑）。涵蓋四系統候選規則與瀏覽器登入流程、預購新增／查詢／取貨日期更新、缺貨新增／查詢、所有角色透過 SDK／REST 刪除拒絕、舊 claim 與殘留授權列不放行；本機工具涵蓋單筆白名單、私人操作者逐專案核准、備份雜湊、並行修改拒絕、刪除前失敗／交易結果不明／已提交但核對失敗等狀態、未決請求禁止重試、備份保留及重複執行拒絕。正式工具與正式系統尚未部署或驗收。
- 第九階段候選規則已封鎖所有用戶端單筆與批次刪除。業主已接受預購／缺貨正式切換初期不提供刪除，因此正式刪除工具、IAM、雙人核准、備份及復原設計不再是本次切換阻擋；它是上線後待獨立批准功能。現有工具只連 Emulator，沒有正式寫入模式，且不得增加正式路徑。員工登入及其他切換 Gate 仍未在正式環境完成。

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
| 商品預購操作人員 | `pre-order-registration` | `preorder/staff`；網頁刪除一律禁止 | 新增、查詢、只修改取貨日期 |
| 預購主管／店長 | 同上，獨立帳號 | `preorder/staff` | 與一般 staff 相同；正式切換初期不提供刪除 |
| 缺貨登記操作人員 | `restocking-list` | `stock/staff`；網頁刪除一律禁止 | 新增、查詢；不可任意更新或刪除 |
| 缺貨主管／店長 | 同上，獨立帳號 | `stock/staff` | 與一般 staff 相同；正式切換初期不提供刪除 |
| HR 管理人員 | `hr-system-ad937` | `hr/manager` | 員工、配額、請假、進修；整份文件刪除拒絕 |

每個專案的 Auth 帳號及 UID 獨立；跨系統員工需在各自專案建帳號。私人表含七列角色範本及十二項實機驗收範本，未填入真實姓名或信箱，未提交 GitHub；員工名單及可用時段尚未提供，未排定個別實機時段。業主仍須私下確認每位正式員工識別、核准 email、所需系統／角色、職責及設計師代碼（如適用）；**尚未建立正式帳號、啟用正式 provider 或核發正式 claims**。預購／缺貨刪除工具操作者欄位不再是本次上線權限需求。

正式 Auth dry-run 計畫已列於 Runbook：Provider 啟用、逐人帳號建立及逐組身份 Claims 分開批准。預購／缺貨的候選刪除工具只允許連 localhost Emulator；正式寫入程式路徑不存在，也不屬本次上線條件。

## 四套系統高權限操作檢查

- 新客 manager 可以讀取全部設計師紀錄並單筆刪除；只核發給明確負責跨設計師管理的人員。設計師仍受資料庫規則限制在本人紀錄。
- 預購與缺貨候選版均維持 `staff`，不接受 `manager` claim。一般員工及主管透過網頁、SDK、REST 均不能刪除；預購 staff 可讀、新增及只修改取貨日期，缺貨 staff 可讀與新增。正式切換初期完全不提供刪除；人工取消、重複、誤登處理使用本機私人登記表及營運交班程序，不修改 Firebase 資料格式。共用讀取範圍與預購顧客聯絡資料可見範圍仍須逐人職務驗收。
- HR `manager` 對整份 `salon/main` 有讀取與更新能力，包含員工、配額、請假、進修、匯入及清空；整份文件刪除遭拒。必須逐人核准其 HR 工作範圍，並確認是否需要整份匯入／清空權限。不能用隱藏前端按鈕作權限控制。

## 仍需人工驗收

- 正式備份仍是 2026-10-20／21 時點；須在核准窗口重做 B1/B2、增量差異與 HR Emulator 還原，並確認所有差異和操作紀錄一致。
- 四專案員工尚無實際登入驗收。私下權限表現在保留 7 個職務範本與 4 個「業主候選試點」列，均未填真實識別／email；試點角色待逐專案核准。私下設備表有 12 個一般測試範本加 4 個逐專案試點列，未排日期、裝置或測試人。
- HR 實機並行、草稿、登出、斷網及強制關閉風險尚未由正式 HR 員工驗收。強制結束可能略過頁面離頁警示並遺失未送出表單。
- 新舊頁交接、Auth Provider、帳號與 Claims 須有值守窗口與分開批准。舊頁無登入，新規則會拒絕舊頁；不可讓舊版匿名頁在候選規則下繼續寫入。
- 預購取消、重複預購、缺貨誤登及重複缺貨四種人工交班情境須於 G7 實機驗收演練；人工登記不含顧客姓名／電話等非必要個資，也不增加資料庫欄位。

## 正式部署阻擋與回復

1. **B1/B2 尚未執行。** 原備份已驗證但不是切換當天快照；Firestore 自管文件遍歷不是託管原子快照，需低寫入窗口與零差異複核。
2. **正式 Auth 與員工驗收未開始。** Provider、帳號、Claims 均未核准／建立；業主候選試點亦未建立帳號。每個專案需分別核准、配置並以真實設備驗收。
3. **G1–G8 尚未簽核或執行。** 尚未批准窗口、規則切換與網站部署；PR #43 維持 Draft。G7 必須驗證預購／缺貨任何客戶端刪除遭拒，並演練人工交班流程；正式刪除工具部署不是本次上線條件。

## 上線前準備與最少待核准事項

1. **逐專案 Auth Provider：**業主逐一核准四套 Firebase 專案是否啟用登入 Provider。
2. **逐人帳號及完整 Claims：**私下提供每位員工識別、核准 email、使用系統、職責、最低角色與設計師代碼（如適用）；逐專案核准帳號建立，取得 UID 後再核准完整 Claims。未確認者不建帳、不授權。
3. **試點與員工實機驗收安排：**確認業主作第一位試點的實際職責／最低角色、員工名單、執行者、見證者、設備及可用時段；使用合成資料完成四系統逐人驗收與預購／缺貨人工流程演練。
4. **維護窗口與 G1–G8 切換授權：**確認日期／臺北時間、員工通知、執行及核對人，並在每個 Gate 前按 Runbook 核准繼續或停止。22:00–22:30 僅為候選時段，尚未排定。

預購／缺貨正式刪除服務是上線後獨立功能，未納入上述上線核准；未來若提出，須另案設計與批准。現有工具只支援 Emulator。

目前未排程窗口、未停寫、未建立正式帳號、未啟用 Provider、未核發 Claims，未改正式規則／資料，未合併或部署。員工與業主候選試點的私人 CSV 只含空白待核准欄位及 `OWNER-PILOT-TBD` 標籤，不含真實信箱或 UID，也未提交 PR。預購／缺貨待刪除與待更正登記表已於本機私人目錄建立空白範本，不含正式紀錄或顧客資料。

回復原則：停止進一步變更，保存錯誤與備份時間線；必要時回到已驗收且與安全 Rules 相容的網站版本。**不可用舊 JSON 覆寫正式 RTDB 根節點或 `salon/main`。**僅對已核實的單筆差異採逐筆修復；若沒有安全相容網站版本，維持停寫並採人工程序，等待修正。詳見 [P0-CUTOVER-RUNBOOK.md](P0-CUTOVER-RUNBOOK.md)。
