# ALICE P0 正式切換演練與最後備份 Runbook

**狀態：僅供 Draft PR #43 審查。這份文件不是正式切換授權。不得依此自行暫停員工、修改正式 Security Rules、合併或部署。四專案 Email/Password Provider 已依獨立授權啟用。**

## Authentication Provider 啟用紀錄（四專案完成）

2026-10-22 依業主逐專案核准執行。每個 Firebase Console 頁面均重核 Project ID 與 Spark 免費方案；新客專案在本次前已啟用，本次重新讀回確認；預購、缺貨及 HR 在執行前顯示 Authentication 初始「開始使用」頁。只啟用這三個專案的 Email/Password，保持 Email Link、匿名及其他登入 Provider 關閉，儲存後重新讀取 Provider 清單並確認「已啟用」。四個結果均成功，Spark 方案維持不變。執行日、設定前後狀態與重新讀回時間存於 `%LOCALAPPDATA%\ALICE-P0-PRIVATE-BACKUPS\AUTH-PROVIDER-CHANGES-20261022`；Console 操作者及精確設定變更時間由 Google Cloud Admin Activity 稽核記錄保留，不放入公開 PR。

| Firebase Project ID | 執行前確認 | 唯一設定 | 重新讀回結果 | 執行結果 |
| --- | --- | --- | --- | --- |
| `new-customer-management-system` | Project ID 正確；Spark；Email/Password 已啟用 | 本次只重新讀取，未改設定 | 已啟用；其他 Provider 未啟用 | 重新讀回驗證成功 |
| `pre-order-registration` | Project ID 正確；Spark；Authentication 初始頁 | 僅啟用 Email/Password | 已啟用；其他 Provider 未啟用 | 成功 |
| `restocking-list` | Project ID 正確；Spark；Authentication 初始頁 | 僅啟用 Email/Password | 已啟用；其他 Provider 未啟用 | 成功 |
| `hr-system-ad937` | Project ID 正確；Spark；Authentication 初始頁 | 僅啟用 Email/Password | 已啟用；其他 Provider 未啟用 | 成功 |

**完成狀態：4/4 已啟用並重新讀回驗證。**無需變更 ADC quota project，沒有建立服務帳戶金鑰、員工帳號或 Claims；沒有變更 IAM、正式資料庫、Rules、網站或計費方案。Auth 使用者數仍未驗證，因本輪沒有讀取 Auth 使用者清單。啟用 Email/Password 不會自動建立員工帳號或修復仍公開的正式 Security Rules；這項操作不代表整體資安修復或切換完成。

**異常處理：**若後續發現 Provider 狀態與本紀錄不符、登入出現影響或需要回復，先停止帳號建立與後續切換，核對 Google Cloud Admin Activity 記錄。只有在未建立帳號且業主另行確認回復時，才可在相同專案將 Email/Password 恢復為設定前狀態並重新讀回；若已存在任何使用者，不得刪帳號，須先評估停用登入的影響並取得業主決定。

**授權界線：**業主已核准並完成的只限四專案 Email/Password Provider 開關。個人帳號建立、Custom Claims 核發、Security Rules 修改、正式資料操作、IAM 變更、PR 合併及網站部署仍需各自授權與 G1–G8 門檻。下一步先由業主補妥私人員工確認資料，再逐專案／逐人核准帳號與完整 Claims，並安排試點及實機驗收。

## 員工帳號與 Claims 建立程序（候選版；正式操作尚未核准）

四個 Provider 已啟用，但目前沒有正式帳號建立或 Claims 核發授權。先在受 ACL 限制的私人目錄補妥每一筆實際員工資料：內部識別、核准個人信箱、Project ID、職責、最低角色、設計師代碼（如適用）、主管理由（如適用）、帳號停用負責人。業主作為試點人員仍是四個 `OWNER-PILOT-TBD`，尚未提供足以識別本人的資料；不得推定其 manager、designer 或 HR 權限。

### 第一核准門檻：逐人逐專案建立帳號

1. 業主在私人 CSV 對明確員工與單一 Project ID 記錄 `OwnerApproval=APPROVED`、`AccountCreationApproval=APPROVED` 及私人 approval reference。任何未明確核准的列不處理。
2. 執行者重新確認 Project ID、Email/Password 已啟用、Spark 方案及管理權限；以該專案核准信箱查詢 Auth，確認不存在重複帳號。已存在或資料不符即停止，不重設他人帳號。
3. 由有權管理該專案 Auth 的可信任管理者建立個人帳號；不共用帳號、不建立服務帳戶私鑰。初始密碼以高熵隨機值只在記憶體中處理，不寫入程式、CSV、終端、Issue 或日誌；建帳後透過 Firebase Auth Email Verification 與 Password Reset 流程，交由員工自行驗證信箱並設定個人密碼。驗證連結／oobCode 視同秘密，只透過業主核准的私下渠道交付，不能放 PR 或一般日誌。
4. 重新由該專案讀取使用者記錄，私下核對 Project ID、核准 email、唯一 UID、`disabled=false`、`emailVerified=true`。只將必要身分證據和時間寫入受限私人稽核記錄。無法核實就停止該人，不核發 Claims。

### 第二核准門檻：逐 UID 核發完整 Custom Claims

