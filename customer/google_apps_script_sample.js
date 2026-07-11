/**
 * ALICE Smart CRM v2 - Google Apps Script sample.
 *
 * Usage:
 * 1. Create or open the target Google Sheet.
 * 2. Open Extensions > Apps Script.
 * 3. Paste this file into the Apps Script editor.
 * 4. If this is a standalone script, set SPREADSHEET_ID below.
 * 5. Run setupSheet() once and authorize the script.
 * 6. Deploy as a Web App and paste the Web App URL into customer/app.js.
 *
 * Optional Google Contacts sync:
 * 1. In Apps Script, open Services and add the People API advanced service.
 * 2. Run setupSheet() again to add contact sync columns.
 * 3. Review rows in the customers sheet.
 * 4. Run importPendingContacts(), or use the ALICE CRM menu in the Sheet.
 */

const SPREADSHEET_ID = "";
const SHEET_NAME = "customers";
const RAW_SHEET_NAME = "raw_submissions";

const CONTACT_SYNC_HEADERS = [
  "contactSyncedAt",
  "contactResourceName",
  "contactSyncStatus"
];

const BASE_HEADERS = [
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

const HEADERS = BASE_HEADERS.concat(CONTACT_SYNC_HEADERS);
const RAW_HEADERS = ["receivedAt", "submissionId", "rawJson"];

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("ALICE CRM")
      .addItem("初始化工作表欄位", "setupSheet")
      .addItem("匯入 Google 聯絡人", "importPendingContacts")
      .addToUi();
  } catch (error) {
    // Standalone Apps Script projects do not have a spreadsheet UI.
  }
}

function setupSheet() {
  const sheet = getSheet_(SHEET_NAME);
  ensureHeaders_(sheet, HEADERS);

  const rawSheet = getSheet_(RAW_SHEET_NAME);
  ensureHeaders_(rawSheet, RAW_HEADERS);

  toast_("ALICE Smart CRM sheets are ready.");
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
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(raw);
    const row = flatten_(payload, raw);

    const sheet = getSheet_(SHEET_NAME);
    ensureHeaders_(sheet, HEADERS);
    appendRowAsText_(sheet, HEADERS, row);

    const rawSheet = getSheet_(RAW_SHEET_NAME);
    ensureHeaders_(rawSheet, RAW_HEADERS);
    appendRowAsText_(rawSheet, RAW_HEADERS, {
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

function importPendingContacts() {
  ensurePeopleApi_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_(SHEET_NAME);
    ensureHeaders_(sheet, HEADERS);

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      const emptyMessage = "沒有可匯入的顧客資料。";
      toast_(emptyMessage);
      return { ok: true, created: 0, skipped: 0, failed: 0, message: emptyMessage };
    }

    const headers = values[0].map(function(header) {
      return String(header || "");
    });
    const headerMap = headerMap_(headers);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 1; index < values.length; index += 1) {
      const rowNumber = index + 1;
      const row = rowObject_(headers, values[index]);

      if (!hasCustomerData_(row)) {
        continue;
      }

      if (clean_(row.contactResourceName) || clean_(row.contactSyncedAt)) {
        skipped += 1;
        continue;
      }

      try {
        const person = buildGoogleContactPerson_(row);
        if (!person) {
          skipped += 1;
          writeSyncResult_(sheet, rowNumber, headerMap, {
            status: "SKIPPED: missing name, phone, or email"
          });
          continue;
        }

        const contact = People.People.createContact(person);
        created += 1;
        writeSyncResult_(sheet, rowNumber, headerMap, {
          syncedAt: new Date().toISOString(),
          resourceName: contact.resourceName || "",
          status: "SYNCED"
        });
      } catch (error) {
        failed += 1;
        writeSyncResult_(sheet, rowNumber, headerMap, {
          status: "ERROR: " + error.message
        });
      }
    }

    const message = "Google 聯絡人匯入完成：新增 " + created + " 筆，略過 " + skipped + " 筆，失敗 " + failed + " 筆。";
    toast_(message);
    return { ok: failed === 0, created: created, skipped: skipped, failed: failed, message: message };
  } finally {
    lock.releaseLock();
  }
}

function buildGoogleContactPerson_(row) {
  const displayName = clean_(row.nameZh) || clean_(row.nameEn);
  const mobile = clean_(row.mobile);
  const phoneHome = clean_(row.phoneHome);
  const email = clean_(row.email);

  if (!displayName || (!mobile && !phoneHome && !email)) {
    return null;
  }

  const person = {
    names: [{
      displayName: displayName,
      givenName: displayName
    }]
  };

  const phoneNumbers = [];
  if (mobile) phoneNumbers.push({ value: mobile, type: "mobile" });
  if (phoneHome) phoneNumbers.push({ value: phoneHome, type: "home" });
  if (phoneNumbers.length) person.phoneNumbers = phoneNumbers;

  if (email) {
    person.emailAddresses = [{ value: email, type: "home" }];
  }

  const address = [clean_(row.city), clean_(row.district), clean_(row.address)].filter(Boolean).join("");
  if (address) {
    person.addresses = [{ formattedValue: address, type: "home" }];
  }

  const birthday = parseBirthday_(row.birthday);
  if (birthday) {
    person.birthdays = [birthday];
  }

  const notes = buildContactNotes_(row);
  if (notes) {
    person.biographies = [{
      value: notes,
      contentType: "TEXT_PLAIN"
    }];
  }

  return person;
}

