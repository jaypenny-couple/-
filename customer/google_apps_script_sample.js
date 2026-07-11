/**
 * ALICE Smart CRM v2 - Google Apps Script 正式範本
 *
 * 使用方式：
 * 1. 建立 Google Sheet
 * 2. 擴充功能 -> Apps Script
 * 3. 貼上此檔案並儲存
 * 4. 回到 Apps Script，執行 setupSheet() 一次並授權
 * 5. 部署 -> 新增部署作業 -> 網頁應用程式
 * 6. 執行身分：自己
 * 7. 存取權：知道連結的任何人
 * 8. 複製 Web App URL，貼到 customer/app.js 的 GOOGLE_APPS_SCRIPT_WEBAPP_URL
 */

const SHEET_NAME = "customers";
const RAW_SHEET_NAME = "raw_submissions";

const HEADERS = [
  "receivedAt",
  "submissionId",
  "source",
  "schemaVersion",
  "createdAt",
  "nameZh",
  "nameEn",
  "birthday",
  "gender",
  "mobile",
  "phoneHome",
  "email",
  "lineId",
  "city",
  "district",
  "address",
  "contactMethods",
  "contactTimes",
  "occupation",
  "sources",
  "referrer",
  "allergyHistory",
  "selfWash",
  "homeCare",
  "favoriteFaceParts",
  "recommendWillingness",
  "hairConcerns",
  "hairConcernOther",
  "hairColorDepth",
  "hairTexture",
  "hairStructure",
  "hairAmount",
  "grayHairPercent",
  "skinTone",
  "eyeColor",
  "styleGoals",
  "improveGoals",
  "avoidance",
  "consentData",
  "consentMarketing",
  "consentPhoto",
  "photoNote",
  "staff",
  "serviceToday",
  "internalNote",
  "rawJson"
];

function setupSheet() {
  const sheet = getSheet_(SHEET_NAME);
  ensureHeaders_(sheet, HEADERS);

  const rawSheet = getSheet_(RAW_SHEET_NAME);
  ensureHeaders_(rawSheet, ["receivedAt", "submissionId", "rawJson"]);

  SpreadsheetApp.getActiveSpreadsheet().toast("ALICE Smart CRM sheets are ready.");
}

function doGet() {
  return json_({
    ok: true,
    service: "ALICE Smart CRM v2",
    message: "Google Apps Script endpoint is ready."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const raw = e?.postData?.contents || "{}";
    const payload = JSON.parse(raw);
    const row = flatten_(payload, raw);

    const sheet = getSheet_(SHEET_NAME);
    ensureHeaders_(sheet, HEADERS);
    appendRowAsText_(sheet, HEADERS, row);

    const rawSheet = getSheet_(RAW_SHEET_NAME);
    ensureHeaders_(rawSheet, ["receivedAt", "submissionId", "rawJson"]);
    appendRowAsText_(rawSheet, ["receivedAt", "submissionId", "rawJson"], {
      receivedAt: row.receivedAt,
      submissionId: row.submissionId,
      rawJson: raw
    });

    return json_({
      ok: true,
      submissionId: row.submissionId,
      receivedAt: row.receivedAt
    });
  } catch (error) {
    return json_({
      ok: false,
      message: error.message
    });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(Boolean);
  const missing = headers.filter((header) => !current.includes(header));

  if (current.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  if (missing.length) {
    const nextColumn = current.length + 1;
    sheet.getRange(1, nextColumn, 1, missing.length).setValues([missing]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length).setNumberFormat("@");
}

function appendRowAsText_(sheet, headers, row) {
  const rowNumber = sheet.getLastRow() + 1;
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  range.setNumberFormat("@");
  range.setValues([headers.map((key) => row[key] ?? "")]);
}

function flatten_(payload, rawJson) {
  const c = payload.customer || {};
  const q = payload.questionnaire || {};
  const h = payload.hair || {};
  const consent = payload.consent || {};
  const internal = payload.internal || {};
  const meta = payload.meta || {};

  return {
    receivedAt: new Date().toISOString(),
    submissionId: meta.submissionId || Utilities.getUuid(),
    source: meta.source || "ALICE Smart CRM v2",
    schemaVersion: meta.schemaVersion || "",
    createdAt: meta.createdAt || "",
    nameZh: c.nameZh || "",
    nameEn: c.nameEn || "",
    birthday: c.birthday || "",
    gender: c.gender || "",
    mobile: c.mobile || "",
    phoneHome: c.phoneHome || "",
    email: c.email || "",
    lineId: c.lineId || "",
    city: c.city || "",
    district: c.district || "",
    address: c.address || "",
    contactMethods: join_(c.contactMethods),
    contactTimes: join_(c.contactTimes),
    occupation: c.occupationOther || c.occupation || "",
    sources: join_(c.sources),
    referrer: c.referrer || "",
    allergyHistory: q.allergyHistory || "",
    selfWash: q.selfWash || "",
    homeCare: q.homeCare || "",
    favoriteFaceParts: join_(q.favoriteFaceParts),
    recommendWillingness: q.recommendWillingness || "",
    hairConcerns: join_(h.concerns),
    hairConcernOther: h.concernOther || "",
    hairColorDepth: h.colorDepth || "",
    hairTexture: h.texture || "",
    hairStructure: h.structure || "",
    hairAmount: h.amount || "",
    grayHairPercent: h.grayHairPercent || "",
    skinTone: h.skinTone || "",
    eyeColor: h.eyeColor || "",
    styleGoals: join_(h.styleGoals),
    improveGoals: join_(h.improveGoals),
    avoidance: h.avoidance || "",
    consentData: consent.data ? "Y" : "N",
    consentMarketing: consent.marketing ? "Y" : "N",
    consentPhoto: consent.photo ? "Y" : "N",
    photoNote: consent.photoNote || "",
    staff: internal.staff || "",
    serviceToday: internal.serviceToday || "",
    internalNote: internal.note || "",
    rawJson: rawJson || JSON.stringify(payload)
  };
}

function join_(value) {
  if (Array.isArray(value)) return value.join("、");
  return value || "";
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 可選：建立 Google 聯絡人
 *
 * 注意：
 * Apps Script 新版建議使用 People API Advanced Service。
 * 若要啟用：
 * 1. Apps Script 左側「服務」-> 加入 People API
 * 2. Google Cloud 專案也需啟用 People API
 */
function createGoogleContact_(payload) {
  const c = payload.customer || {};
  const displayName = c.nameZh || c.nameEn;
  if (!displayName || !c.mobile) return;

  const person = {
    names: [{ displayName: displayName, givenName: displayName }],
    phoneNumbers: [{ value: c.mobile, type: "mobile" }],
    biographies: [{
      value: payload.integrations?.googleContacts?.notes || "",
      contentType: "TEXT_PLAIN"
    }]
  };

  if (c.email) {
    person.emailAddresses = [{ value: c.email, type: "home" }];
  }

  People.People.createContact(person);
}