1. 帳號建立與信箱驗證完成後，先以 Auth 重新取得正確專案中的 UID 和完整既有 `customClaims`。不得假設 UID 跨專案相同或已完成核對。
2. 由 `buildStaffClaimsPlan` 純函式建立候選差異：含完整 `before`、完整 `after`、移除／新增欄位、回復前態、前後 SHA-256。執行前將受限私人稽核副本寫入本機 ACL 保護目錄並驗證雜湊；絕不保存密碼或驗證 token。業主審核實際 UID、專案、核准信箱、職責理由與完整 Claims 後，另行明確批准該 UID 的 Claims。
3. 候選角色僅依上方矩陣：設計師 `customer/designer` + 經核准的 `aliceDesigner`；新客管理員 `customer/manager`；預購 `preorder/staff`；缺貨 `stock/staff`；HR `hr/manager`。主管角色必須有實際工作理由。沒有核准紀錄、專案／UID 不符、Email 未驗證、帳號停用、Claims 差異異常或權限不足，全部停止。
4. 正式套用工具目前仍停用；不得因 dry-run、既有 ADC 或 Provider 已開啟而套用。未來獲第二次批准後才可啟用經審核的核發操作；寫入後重新讀取完整 claims，核對 SHA-256 與預期一致，再要求該員重新登入／刷新 ID token。若錯誤，使用保存的 `before` 完整 Claims 回復並讀回驗證；若回復不確定，停止切換並保持 G1–G8 No-Go。

### 本輪私人名單稽核與 Emulator 證據

私人 CSV 已先保存原始版本與 SHA-256，再新增空白欄位：`DesignerCode`、`AccountUID`、`EmailVerificationStatus`、`AccountDisableOwner`。其後再次先備份並核對雜湊，為四筆試點加入穩定的 `RecordType=OWNER-PILOT` 標記，並把常用欄位移至前方；原有欄位內容逐列核對保留。ACL 只允許本機使用者與 SYSTEM。另有四列本機輸入表 `OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv` 及說明檔供業主填資料；稽核器只在記憶體中將其與四筆試點列合併供檢查，不寫回、不輸出身分資料。主 CSV 或精簡表單只填一份；其填寫本身不代表任何授權。稽核顯示 4 筆業主 placeholder、7 個職務範本、0 筆實際員工候選、0 封核准信箱、0 個已核對正式 UID；因此目前無法查重，也沒有足夠資訊核准任何試點角色。OWNER 欄位留白不視作批准。

稽核輸出必須分成三類：建帳前必填（內部識別、核准信箱、職責、最低角色、停用負責人、有效專案及條件式設計師代碼／主管理由）；待業主逐人逐專案核准（建立帳號）；以及建帳後才取得（該專案 UID、Email 驗證狀態、實際帳號建立結果）。第三類尚空白時不可判作建帳前資料不合格，但在 Claims 核發與驗收前仍是阻擋。

Auth Emulator 的合成生命週期測試驗證查重、建立、錯誤密碼、Email 驗證、重設密碼、重新登入、停用拒絕、合成專案隔離及清理。Claims 規劃測試驗證逐專案白名單、exact UID/approval 綁定、已驗證信箱、主管理由、完整原 Claims 保存、SHA-256、回復前態及移除舊 `aliceCanDelete`；名單稽核測試驗證輸入表合併、建帳前／後欄位及候選角色。沒有正式 Firebase 呼叫或寫入。本輪完整 `npm test` 為 **36/36 通過、0 失敗、0 跳過**；Emulator 通過不能替代現場員工驗收。

## 角色與人員確認表

四個 Firebase 專案各有獨立 Auth 使用者庫；同一員工若操作兩套系統，需在兩個專案分別有帳號、UID 和 claims。公開 PR 只保留角色設計；正式員工姓名、電子郵件、UID 與在職狀態請保存在私人驗收表。

| 職責 | Firebase 專案 | 必要 claims | 可用資料與操作 | 應拒絕 |
| --- | --- | --- | --- | --- |
| 新客管理員 | `new-customer-management-system` | `aliceApp=customer`, `aliceRole=manager` | 全部 `records/<id>` 新增、查詢、編輯、單筆刪除及設計師切換 | `records` 根節點整批刪除 |
| 設計師 | 同上 | `aliceApp=customer`, `aliceRole=designer`, `aliceDesigner=<核准代碼>` | 僅以 `designer` 條件查詢及操作自己代碼的紀錄 | 全量查詢、他人紀錄及變更紀錄所屬設計師 |
| 預購操作人員 | `pre-order-registration` | `aliceApp=preorder`, `aliceRole=staff` | 查詢、新增、只修改取貨日期 | 刪除、其他欄位修改、manager claim、整批刪除 |
| 預購主管／店長 | 同上，獨立帳號 | `aliceApp=preorder`, `aliceRole=staff` | 與一般 staff 相同；正式切換初期不提供刪除 | 任何網頁／SDK／REST 刪除及根節點刪除 |
| 缺貨登記人員 | `restocking-list` | `aliceApp=stock`, `aliceRole=staff` | 查詢、新增 | 編輯、刪除、manager claim 及整批刪除 |
| 缺貨主管／店長 | 同上，獨立帳號 | `aliceApp=stock`, `aliceRole=staff` | 與一般 staff 相同；正式切換初期不提供刪除 | 任何網頁／SDK／REST 刪除及根節點刪除 |
| HR 管理員 | `hr-system-ad937` | `aliceApp=hr`, `aliceRole=manager` | `salon/main` 讀取、建立、交易式更新；頁內員工／配額／請假／進修操作 | 整份 `salon/main` 文件刪除、其他 Firestore 文件 |

目前候選設計師代碼為 `JAY`、`IRIS`、`SHERRY`、`CINDY`；正式對應人員、在職狀態與可見範圍須由業主確認。每位員工需提供：內部員工編號或私下辨識方式、公司核准電子郵件、要操作的系統、各系統職責、設計師代碼（如適用）、主管核准人及停用／離職流程。不得把這份個人資料提交公開 PR。

