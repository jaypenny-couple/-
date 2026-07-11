// ALICE Smart CRM v2
// 修改 GOOGLE_APPS_SCRIPT_WEBAPP_URL 後，可直接送資料到 Google Sheet。
// 建議先不要公開含權限的 URL；正式部署前由 Codex / Apps Script 完成後端驗證。

const GOOGLE_APPS_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzyBymnUFBS_dNT9SaQZYfM2vl6vDxPx-LWhJqFVAQh-WQi40euCklFhcpsdDfkf9SEhQ/exec";
const ADMIN_MODE = new URLSearchParams(window.location.search).get("admin") === "1";

const state = {
  currentStep: 1,
  totalSteps: 7,
  latestPayload: null,
  latestSubmissionSent: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const form = $("#customerForm");
const home = $("#home");
const resultPanel = $("#resultPanel");
const jsonOutput = $("#jsonOutput");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const resultStatus = $("#resultStatus");

document.body.classList.toggle("admin-mode", ADMIN_MODE);

function startForm() {
  home.classList.add("hidden");
  form.classList.remove("hidden");
  resultPanel.classList.add("hidden");
  state.currentStep = 1;
  updateStepUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateStepUI() {
  $$(".step").forEach(step => {
    step.classList.toggle("active", Number(step.dataset.step) === state.currentStep);
  });

  const active = $(`.step[data-step="${state.currentStep}"]`);
  const title = active?.dataset.title || "";
  $("#stepLabel").textContent = `Step ${state.currentStep} / ${state.totalSteps}`;
  $("#progressText").textContent = title;
  $("#progressBar").style.width = `${(state.currentStep / state.totalSteps) * 100}%`;

  $('[data-action="prev"]').classList.toggle("hidden", state.currentStep === 1);
  $('[data-action="next"]').classList.toggle("hidden", state.currentStep === state.totalSteps);
  $('[data-action="submit"]').classList.toggle("hidden", state.currentStep !== state.totalSteps);
}

function getFieldValue(name) {
  const elements = $$(`[name="${CSS.escape(name)}"]`);
  if (!elements.length) return "";

  const first = elements[0];
  if (first.type === "checkbox") {
    return elements.filter(el => el.checked).map(el => el.value || true);
  }
  if (first.type === "radio") {
    return elements.find(el => el.checked)?.value || "";
  }
  if (first.type === "checkbox" && elements.length === 1) {
    return first.checked;
  }
  return first.value?.trim?.() ?? first.value;
}

function getSingleCheckbox(name) {
  const el = $(`[name="${CSS.escape(name)}"]`);
  return Boolean(el?.checked);
}

function collectFormData() {
  const timestamp = new Date().toISOString();

  const payload = {
    meta: {
      source: "ALICE Smart CRM v2",
      createdAt: timestamp,
      submissionId: createSubmissionId(),
      schemaVersion: "2.0.0"
    },
    customer: {
      nameZh: getFieldValue("nameZh"),
      nameEn: getFieldValue("nameEn"),
      birthday: getFieldValue("birthday"),
      gender: getFieldValue("gender"),
      mobile: getFieldValue("mobile"),
      phoneHome: getFieldValue("phoneHome"),
      email: getFieldValue("email"),
      lineId: getFieldValue("lineId"),
      city: getFieldValue("city"),
      district: getFieldValue("district"),
      address: getFieldValue("address"),
      contactMethods: getFieldValue("contactMethods"),
      contactTimes: getFieldValue("contactTimes"),
      occupation: getFieldValue("occupation"),
      occupationOther: getFieldValue("occupationOther"),
      sources: getFieldValue("sources"),
      referrer: getFieldValue("referrer")
    },
    questionnaire: {
      allergyHistory: getFieldValue("allergyHistory"),
      selfWash: getFieldValue("selfWash"),
      homeCare: getFieldValue("homeCare"),
      favoriteFaceParts: getFieldValue("favoriteFaceParts"),
      recommendWillingness: getFieldValue("recommendWillingness")
    },
    hair: {
      concerns: getFieldValue("hairConcerns"),
      concernOther: getFieldValue("hairConcernOther"),
      colorDepth: getFieldValue("hairColorDepth"),
      texture: getFieldValue("hairTexture"),
      structure: getFieldValue("hairStructure"),
      amount: getFieldValue("hairAmount"),
      grayHairPercent: getFieldValue("grayHairPercent"),
      skinTone: getFieldValue("skinTone"),
      eyeColor: getFieldValue("eyeColor"),
      styleGoals: getFieldValue("styleGoals"),
      improveGoals: getFieldValue("improveGoals"),
      avoidance: getFieldValue("avoidance")
    },
    consent: {
      data: getSingleCheckbox("consentData"),
      marketing: getSingleCheckbox("consentMarketing"),
      photo: getSingleCheckbox("consentPhoto"),
      photoNote: getFieldValue("photoConsentNote")
    },
    internal: {
      staff: getFieldValue("staff"),
      serviceToday: getFieldValue("serviceToday"),
      note: getFieldValue("internalNote")
    },
    integrations: {
      googleContacts: {
        displayName: getFieldValue("nameZh") || getFieldValue("nameEn"),
        phoneNumbers: [getFieldValue("mobile"), getFieldValue("phoneHome")].filter(Boolean),
        emailAddresses: [getFieldValue("email")].filter(Boolean),
        birthday: getFieldValue("birthday"),
        notes: buildContactNote()
      },
      qianjunEHair: buildQianjunMapping()
    }
  };

  return payload;
}

function createSubmissionId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `alice-${timePart}-${randomPart}`;
}

function buildContactNote() {
  const items = [
    `LINE ID：${getFieldValue("lineId") || ""}`,
    `來源：${(getFieldValue("sources") || []).join("、")}`,
    `介紹人：${getFieldValue("referrer") || ""}`,
    `頭髮困擾：${(getFieldValue("hairConcerns") || []).join("、")}`,
    `風格偏好：${(getFieldValue("styleGoals") || []).join("、")}`,
    `照片授權：${getSingleCheckbox("consentPhoto") ? "同意" : "未同意"}`,
    `內部備註：${getFieldValue("internalNote") || ""}`
  ];
  return items.join("\n");
}

function buildQianjunMapping() {
  // 這裡是「預備欄位對應」。實際欄位名稱需依千軍 E 髮匯入格式調整。
  return {
    顧客姓名: getFieldValue("nameZh"),
    英文姓名: getFieldValue("nameEn"),
    手機: getFieldValue("mobile"),
    市話: getFieldValue("phoneHome"),
    生日: getFieldValue("birthday"),
    性別: getFieldValue("gender"),
    Email: getFieldValue("email"),
    LineID: getFieldValue("lineId"),
    地址: [getFieldValue("city"), getFieldValue("district"), getFieldValue("address")].filter(Boolean).join(" "),
    職業: getFieldValue("occupationOther") || getFieldValue("occupation"),
    來源: (getFieldValue("sources") || []).join("、"),
    介紹人: getFieldValue("referrer"),
    髮況備註: [
      `困擾：${(getFieldValue("hairConcerns") || []).join("、")}`,
      `其他：${getFieldValue("hairConcernOther") || ""}`,
      `髮色：${getFieldValue("hairColorDepth") || ""}`,
      `粗細：${getFieldValue("hairTexture") || ""}`,
      `結構：${getFieldValue("hairStructure") || ""}`,
      `髮量：${getFieldValue("hairAmount") || ""}`,
      `白髮比例：${getFieldValue("grayHairPercent") || ""}%`,
      `風格：${(getFieldValue("styleGoals") || []).join("、")}`,
      `希望改善：${(getFieldValue("improveGoals") || []).join("、")}`,
      `避免：${getFieldValue("avoidance") || ""}`
    ].join("\n"),
    照片授權: getSingleCheckbox("consentPhoto") ? "同意" : "未同意",
    行銷通知: getSingleCheckbox("consentMarketing") ? "同意" : "未同意",
    服務人員: getFieldValue("staff"),
    今日服務: getFieldValue("serviceToday"),
    備註: getFieldValue("internalNote")
  };
}

function validateStep() {
  const active = $(`.step[data-step="${state.currentStep}"]`);
  const required = Array.from(active.querySelectorAll("[required]"));
  let valid = true;

  active.querySelectorAll(".error").forEach(e => e.remove());

  for (const input of required) {
    let fieldValid = true;
    if (input.type === "checkbox") fieldValid = input.checked;
    else fieldValid = Boolean(input.value && input.value.trim());

    if (!fieldValid) {
      valid = false;
      const error = document.createElement("div");
      error.className = "error";
      error.textContent = "這是必要欄位。";
      input.closest("label")?.appendChild(error);
    }
  }

  if (!valid) {
    active.querySelector(".error")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return valid;
}

function nextStep() {
  if (!validateStep()) return;
  if (state.currentStep < state.totalSteps) {
    state.currentStep++;
    updateStepUI();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function prevStep() {
  if (state.currentStep > 1) {
    state.currentStep--;
    updateStepUI();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function saveDraft() {
  const payload = collectFormData();
  localStorage.setItem("aliceSmartCrmDraft", JSON.stringify(payload));
  alert("已暫存於此裝置。");
}

function loadDraft() {
  const raw = localStorage.getItem("aliceSmartCrmDraft");
  if (!raw) {
    alert("目前沒有暫存資料。");
    return;
  }
  const payload = JSON.parse(raw);
  fillFormFromPayload(payload);
  startForm();
  alert("已載入暫存資料。");
}

function fillValue(name, value) {
  const elements = $$(`[name="${CSS.escape(name)}"]`);
  if (!elements.length) return;

  const first = elements[0];
  if (first.type === "checkbox") {
    const values = Array.isArray(value) ? value : [value];
    elements.forEach(el => {
      el.checked = values.includes(el.value) || value === true;
    });
  } else if (first.type === "radio") {
    elements.forEach(el => el.checked = el.value === value);
  } else {
    first.value = value || "";
  }
}

function fillFormFromPayload(payload) {
  const c = payload.customer || {};
  const q = payload.questionnaire || {};
  const h = payload.hair || {};
  const consent = payload.consent || {};
  const internal = payload.internal || {};

  Object.entries({
    nameZh:c.nameZh, nameEn:c.nameEn, birthday:c.birthday, gender:c.gender,
    mobile:c.mobile, phoneHome:c.phoneHome, email:c.email, lineId:c.lineId,
    city:c.city, district:c.district, address:c.address,
    contactMethods:c.contactMethods, contactTimes:c.contactTimes,
    occupation:c.occupation, occupationOther:c.occupationOther, sources:c.sources, referrer:c.referrer,
    allergyHistory:q.allergyHistory, selfWash:q.selfWash, homeCare:q.homeCare,
    favoriteFaceParts:q.favoriteFaceParts, recommendWillingness:q.recommendWillingness,
    hairConcerns:h.concerns, hairConcernOther:h.concernOther, hairColorDepth:h.colorDepth,
    hairTexture:h.texture, hairStructure:h.structure, hairAmount:h.amount,
    grayHairPercent:h.grayHairPercent, skinTone:h.skinTone, eyeColor:h.eyeColor,
    styleGoals:h.styleGoals, improveGoals:h.improveGoals, avoidance:h.avoidance,
    consentData:consent.data, consentMarketing:consent.marketing, consentPhoto:consent.photo,
    photoConsentNote:consent.photoNote, staff:internal.staff, serviceToday:internal.serviceToday, internalNote:internal.note
  }).forEach(([name, value]) => fillValue(name, value));
}

function flattenForCsv(payload) {
  const q = payload.questionnaire;
  const c = payload.customer;
  const h = payload.hair;
  const consent = payload.consent;
  const internal = payload.internal;
  return {
    createdAt: payload.meta.createdAt,
    nameZh: c.nameZh,
    nameEn: c.nameEn,
    birthday: c.birthday,
    gender: c.gender,
    mobile: c.mobile,
    phoneHome: c.phoneHome,
    email: c.email,
    lineId: c.lineId,
    city: c.city,
    district: c.district,
    address: c.address,
    contactMethods: (c.contactMethods || []).join("、"),
    contactTimes: (c.contactTimes || []).join("、"),
    occupation: c.occupationOther || c.occupation,
    sources: (c.sources || []).join("、"),
    referrer: c.referrer,
    allergyHistory: q.allergyHistory,
    selfWash: q.selfWash,
    homeCare: q.homeCare,
    favoriteFaceParts: (q.favoriteFaceParts || []).join("、"),
    recommendWillingness: q.recommendWillingness,
    hairConcerns: (h.concerns || []).join("、"),
    hairConcernOther: h.concernOther,
    hairColorDepth: h.colorDepth,
    hairTexture: h.texture,
    hairStructure: h.structure,
    hairAmount: h.amount,
    grayHairPercent: h.grayHairPercent,
    skinTone: h.skinTone,
    eyeColor: h.eyeColor,
    styleGoals: (h.styleGoals || []).join("、"),
    improveGoals: (h.improveGoals || []).join("、"),
    avoidance: h.avoidance,
    consentData: consent.data ? "Y" : "N",
    consentMarketing: consent.marketing ? "Y" : "N",
    consentPhoto: consent.photo ? "Y" : "N",
    photoNote: consent.photoNote,
    staff: internal.staff,
    serviceToday: internal.serviceToday,
    internalNote: internal.note
  };
}

function toCsv(row) {
  const headers = Object.keys(row);
  const escape = (value) => {
    const str = String(value ?? "");
    return `"${str.replaceAll('"', '""')}"`;
  };
  return headers.join(",") + "\n" + headers.map(h => escape(row[h])).join(",");
}

function download(filename, content, type="text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function fileSafeName(payload, ext) {
  const name = payload.customer.nameZh || "customer";
  const date = new Date().toISOString().slice(0,10);
  return `ALICE_${name}_${date}.${ext}`;
}

async function submitForm(event) {
  event.preventDefault();
  if (!validateStep()) return;

  const payload = collectFormData();
  state.latestPayload = payload;
  state.latestSubmissionSent = false;
  localStorage.removeItem("aliceSmartCrmDraft");

  if (ADMIN_MODE) {
    localStorage.setItem("aliceSmartCrmLatest", JSON.stringify(payload));
  } else {
    localStorage.removeItem("aliceSmartCrmLatest");
  }

  form.classList.add("hidden");
  resultPanel.classList.remove("hidden");
  renderResult();
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (GOOGLE_APPS_SCRIPT_WEBAPP_URL) {
    await sendWebhook({ silent: !ADMIN_MODE });
  } else if (ADMIN_MODE) {
    resultStatus.textContent = "目前尚未設定 Google Apps Script Web App URL，資料尚未送到 Google Sheet。";
  } else {
    resultStatus.textContent = "請將此完成畫面交給現場人員確認。";
  }
}

function renderResult() {
  if (ADMIN_MODE) {
    resultTitle.textContent = "資料已整理完成";
    resultMessage.textContent = "內部測試模式已啟用，可複製 JSON、下載 CSV / JSON，或測試送到 Google Sheet。";
    jsonOutput.textContent = JSON.stringify(state.latestPayload, null, 2);
    return;
  }

  resultTitle.textContent = "填寫已完成";
  resultMessage.textContent = "謝謝你完成資料填寫，請將此畫面交給現場人員確認。";
  jsonOutput.textContent = "";
}

async function copyJson() {
  if (!state.latestPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(state.latestPayload, null, 2));
  alert("已複製 JSON。");
}

async function sendWebhook(options = {}) {
  const { silent = false } = options;
  if (!state.latestPayload) return;
  if (state.latestSubmissionSent) {
    resultStatus.textContent = "資料已送出，請勿重複送出。";
    if (!silent) alert("資料已送出，請勿重複送出。");
    return;
  }
  if (!GOOGLE_APPS_SCRIPT_WEBAPP_URL) {
    resultStatus.textContent = "目前尚未設定 Google Apps Script Web App URL。";
    if (!silent) alert("尚未設定 Google Apps Script Web App URL。請先在 app.js 填入 GOOGLE_APPS_SCRIPT_WEBAPP_URL。");
    return;
  }

  try {
    await fetch(GOOGLE_APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(state.latestPayload)
    });
    state.latestSubmissionSent = true;
    resultStatus.textContent = "資料已送出。";
    if (!silent) alert("已送出到 Google Sheet。若使用 no-cors，前端無法讀取詳細回應，請到 Sheet 確認。");
  } catch (error) {
    resultStatus.textContent = "資料暫時無法送出，請告知現場人員協助確認。";
    if (!silent) alert(`送出失敗：${error.message}`);
  }
}

function newForm() {
  form.reset();
  localStorage.removeItem("aliceSmartCrmDraft");
  resultPanel.classList.add("hidden");
  home.classList.remove("hidden");
  state.latestPayload = null;
  state.latestSubmissionSent = false;
  jsonOutput.textContent = "";
  resultStatus.textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const action = event.target?.dataset?.action;
  if (!action) return;

  const adminActions = new Set(["load-draft", "save-draft", "copy-json", "download-json", "download-csv", "send-webhook"]);
  if (adminActions.has(action) && !ADMIN_MODE) return;

  const actions = {
    start: startForm,
    "load-draft": loadDraft,
    next: nextStep,
    prev: prevStep,
    "save-draft": saveDraft,
    "copy-json": copyJson,
    "download-json": () => download(fileSafeName(state.latestPayload, "json"), JSON.stringify(state.latestPayload, null, 2), "application/json;charset=utf-8"),
    "download-csv": () => download(fileSafeName(state.latestPayload, "csv"), toCsv(flattenForCsv(state.latestPayload)), "text/csv;charset=utf-8"),
    "send-webhook": sendWebhook,
    "new-form": newForm
  };

  actions[action]?.();
});

form.addEventListener("submit", submitForm);

async function cleanupCustomerCache() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter(registration => registration.scope.includes("/customer/"))
        .map(registration => registration.unregister())
    );
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith("alice-smart-crm"))
        .map(key => caches.delete(key))
    );
  }
}

window.addEventListener("load", () => {
  cleanupCustomerCache().catch(() => {});
});