function buildContactNotes_(row) {
  return [
    "ALICE Smart CRM 顧客資料",
    line_("填表時間", row.createdAt || row.receivedAt),
    line_("LINE ID", row.lineId),
    line_("偏好聯絡方式", row.contactMethods),
    line_("偏好聯絡時段", row.contactTimes),
    line_("職業", row.occupation),
    line_("來源", row.sources),
    line_("介紹人", row.referrer),
    line_("過敏史", row.allergyHistory),
    line_("在家洗髮習慣", row.selfWash),
    line_("居家保養", row.homeCare),
    line_("在意五官", row.favoriteFaceParts),
    line_("推薦意願", row.recommendWillingness),
    line_("頭髮困擾", row.hairConcerns),
    line_("其他困擾", row.hairConcernOther),
    line_("髮色深淺", row.hairColorDepth),
    line_("髮質粗細", row.hairTexture),
    line_("髮流結構", row.hairStructure),
    line_("髮量", row.hairAmount),
    line_("白髮比例", row.grayHairPercent),
    line_("希望改善", row.improveGoals),
    line_("避免事項", row.avoidance),
    line_("服務人員", row.staff),
    line_("今日服務", row.serviceToday),
    line_("內部備註", row.internalNote),
    line_("照片授權", row.consentPhoto === "Y" ? "同意" : row.consentPhoto === "N" ? "不同意" : ""),
    line_("照片備註", row.photoNote)
  ].filter(Boolean).join("\n");
}

function writeSyncResult_(sheet, rowNumber, headerMap, result) {
  setTextCell_(sheet, rowNumber, headerMap.contactSyncedAt, result.syncedAt || "");
  setTextCell_(sheet, rowNumber, headerMap.contactResourceName, result.resourceName || "");
  setTextCell_(sheet, rowNumber, headerMap.contactSyncStatus, result.status || "");
}

function setTextCell_(sheet, rowNumber, zeroBasedColumnIndex, value) {
  if (zeroBasedColumnIndex == null || zeroBasedColumnIndex < 0) return;
  const range = sheet.getRange(rowNumber, zeroBasedColumnIndex + 1);
  range.setNumberFormat("@");
  range.setValue(value);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Missing SPREADSHEET_ID. Set it when using a standalone Apps Script project.");
  }
  return spreadsheet;
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  ensureColumnCapacity_(sheet, headers.length);

  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || "");
  });

  const hasAnyHeader = current.some(Boolean);
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length).setNumberFormat("@");
    return;
  }

  let lastHeaderIndex = -1;
  current.forEach(function(header, index) {
    if (header) lastHeaderIndex = index;
  });

  const missing = headers.filter(function(header) {
    return current.indexOf(header) === -1;
  });

  if (missing.length) {
    const nextColumn = lastHeaderIndex + 2;
    ensureColumnCapacity_(sheet, nextColumn + missing.length - 1);
    sheet.getRange(1, nextColumn, 1, missing.length).setValues([missing]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), sheet.getLastColumn()).setNumberFormat("@");
}

function ensureColumnCapacity_(sheet, columnCount) {
  const maxColumns = sheet.getMaxColumns();
  if (columnCount > maxColumns) {
    sheet.insertColumnsAfter(maxColumns, columnCount - maxColumns);
  }
}

function appendRowAsText_(sheet, headers, row) {
  ensureColumnCapacity_(sheet, headers.length);
  const rowNumber = sheet.getLastRow() + 1;
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  range.setNumberFormat("@");
  range.setValues([headers.map(function(key) {
    return row[key] == null ? "" : String(row[key]);
  })]);
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
    rawJson: rawJson || JSON.stringify(payload),
    contactSyncedAt: "",
    contactResourceName: "",
    contactSyncStatus: ""
  };
}

function headerMap_(headers) {
  return headers.reduce(function(map, header, index) {
    map[header] = index;
    return map;
  }, {});
}

function rowObject_(headers, values) {
  return headers.reduce(function(row, header, index) {
    row[header] = values[index] == null ? "" : String(values[index]);
    return row;
  }, {});
}

function hasCustomerData_(row) {
  return Boolean(clean_(row.nameZh) || clean_(row.nameEn) || clean_(row.mobile) || clean_(row.email));
}

function ensurePeopleApi_() {
  if (typeof People === "undefined" || !People.People || !People.People.createContact) {
    throw new Error("請先在 Apps Script 的「服務」啟用 People API Advanced Service，再重新執行。");
  }
}

function parseBirthday_(birthday) {
  const value = clean_(birthday);
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  return {
    date: {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    }
  };
}

function line_(label, value) {
  const text = clean_(value);
  return text ? label + "：" + text : "";
}

function clean_(value) {
  return value == null ? "" : String(value).trim();
}

function join_(value) {
  if (Array.isArray(value)) return value.join("、");
  return value || "";
}

function toast_(message) {
  try {
    getSpreadsheet_().toast(message);
  } catch (error) {
    // Web App requests do not always have spreadsheet UI access.
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