正式 Auth 啟用、帳號建立、email 驗證與 claims 核發皆待業主明確確認。私人確認表已在受限本機目錄建立，只有七列職責範本，員工識別資訊留白；管理員角色標示為「預設不核發」，HR manager 僅在業務必要並獲逐人批准後核發。每個專案分開列人、帳號與角色。同一人若跨系統工作，每個專案都必須有獨立批准，不可由一個專案的授權推定其他專案有權。

**業主已核准：預購與缺貨正式安全切換初期完全不提供刪除功能。**所有員工（含主管）均不得透過網頁、SDK 或 REST 刪除；正式刪除工具不是本次上線條件，現有工具只保留 localhost Emulator 能力。任何正式刪除服務均屬上線後獨立功能，須另行設計、審查及取得業主批准。取消、重複或誤登資料依本文件「人工交班流程」處理，不新增 RTDB 欄位或擅改正式資料。

### 業主候選試點（尚未建立帳號或核准角色）

私人員工權限 CSV 已增加四個 `OWNER-PILOT-TBD` 預填列，分別對應四個 Firebase 專案；私人設備驗收 CSV 也增加四個逐專案試點列。它們只標示「建議業主作第一位試點」，不填入真實信箱、UID、裝置或日期，也不推定業主需要 manager 權限。每個專案的角色與 claims 仍為待批准；Email/Password Provider 已啟用，但帳號及 claims 未變更。逐專案測試須在未來逐人批准及帳號建立後，使用該專案授權範圍並依最低角色操作；驗收資料需為明確核准的合成項目，不用真實顧客資料。四專案候選順序為：新客 `customer`（管理員或設計師角色待職務判定）、預購 `preorder/staff`、缺貨 `stock/staff`、HR `hr/manager`（僅確認業主實際承擔 HR 管理職責後）。若角色未核准或業務職責不適用，該專案試點不建立帳號、不進行登入測試。

正式員工資料仍缺：每位員工的內部識別、核准個人 email、所需專案、職責及最低角色；設計師本人代碼；每個 manager 的實際管理理由；逐人帳號建立核准、UID 核對及完整 claims 核准；驗收設備／瀏覽器、可用時段、執行者與監督者。四專案 Provider 已啟用。私人表目前有 7 個既有角色範本加 4 個業主候選列；身份與核准信箱仍空白。CSV 僅存受限本機目錄，不提交 GitHub。預購／缺貨的正式刪除操作者不屬本次上線需求。

## 逐人實機驗收清單（每位員工、每個專案各複製一份）

記錄員工內部識別碼、專案、核准角色、測試裝置／瀏覽器、驗收人、時間及證據位置；身份資料和截圖保存在私人驗收資料，不放 GitHub。每項標「通過／失敗／不適用」並填結果。任何該職務必要操作失敗即該員 No-Go。

| 檢查 | 執行方式與通過條件 | 結果／證據 |
| --- | --- | --- |
| 帳號與登入 | 用核准信箱登入指定專案；錯誤密碼、未核准帳號及錯誤 App／角色必須拒絕；不得在網址或前端自行選角色 | 待填 |
| 權限讀取 | 只看該角色核准的資料；設計師搜尋或讀取其他設計師紀錄必須拒絕，管理員只在核准範圍讀取 | 待填 |
| 新增 | 建立一筆主管批准的合成／驗收紀錄，確認雲端讀回成功且原格式可供舊流程讀取 | 待填 |
| 修改 | 修改該角色可管理的紀錄，重整後仍存在；未授權欄位或他人資料修改必須拒絕 | 待填 |
| 刪除／禁止刪除 | 新客管理員只可在業主批准的指定合成驗收紀錄上測單筆刪除；HR 只驗證頁面原有項目刪除（更新文件陣列），整份 `salon/main` 文件刪除必須拒絕；預購／缺貨所有帳號經網頁、SDK、REST 刪除均須遭拒。正式切換不要求正式刪除工具 | 待填 |
| 跨角色拒絕 | 以其他系統角色／錯誤 claims 登入或直接呼叫受保護操作，資料讀寫均被拒絕 | 待填 |
| 重整／登出 | 重整後登入狀態與資料一致；登出後畫面不可再讀寫，重新登入仍符合核准範圍 | 待填 |
| 網路中斷／恢復 | 離線時資料操作停用並有清楚提示；恢復網路後明確顯示同步狀態，未確認操作不得標示成功 | 待填 |
| 舊頁／新版交接 | 關閉所有舊分頁和快取頁後，以正式網址開新版並登入；舊匿名頁在候選規則下遭拒絕，員工不重複提交最後一筆資料 | 待填 |
| HR 兩裝置衝突 | 兩名 HR 管理員同時修改不同紀錄可保留雙方；修改同一紀錄時明確提示衝突且不得靜默覆寫 | HR 專用 |
| HR 未完成草稿 | 權限拒絕／網路故障時顯示未儲存，提供重試與草稿下載；頁面登出被阻止；外部切換帳號後只允許原帳號恢復草稿 | HR 專用 |
| HR 強制關閉限制 | 先確認沒有 pending write、失敗草稿、未送出表單；說明強制結束可繞過離頁警示，需等雲端讀回確認才關閉 | HR 專用 |

刪除驗收限合成資料或明確標記的測試項目，完成後確認清理的是該測試項，不得以真實顧客／員工資料做未授權測試。正式資料中不建立「測試紀錄」。預購／缺貨 G7 專門驗證刪除被拒絕，不執行任何正式刪除。

### 帳號與 Custom Claims dry-run 計畫（尚未連正式 Auth 執行）

