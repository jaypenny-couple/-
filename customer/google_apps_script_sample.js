/**
 * ALICE Smart CRM v2 - Google Apps Script 範例
 *
 * 使用方式：
 * 1. 建立 Google Sheet
 * 2. 擴充功能 → Apps Script
 * 3. 貼上此檔案
 * 4. 部署 → 新增部署作業 → 網頁應用程式
 * 5. 執行身分：自己
 * 6. 存取權：知道連結的任何人
 * 7. 複製 Web App URL，貼到 app.js 的 GOOGLE_APPS_SCRIPT_WEBAPP_URL
 */

const SHEET_NAME = "customers";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = getSheet_();

  const row = flatten_(payload);
  const headers = Object.keys(row);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  sheet.appendRow(headers.map(h => row[h] ?? ""));

  // 可選：建立 Google 聯絡人
  // createGoogleContact_(payload);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, createdAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function flatten_(payload) {
  const c = payload.customer || {};
  const q = payload.questionnaire || {};
  const h = payload.hair || {};
  const consent = payload.consent || {};
  const internal = payload.internal || {};
  return {
    createdAt: payload.meta?.createdAt || new Date().toISOString(),
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
    contactMethods: (c.contactMethods || []).join("、"),
    contactTimes: (c.contactTimes || []).join("、"),
    occupation: c.occupationOther || c.occupation || "",
    sources: (c.sources || []).join("、"),
    referrer: c.referrer || "",
    allergyHistory: q.allergyHistory || "",
    selfWash: q.selfWash || "",
    homeCare: q.homeCare || "",
    favoriteFaceParts: (q.favoriteFaceParts || []).join("、"),
    recommendWillingness: q.recommendWillingness || "",
    hairConcerns: (h.concerns || []).join("、"),
    hairConcernOther: h.concernOther || "",
    hairColorDepth: h.colorDepth || "",
    hairTexture: h.texture || "",
    hairStructure: h.structure || "",
    hairAmount: h.amount || "",
    grayHairPercent: h.grayHairPercent || "",
    skinTone: h.skinTone || "",
    eyeColor: h.eyeColor || "",
    styleGoals: (h.styleGoals || []).join("、"),
    improveGoals: (h.improveGoals || []).join("、"),
    avoidance: h.avoidance || "",
    consentData: consent.data ? "Y" : "N",
    consentMarketing: consent.marketing ? "Y" : "N",
    consentPhoto: consent.photo ? "Y" : "N",
    photoNote: consent.photoNote || "",
    staff: internal.staff || "",
    serviceToday: internal.serviceToday || "",
    internalNote: internal.note || ""
  };
}

/**
 * Google 聯絡人建立範例
 * 注意：Apps Script 新版建議使用 People API Advanced Service。
 * 若要啟用：
 * 1. Apps Script 左側「服務」→ 加入 People API
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