1. 私下填妥每位員工的內部辨識代碼、核准信箱、所需系統、角色、設計師代碼（若適用）、主管與離職停用負責人。manager 必須附具體管理工作；無該工作的員工採 designer/staff，HR 不授予帳號除非核准 HR 管理職責。
2. 業主逐人批准「哪個 Firebase 專案、建立哪個帳號、使用何種登入方式、核發哪些完整 claims」。四個專案的 Email/Password provider 已另行核准並啟用；該核准不建立使用者，也不授權任何個人 claims。
3. 批准後由可信任管理者先建立帳號、驗證信箱，取得該專案 UID；不建立或公開服務帳戶私鑰。用 ADC 對實際 UID 執行 `assign-staff-claim.mjs` 不帶 `--apply` 的 dry run，核對專案、App、角色、信箱驗證狀態與既有 claims。腳本 dry run 只讀 `getUser`，不建立帳號或修改 claims；若帳號不存在、該專案 Provider 讀回未啟用、IAM 不足或 UID 對不上，停止。
4. **目前候選版**已完全禁止預購與缺貨 RTDB 的客戶端刪除。任何 staff、主管、舊 manager、舊 `aliceCanDelete=true` token 或殘留授權列都不能由網頁、SDK 或 REST 刪除資料。舊 `/deletionAuthorizations` 根節點不在候選 Rules 中；快照差異工具若看見該根節點會標示未知並停下人工檢查，不會自動移除。
5. `delete-single-record-local.mjs` 只接受白名單專案與一個紀錄 ID，強制連 localhost RTDB Emulator；程式沒有正式環境 `--apply` 選項。操作者須出現在本機私人 `DELETE-OPERATORS-APPROVAL.json`，以 Windows 身分逐專案列明 `store-manager` 或 `approved-supervisor`、核准人、時間與參考。缺少核准即停止。操作時先讀取紀錄，只顯示路徑、ID 與 SHA-256；操作者須再次輸入完整 ID 及 `DELETE`。完整單筆 JSON 先寫入受限私人備份並讀回驗證，再以 RTDB transaction 比對雜湊後刪除，最後確認該 ID 已不存在且同集合其他資料完全未變。正式資料操作仍被工具硬性封鎖；若未來需正式啟用，必須另經業主批准並設計正式 IAM、權限及復原流程。`assign-staff-claim.mjs` 只管理身份 Claims，刪除 claim 已退役；正式 Claims 套用仍停用。

Emulator 操作範例（在專案 `security/` 目錄執行；工具要求私人核准檔及互動終端，並會再次提示輸入 ID 和 `DELETE`）：

```powershell
$env:FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000'
node delete-single-record-local.mjs --project pre-order-registration --id '<單筆紀錄ID>'
node delete-single-record-local.mjs --project restocking-list --id '<單筆紀錄ID>'
```

私人核准檔使用格式 `alice-local-delete-operators-v1`，每位操作者列 `windowsIdentity`、`role`（`store-manager` 或 `approved-supervisor`）、`projects`、`approvedBy`、`approvedAt`、`approvalRef`。不把實際操作者資料寫入此 Runbook 或 GitHub。

預購與缺貨網頁不顯示刪除按鈕，也不含直接刪除函式。Emulator 測試工具只允許連 localhost，且不能連正式資料庫。正式切換初期維持完全無刪除能力；正式工具不需要存在，本機工具不得新增正式連線或寫入路徑。日後如要提供正式刪除，必須作為上線後獨立功能重新審查並獲明確批准。

仍需業主批准的項目為：逐人帳號及完整 Claims、試點與員工實機驗收安排、維護窗口與 G1–G8 切換授權。四專案 Provider 已啟用。預購／缺貨正式刪除工具不在本次切換授權內，日後若提出須另案批准；本機工具的刪除測試僅限 Emulator。

### 正式單筆刪除的安全設計（僅設計與 Emulator 驗證）

目前 `delete-single-record-local.mjs` 仍然只允許 localhost Emulator，沒有正式資料寫入路徑。未來若業主另行批准，預定採「受控後端核准執行」而非把 Admin SDK 權限交給一般員工：操作員使用個人受管理帳號與 MFA 提出請求，另一位不同人員逐筆核准；請求綁定 Firebase 專案、固定集合、單筆 ID、讀取版本 SHA-256、原因、核准人、短效期限及一次性 request ID。過期、重複、改專案／ID／版本或同一人兼任兩階段，一律拒絕。預購與缺貨分別使用專案服務身分，任何 UI 或呼叫者都不能傳任意資料庫路徑。

服務帳號私鑰不得建立或分發。服務端使用受管工作負載身分，Admin SDK 必須以 `databaseAuthVariableOverride` 受限模式執行，由 Rules 只為專用服務 UID 開放兩個指定集合中的單筆目標刪除；一般 Auth 使用者仍無刪除權。不得使用 Admin SDK 完整管理模式直接繞過 Rules。Firebase 官方說明完整 Admin 權限可不受 Rules 限制，也提供以 `databaseAuthVariableOverride` 透過 Rules 限縮服務讀寫的方式；RTDB Admin IAM 角色則是完整資料庫讀寫能力，因此服務的實際 IAM 與受限模式必須在 Emulator／專用測試專案驗證，無法證明最小權限時不部署。[Admin Database SDK 存取模式](https://firebase.google.com/docs/database/admin/start)；[Realtime Database IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasedatabase)。

建議操作順序：

1. 服務端重新讀取唯一目標並檢查其版本雜湊；把完整單筆資料備份至經核准的加密私人儲存空間，讀回重算 SHA-256；同時保存集合前置狀態摘要。任何備份／讀取失敗都在呼叫刪除前停止。雲端儲存會涉及資源與費用，尚未核准或建立；在目前不升級 Blaze／不新增付費資源的限制下不得部署付費服務。
2. 先持久化稽核狀態 `PREPARED`，再寫入 `DELETE_ATTEMPTING`；後者成功確認以前禁止呼叫 RTDB。以 transaction 僅刪除固定集合中的一筆 ID，交易內比對原始版本雜湊。若交易明確回覆未提交或版本不符，記錄 `DELETE_NOT_EXECUTED`，保留紀錄及備份。
3. 交易確認已提交後記錄 `DELETE_COMMITTED_VERIFY_PENDING`；重新讀取單筆與集合，確認該 ID 不存在、其他紀錄摘要與預期完全相同。完成時寫 `DELETE_VERIFIED`。若提交已確認但讀回／集合核對失敗，記錄 `DELETE_COMMITTED_UNVERIFIED`，明確表示資料已刪除但驗證未完成；若交易連線逾時、回應遺失或程序中斷，記錄 `DELETE_OUTCOME_UNKNOWN`。這兩種狀態都必須封鎖重試，直到人工核對完成。
4. 重試判斷只依服務端稽核狀態與資料比對，不以命令列錯誤或 UI 提示推定「未刪除」。`DELETE_OUTCOME_UNKNOWN`／`DELETE_COMMITTED_UNVERIFIED` 時，另一位核准者先讀回目標及同集合：原版本仍存在且前置摘要一致，才可在新 request ID、重新備份、重新核准後認定可重試；目標不存在且其他紀錄相符，將原請求標記為已刪除並完成驗證，不重送刪除；目標變更、重新出現不同版本、其他集合差異或稽核雜湊錯誤，維持 No-Go 並人工調查，不自動覆蓋或還原。
5. 每筆稽核採追加寫入並附 SHA-256，記錄 request ID、專案、固定路徑、紀錄 ID、發起人／核准人、前後版本摘要、備份位置與雜湊、狀態時間線、執行者、錯誤代碼及核對結果；不將顧客欄位寫入一般日誌。稽核儲存需限制讀寫、保留期與讀取紀錄，必要時另存不可變更稽核副本。
6. 逐筆復原只使用對應 request ID 的私人備份。先驗備份 SHA-256 並確認目標 ID 目前不存在；若 ID 已有任何紀錄，禁止覆寫，交由業主人工比對。以交易確認仍為空後還原單筆、讀回比對完整內容及型別，保留前後稽核；不得以舊根節點 JSON 覆蓋正式資料。

這種受控後端通常需要部署雲端執行環境；Cloud Functions for Firebase 官方要求 Blaze，可能產生服務及儲存費用。[Cloud Functions 計費要求](https://firebase.google.com/docs/functions/faq-and-troubleshooting)。業主已決定本次正式切換初期不提供預購／缺貨刪除，因此不部署此服務、不開正式 IAM／Rules 例外，也不以本機 ADC/Owner 權限操作正式資料。此設計留作上線後待獨立批准功能；候選本機工具只連 Emulator，沒有正式寫入路徑。

Emulator 驗證的刪除結果狀態為 `DELETE_NOT_EXECUTED`、`DELETE_OUTCOME_UNKNOWN`、`DELETE_COMMITTED_UNVERIFIED`、`DELETED_AND_VERIFIED`。寫入刪除前置稽核標記；測試明確拒絕對 unknown／committed-unverified 請求直接重試，並確認目標原版本仍存在才允許建立新的測試請求。這些是模擬和 Emulator 證據，不是正式執行權限或正式系統驗收。

## 人工交班流程（預購／缺貨取消與更正）

待處理登記表位於 `%LOCALAPPDATA%/ALICE-P0-PRIVATE-BACKUPS/EMPLOYEE-ACCESS-ACCEPTANCE/ALICE-P0-PREORDER-STOCK-MANUAL-QUEUE-PRIVATE.csv`。表格只有必要欄位：專案、紀錄 ID、原因、申請人、核對人、處理狀態及時間。不得填入顧客姓名、電話等非必要個資；不得把表格提交 GitHub。狀態採「待核對 → 已核對待處理 → 已人工交班／已結案」，記錄每次交接時間和處理人；Firebase 內不新增狀態欄位。

1. **取消預購：**接到取消要求後，以預購紀錄 ID 登記「取消申請」，第二人核對目標紀錄及要求來源。營運人員在門市／出貨作業清單人工標示暫停取貨或聯絡供應商，不刪除、不改寫 RTDB 紀錄；確認已停止後在私人表記錄交班及結案時間。
2. **重複預購：**兩人比對紀錄 ID、商品／數量／日期等必要工作資訊及原始申請來源，判斷是否重複。保留兩筆原始記錄，不自行刪除或合併；在外部營運清單指定有效訂單，另一筆標記為待人工處理並避免重複下單／取貨。只有在確有必要且獲授權時，使用原有 pickupDate 欄位修改取貨日期，不改其他欄位。
3. **缺貨誤登：**申請人以紀錄 ID 登記誤登原因，由第二人向登記來源或商品負責人核對。營運端暫停依該筆觸發補貨，透過既有盤點／採購交班紀錄註明需忽略，不更新或刪除 RTDB 紀錄。
4. **重複缺貨：**第二人確認重複項目及來源，指定一筆作為營運跟進項；其餘保持原始紀錄並在外部交班表標記重複，避免重複採購。處理結果記入私人登記表，不新增 Firebase 欄位。
5. 若申請人與核對人無法確認、紀錄 ID 對不上、可能影響已下單／已付款／顧客承諾，標記「待主管決策」，暫停相關後續作業並升級店長處理；不得為了清除待辦而改資料。正式切換後需先演練上述四種情境並留存不含顧客個資的證據，才可通過 G7。

## 四套系統高權限操作檢查

- **新客：**設計師只能查詢及操作 `aliceDesigner` 相符的 `records`，不能改紀錄所屬設計師；店長／管理員可看全部設計師紀錄並可單筆刪除。manager 僅在實際跨設計師管理職責獲業主批准後使用。整批根節點刪除遭拒。
- **預購：**staff 可查詢共用清單、新增、只修改取貨日期；Rules 對所有用戶拒絕刪除、破壞性覆寫、必要欄位清空及根節點／多路徑刪除。正式切換初期不提供刪除；取消／重複單以私人待處理表及營運交班程序處理。正式員工全清單及顧客聯絡資料讀取仍須逐人核對職務必要性。
- **缺貨登記：**staff 可讀取共用清單與新增；Rules 對所有用戶拒絕更新、刪除及根節點／多路徑破壞性操作。正式切換初期不提供刪除或編輯；誤登／重複項依私人待處理表及盤點／採購交班程序處理。
- **HR：**只有逐人批准的 `hr/manager` 可讀寫整份 `salon/main`（文件本身不可刪除），因現行資料集中在單一文件，該角色可管理全部員工、配額、請假及進修，也能使用整份匯入／清空功能。這是高影響權限；逐人批准前需確認該人確實負責所有 HR 資料與匯入／清空。若需分開核發還原權限，要先設計伺服器端權限方案，不能以隱藏前端按鈕代替。

第九階段候選版已移除 `/deletionAuthorizations`；舊 `aliceCanDelete` 與 manager claims 不能透過預購／缺貨網頁刪除。任何使用者的 SDK/REST 單筆、批次及根節點刪除均由 Rules 拒絕；受限本機工具只在 Emulator 可執行單筆刪除。所有候選規則、頁面及工具只在本機 Emulator 驗證，未部署。

## 最後備份與增量核對

1. 切換前一天預檢四個資料庫實例、目前生效規則、Spark 用量、Firebase CLI／ADC 可用及私人儲存目錄 ACL。低寫入窗口開始後，先請員工停止四套系統寫入並回報最後操作，再從**正式根路徑**取得 B1 唯讀快照：三套 RTDB 用已驗證的私人 `backup-rtdb-readonly-local.ps1`；HR 用 `firestore-self-backup.mjs inventory`、額度檢查後 `export`。每次 HR 匯出要重新查當日 Console 讀數，保留 20,000 次營運讀取餘量；若 IAM、配額或完整性不符即停。
2. 保存快照的 UTC 時間、專案／實例、規則版本、大小與 SHA-256。不要把 JSON、manifest、詳細差異、憑證或員工資料放入 repo。RTDB JSON 要解析與驗雜湊；HR 要核對完整集合樹及 manifest，並在**本機 localhost Emulator**還原、重新列舉路徑和欄位。若 HR 新出現 collection/subcollection，先檢查備份工具是否涵蓋。
3. 用 `security/compare-snapshots.mjs` 在私人目錄比較基準快照 B0 與最新 B1。RTDB 按 `records`、`reservations`、`stockItems` 單筆 ID 分出新增／修改／刪除。任何不在預期 schema 的根節點（包含歷史 `deletionAuthorizations`）均標為未知，要求人工核對；不得自動刪除。HR 同時比較完整文件路徑、集合路徑及 `salon/main` 四個陣列的每個項目。工具只在終端顯示數量；詳細路徑與雜湊留在私人 change ledger。
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

1. **本機／測試環境：**用 Emulator 合成舊格式資料驗證四頁合法角色的新增、查詢、編輯、必要的應用內刪除流程、登入／登出、重整、斷線／恢復；預購／缺貨用戶端刪除必須一律拒絕。HR 以兩個獨立瀏覽器工作階段測不同列並行合併、同列衝突拒絕、寫入拒絕後提示／重試、待寫入時阻止登出、未送出表單避免被遠端更新清空。匿名、錯誤角色、跨設計師與 HR 整份文件刪除必須拒絕。
2. **舊／新版交接：**目前正式舊頁沒有 Auth；候選新規則生效後，舊分頁會被拒絕。正式切換前須通知員工完成舊頁操作、確認 B2 已涵蓋、關閉舊分頁，再以新版登入。GitHub Pages 快取及開啟中的舊分頁須在現場逐台確認。不得把 Emulator 結果宣稱為正式員工驗收。
3. **上線前門檻：**四套新的私人快照與正式規則快照的 SHA-256 均通過；B0→B1 每筆新增／修改／刪除均與營運紀錄核對；B1→B2 必須零差異；HR B1、B2 均在 Emulator 還原及內容核對成功；所有相關舊分頁、瀏覽器快取與裝置均由員工逐一關閉並記錄；實際員工帳號與 claims 核對，逐人必要操作通過；HR 沒有 pending write、失敗草稿或未送出表單；業主簽核窗口與 Go。任一項缺證據則 No-Go，不以「解釋了差異」代替 B1→B2 零差異。
4. **正式切換順序：**Email/Password Provider 已在四專案啟用；完成逐人帳號與完整 Claims 的業主批准及配置，再排定 G1–G8 窗口與人員；依序執行 G1 停寫、G2 B1、G3 差異核對與 B2 零差異、G4 關閉舊頁與裝置、G5 安全 Rules、G6 網站切換、G7 逐人實機登入與操作、G8 B3 增量核對。每個 Gate 都需當場記錄業主 Go、執行者、獨立核對者、時間與證據；不滿足停止條件即停在當前 Gate，不繼續。
5. **正式切換 Gate 明細：**

   | Gate | 執行者 | 必要證據 | 停止條件 | 安全回復 |
   | --- | --- | --- | --- | --- |
   | G1 停寫 | 切換負責人通知；每位員工回報最後操作；系統管理員記錄 | 窗口日期／時區、四系統逐人最後操作時間與未完成草稿確認、停止寫入回報 | 任一人仍操作、離線裝置未盤點、HR pending write／表單未送出、窗口未經業主核准 | 取消或延長窗口；不變更正式系統。恢復正常寫入前由員工核對最後操作 |
   | G2 B1 | 備份操作員；另一位核對者 | 四套 B1 JSON／Firestore 完整樹 manifest、規則快照、UTC 時間、大小與 SHA-256；HR Emulator 還原及內容核對 | 匯出不完整、雜湊不符、HR 樹不一致、讀取額度無法確認或備份目錄 ACL 不符 | 停止；保留正式服務，修復備份程序後重做 B1；不得以部分備份繼續 |
   | G3 差異與 B2 | 資料核對者；營運主管逐筆確認差異 | B0→B1 新增／修改／刪除逐筆對照營運紀錄；停寫後 B2；四套 B1→B2 零差異；HR B2 還原及核對 | 未知根節點、未核准刪除、數量或雜湊不符、B1→B2 非零或未解釋差異 | 不切換；保留所有快照，查明變動來源後重新取得 B1/B2。不得回寫舊備份 |
   | G4 舊頁與裝置關閉 | 每位員工；主管彙總 | 每人／裝置／瀏覽器核對已讀回最後操作、無待送出資料、舊分頁及快取頁已關閉的簽記 | 無法確認最後一次寫入、仍有開啟舊頁或離線設備、員工未完成簽認 | 延後 G5；讓員工回到已確認版本完成操作，再重做 B1/B2 |
   | G5 Rules | Firebase 管理操作員執行；另一位規則審查者核對；業主另行批准 | 明確業主批准、候選 Rules commit/hash、預部署 Emulator 證據、正式規則前快照、執行與生效時間、匿名舊頁拒絕檢查 | 批准缺失、目標專案錯誤、部署內容與核准 hash 不一致、員工未停寫 | 停止後續步驟；只可依業主預先核准的回復計畫回到已審查且安全相容的 Rules；不可回到公開舊規則作常態方案 |
   | G6 網站切換 | GitHub 維護者執行；業主批准 merge/deploy；現場驗收者 | 已核准 PR/head SHA、正式部署記錄、網址版本確認、主要瀏覽器快取更新證據 | PR 未批准、head SHA 改變、部署失敗、網址仍是舊版、Auth 尚未 ready | 維持停寫並排除部署問題；若回復網站，只回到與目前安全 Rules 相容的版本，不放員工回未登入舊頁 |
   | G7 員工登入與功能驗收 | Auth 管理員處理帳號／claims；業主逐人批准；每位員工本人及驗收者共同測試 | Provider 與每帳號逐項批准、UID／claims 對照、逐人實機 CSV；四系統必要讀取／新增／修改及跨角色拒絕；預購／缺貨新增與查詢正常、預購取貨日期可修改；所有帳號透過網頁／SDK／REST 刪除均遭拒；取消預購、重複預購、缺貨誤登及重複缺貨人工流程完成演練；重整／登出／斷線恢復證據 | 任何帳號／claims 不一致、員工被拒絕必要操作、越權成功、任何預購／缺貨刪除成功、人工處理流程未演練、HR 草稿未確認；本次不要求正式刪除工具部署 | 停止新操作並保留資料與日誌；待辦移交店長／主管人工處理；依逐筆差異核對，不恢復公開舊規則、不用舊備份覆寫 |
   | G8 B3 | 備份操作員；營運主管與另一位核對者 | 四套 B3、規則快照、manifest／大小／SHA-256；B2→B3 每筆差異對照已批准操作，確認無遺漏 | 任何未知變更、非預期刪除、差異不能對上或 B3 不完整 | 暫停後續寫入／變更，封存 B2/B3；依證據逐筆修復或補回，不做根節點整庫覆寫 |

   **逐項 Go 核准記錄：**只有填入執行者、獨立核對者、業主批准時間與私人證據位置後，該 Gate 才算完成；目前全部未執行、未簽核。

   | Gate | 業主核准 | 執行者／核對者 | 時間（臺北） | 私人證據位置 | 結果 |
   | --- | --- | --- | --- | --- | --- |
   | G1 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G2 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G3 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G4 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G5 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G6 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G7 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |
   | G8 | 待簽 | 待指定 | 未排定 | 待填 | 未執行 |

   G5 與 G6 會造成短暫服務等待風險：候選規則生效後，仍載入舊版頁面的使用者會被拒絕；網站部署或快取更新需要時間。G7 才開始逐人新版登入驗收。低寫入窗口須包含這段等待，若業主不接受則 No-Go，不能提前套用規則或讓新舊版本並行寫入。預購／缺貨在切換初期維持無刪除功能；四種人工交班案例均須於 G7 演練。

5. 上述 G1–G8 全部完成前，不得標示正式切換完成。正式資料、規則、Auth、網站及員工裝置驗收均未在本 PR 執行。

## 異常與安全回復

- 任何備份、雜湊、差異、員工登入或 HR 寫入確認失敗：停止切換，不改正式資料；保留錯誤時間、版本與私人快照。若已切換，先停止進一步部署，讓員工以受控的離線工作紀錄保留新操作，待核對後逐筆補入。
- 瀏覽器一般離頁會顯示警示；HR 操作和表單會在帳號切換時保留在原頁並阻止其他帳號進入。但作業系統強制結束、瀏覽器 crash 或裝置斷電可跳過 `beforeunload`，尚未確認的記憶體操作與未送出欄位可能遺失。員工必須等雲端讀回確認後再關頁；如遇離線或寫入失敗，先使用頁面「下載未儲存草稿」並由主管核對。該限制須在正式 HR 實機驗收中確認，未完成不得 Go。
- 不直接恢復公開舊規則作為長期方案；舊頁在安全規則下不能正常使用。優先回到上一個已驗收、與安全規則相容的 Auth 版本。若沒有可用版本，暫採人工流程並修復候選版本；任何極短應急規則回退也須業主另行確認暴露風險。
- 不用舊 JSON 覆寫 RTDB 根節點或 `salon/main`。若需補資料，先比較 B2、B3 與離線工作紀錄，只對確認缺失的項目逐筆恢復，再重新備份、雜湊與核對。

## 業主試點帳號建立：2026-10-22 執行前檢查結果

- 業主已批准私人核准清單內四個專案的單一業主試點帳號，Claims 不在授權範圍。執行前私人名單稽核通過 4/4，核准狀態記入受限本機 CSV；CSV 修改前備份及 SHA-256 驗證完成。
- 四個專案的 Auth 管理 API 唯讀查詢均因 `identitytoolkit.googleapis.com` 回覆 HTTP 403 `PERMISSION_DENIED`、`SERVICE_DISABLED` 而停止；錯誤所指 quota consumer 專案與四個目標專案不符。Firebase CLI 雖能列出目標專案，仍不能據此證明 Auth 管理權限。Google Cloud CLI 本機沒有作用中的帳號，因此計費狀態、Provider 現況、帳號是否已存在及逐專案管理權限均未確認。
- **不得在此阻擋未解除時建立帳號或重試寫入。** 由授權管理員在本機恢復正確 Google Cloud CLI／ADC 身分，核對 ADC quota project 指向與服務使用權限；逐專案確認 `identitytoolkit.googleapis.com` 可由目標 Firebase 專案正常呼叫、Spark 計費狀態與 Email/Password Provider 狀態，再用唯讀方式查重及核對核准信箱。若需啟用 API、改 quota project 或任何可能影響計費／正式設定的操作，先確認其範圍及業主授權，禁止用其他專案的配額設定來繞過拒絕。
- 此次正式帳號建立為 0；沒有執行帳號查重，故不能推定目標信箱尚無帳號。沒有建立、覆寫、停用或刪除帳號；UID、Email 驗證及啟用狀態均未讀取。沒有核發 Claims 或修改 Rules、資料、IAM、計費、PR 合併及網站部署。
- 阻擋解除後，按本 Runbook 原有逐專案流程重新核對私密核准列與 Project ID、Provider、Spark、實際帳號是否存在及權限；若帳號已存在或身份不符，停止該列，不覆寫。新建帳號須由業主本人完成密碼設定及 Email 驗證，再讀回 UID、`emailVerified` 與 `disabled` 狀態並保存私人稽核。四筆全數完成後，另提出逐 UID 完整 Claims 差異及復原計畫申請；本次帳號核准不包含 Claims。

## Auth 403 診斷與 Console 業主操作（2026-10-23）

- **根因：**本機 ADC 為 `authorized_user` 且沒有 `quota_project_id`。`gcloud auth list` 成功但沒有 active CLI 身分；ADC 可取短效權杖，兩種登入不可混為一談。403 的 `consumer` 對應 ADC OAuth 用戶端專案，並非四個目標 Firebase 專案。四個目標的 Cloud Console API 詳細頁均顯示 Identity Toolkit API 已啟用；不得為了解決此錯誤而啟用錯誤 consumer 上的 API。
- Console 唯讀檢查已逐一確認四個目標 Project ID、Spark 方案、Email/Password 已啟用、Users 表格可讀且資料列 0 筆；四個「新增使用者」入口均能開啟表單。表單要求 Email 及密碼，尚未提交，故實際寫入權限尚未驗證。無需升級 Blaze 或修改正式 API、IAM、Rules、資料。
- **業主需在本機 Console 完成帳號建立：**從 Firebase Console 專案選擇器逐一選 `new-customer-management-system`、`pre-order-registration`、`restocking-list`、`hr-system-ad937`；確認頁首 Project ID。進入 Authentication → Users，確認清單仍為空；按「新增使用者」，從私人核准 CSV 取得該專案核准 Email，在密碼管理工具產生唯一強密碼並直接輸入 Console，最後按「新增使用者」。不得將密碼複製到 CSV、聊天、終端或 GitHub；任何頁面顯示既有帳號、身分不符、計費提示或權限錯誤時，停止該專案，不覆寫或重試。Firebase Console 頁面已留在第一個專案 Users 頁。
- 建立後由業主本人使用官方 Email/Password 流程設定或確認密碼並完成驗證；不可人工將 `emailVerified` 設為 true。完成後通知維護者進行唯讀 UID、Email 驗證與 `disabled` 狀態核對，結果只存私人目錄。未驗證前狀態記為「已建立／待驗證」。Claims 尚未核准；四筆 UID 與 Email 驗證均核對完成後，另提出逐 UID Claims 差異、完整前態備份與回復計畫供業主批准。
- 若要重新使用 Admin SDK，必須先另行取得設定本機 ADC quota project 的明確核准；選定前確認 quota 專案、`serviceusage.services.use` 權限及不會啟用付費服務。此次未修改 ADC quota project。
