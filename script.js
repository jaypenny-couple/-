const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

const getPageName = (pathname) => {
  const cleanPath = pathname.replace(/\/+$/, "");
  const lastSegment = cleanPath.split("/").pop() || "index.html";
  return lastSegment === "-" ? "index.html" : lastSegment;
};

const currentPage = getPageName(window.location.pathname);

if (siteNav) {
  siteNav.querySelectorAll("a").forEach((link) => {
    if (link.classList.contains("lang-switch")) return;

    try {
      const linkUrl = new URL(link.getAttribute("href"), window.location.href);
      const linkPage = getPageName(linkUrl.pathname);
      const isSameOrigin = linkUrl.origin === window.location.origin;

      if (isSameOrigin && linkPage === currentPage) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    } catch (error) {
      link.removeAttribute("aria-current");
    }
  });
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
      document.body.classList.remove("nav-open");
    });
  });
}

(() => {
  const STORAGE_KEY = "alice-bgm-choice";
  const PLAYING_VALUE = "on";
  const PAUSED_VALUE = "off";
  const MUSIC_NOTE_ICON = `
    <svg class="music-toggle-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
      <line class="music-toggle-off-mark" x1="3" y1="21" x2="21" y2="3" />
    </svg>
  `;
  const scriptElement =
    document.currentScript || document.querySelector('script[src$="script.js"]');
  const scriptUrl = scriptElement?.src
    ? new URL(scriptElement.src)
    : new URL("/script.js", window.location.origin);
  let audio = null;
  let isPlaying = false;
  let isChanging = false;

  const getStoredChoice = () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  };

  const storeChoice = (choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (error) {
      // Ignore storage failures; the visible button still controls this page.
    }
  };

  const createAudio = () => {
    if (audio) return audio;

    audio = document.createElement("audio");
    audio.src = new URL("assets/audio/alice-bgm.mp3", scriptUrl).href;
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0.15;
    audio.controls = false;
    audio.setAttribute("aria-hidden", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);

    audio.addEventListener("pause", () => {
      isPlaying = false;
      updateButton();
    });

    audio.addEventListener("play", () => {
      isPlaying = true;
      updateButton();
    });

    return audio;
  };

  const button = document.createElement("button");
  button.type = "button";
  button.className = "music-toggle";
  button.setAttribute("aria-live", "polite");

  const style = document.createElement("style");
  style.textContent = `
    .music-toggle {
      position: fixed;
      top: 88px;
      right: 20px;
      z-index: 96;
      width: 48px;
      height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(38, 38, 38, .16);
      border-radius: 999px;
      color: #262626;
      background: rgba(255, 250, 244, .94);
      box-shadow: 0 14px 34px rgba(38, 38, 38, .16);
      cursor: pointer;
      font: 800 1rem/1 "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
      backdrop-filter: blur(14px);
    }

    .music-toggle.is-playing {
      color: #fffaf4;
      border-color: rgba(201, 169, 109, .72);
      background: rgba(154, 122, 63, .94);
      box-shadow: 0 14px 34px rgba(154, 122, 63, .24);
    }

    .music-toggle-icon {
      width: 22px;
      height: 22px;
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .music-toggle-off-mark {
      opacity: 1;
      transition: opacity .18s ease;
    }

    .music-toggle.is-playing .music-toggle-off-mark {
      opacity: 0;
    }

    .music-toggle.is-loading {
      cursor: wait;
      opacity: .72;
    }

    .music-toggle:hover,
    .music-toggle:focus-visible {
      border-color: rgba(201, 169, 109, .62);
      background: #fffaf4;
      outline: none;
    }

    .music-toggle.is-playing:hover,
    .music-toggle.is-playing:focus-visible {
      color: #fffaf4;
      background: #8b6b35;
    }

    @media (max-width: 860px) {
      .music-toggle {
        top: 14px;
        right: 72px;
        z-index: 119;
      }

      body.nav-open .music-toggle {
        display: none;
      }
    }

    @media (max-width: 560px) {
      .music-toggle {
        top: 13px;
        right: 66px;
        width: 44px;
        height: 44px;
      }

      .music-toggle-icon {
        width: 20px;
        height: 20px;
      }
    }

    @media (max-width: 360px) {
      .music-toggle {
        top: 76px;
        right: 16px;
      }
    }
  `;

  function updateButton() {
    const label = isPlaying ? "關閉背景音樂" : "開啟背景音樂";
    const title = isPlaying
      ? "背景音樂播放中，點擊關閉"
      : "背景音樂已關閉，點擊開啟";

    button.innerHTML = MUSIC_NOTE_ICON;
    button.classList.toggle("is-playing", isPlaying);
    button.classList.toggle("is-loading", isChanging);
    button.disabled = isChanging;
    button.setAttribute("aria-label", isChanging ? "背景音樂處理中" : label);
    button.setAttribute("title", title);
    button.setAttribute("aria-pressed", String(isPlaying));
  }

  const playAudio = () => {
    const bgm = createAudio();
    isChanging = true;
    updateButton();

    const playPromise = bgm.play();

    if (!playPromise || typeof playPromise.then !== "function") {
      isChanging = false;
      isPlaying = true;
      storeChoice(PLAYING_VALUE);
      updateButton();
      return Promise.resolve();
    }

    return playPromise
      .then(() => {
        isChanging = false;
        isPlaying = true;
        storeChoice(PLAYING_VALUE);
        updateButton();
      })
      .catch(() => {
        isChanging = false;
        isPlaying = false;
        storeChoice(PAUSED_VALUE);
        updateButton();
      });
  };

  const pauseAudio = () => {
    if (audio) {
      audio.pause();
    }

    isPlaying = false;
    isChanging = false;
    updateButton();
  };

  const mountMusicControl = () => {
    document.head.appendChild(style);
    document.body.appendChild(button);
    updateButton();

    button.addEventListener("click", () => {
      if (isChanging) return;

      if (isPlaying) {
        storeChoice(PAUSED_VALUE);
        pauseAudio();
        return;
      }

      playAudio();
    });

    // Browsers can block autoplay on page load, so every visit starts visibly off.
    if (getStoredChoice() === PLAYING_VALUE) {
      storeChoice(PAUSED_VALUE);
    }
  };

  if (document.body) {
    mountMusicControl();
  } else {
    document.addEventListener("DOMContentLoaded", mountMusicControl, { once: true });
  }
})();

(() => {
  const filterButtons = document.querySelectorAll("[data-category-filter]");
  const contentCards = document.querySelectorAll("[data-content-card]");

  if (filterButtons.length && contentCards.length) {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const selectedCategory = button.dataset.categoryFilter || "all";

        filterButtons.forEach((filterButton) => {
          const isSelected = filterButton === button;

          filterButton.classList.toggle("is-active", isSelected);
          filterButton.setAttribute("aria-pressed", String(isSelected));
        });

        contentCards.forEach((card) => {
          const shouldHide =
            selectedCategory !== "all" && card.dataset.category !== selectedCategory;

          card.hidden = shouldHide;
        });
      });
    });
  }

  document.querySelectorAll(".lite-youtube-thumbnail[data-fallback-src]").forEach((image) => {
    image.addEventListener("error", () => {
      const fallbackSrc = image.dataset.fallbackSrc;

      if (!fallbackSrc || image.dataset.fallbackLoaded === "true") return;

      image.dataset.fallbackLoaded = "true";
      image.src = fallbackSrc;
    });
  });

  document.querySelectorAll(".lite-youtube-button").forEach((button) => {
    button.addEventListener("click", () => {
      const player = button.closest(".lite-youtube");
      const videoId = player?.dataset.videoId || button.dataset.videoId;

      if (!player || !videoId || player.querySelector("iframe")) return;

      const videoTitle =
        player.dataset.videoTitle ||
        button.dataset.trackTitle ||
        button.getAttribute("aria-label") ||
        "ALICE 美髮理科影片";
      const iframe = document.createElement("iframe");

      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
      iframe.title = videoTitle;
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";

      player.classList.add("is-playing");
      player.replaceChildren(iframe);
    });
  });

  const currentArticleSlug = currentPage.replace(/\.html$/, "");
  const articleCategoryMap = {
    "bleached-hair-perm": "perm",
    "wrong-shampoo-dandruff": "scalp",
    "change-shampoo-regularly": "scalp",
    "seasonal-hair-shedding-dandruff": "scalp",
    "diy-hair-color-cost": "color",
    "natural-herbal-hair-dye-safety": "color",
    "gray-hair-darker-color-coverage": "color",
  };

  document
    .querySelectorAll(".science-article-page .related-grid .mini-card[href]")
    .forEach((link, index) => {
      if (link.href.includes("page.line.me") || link.dataset.trackEvent) return;

      const title = link.querySelector("strong")?.textContent?.trim() || link.textContent.trim();

      link.dataset.trackEvent = "hair_science_related_click";
      link.dataset.trackTitle = title;
      link.dataset.trackSlug = currentArticleSlug;
      link.dataset.trackCategory = articleCategoryMap[currentArticleSlug] || "hair-science";
      link.dataset.trackPosition = `related-${index + 1}`;
    });

  document
    .querySelectorAll('.science-article-page a[href*="page.line.me"]')
    .forEach((link, index) => {
      if (link.dataset.trackEvent) return;

      link.dataset.trackEvent = "hair_science_line_click";
      link.dataset.trackTitle = `${document.querySelector("h1")?.textContent?.trim() || "美髮理科文章"} LINE 諮詢`;
      link.dataset.trackSlug = currentArticleSlug;
      link.dataset.trackCategory = articleCategoryMap[currentArticleSlug] || "hair-science";
      link.dataset.trackPosition = `line-${index + 1}`;
    });
})();

(() => {
  const monthLabel = document.querySelector("#holiday-current-month");
  const dateList = document.querySelector("#holiday-date-list");
  const modal = document.querySelector("#holiday-modal");
  const openButton = document.querySelector("#holiday-open-button");
  const closeButtons = document.querySelectorAll("[data-holiday-close]");
  const closeButton = modal?.querySelector(".holiday-modal__close");
  const STORAGE_KEY = "alice-holiday-modal-closed-2026-09";

  if (!monthLabel || !dateList || !modal || !openButton) return;

  const weekdays = [
    "\u65e5",
    "\u4e00",
    "\u4e8c",
    "\u4e09",
    "\u56db",
    "\u4e94",
    "\u516d",
  ];
  const year = 2026;
  const month = 8;
  const closures = [
    { date: new Date(year, 7, 30), label: "公休" },
    {
      date: new Date(year, month, 3),
      label: "IRIS CINDY SHERRY 休假到尖石鄉為偏鄉學童義剪",
      isFeatured: true,
    },
    { date: new Date(year, month, 7), label: "公休" },
    { date: new Date(year, month, 13), label: "公休" },
    { date: new Date(year, month, 21), label: "公休" },
    { date: new Date(year, month, 27), label: "公休" },
  ].sort((a, b) => a.date - b.date);

  monthLabel.textContent = `${year} \u5e74 ${month + 1} \u6708\u4f11\u5047\u516c\u544a`;
  dateList.replaceChildren(
    ...closures.map(({ date, label, isFeatured }) => {
      const item = document.createElement("li");
      const rule = document.createElement("span");

      item.classList.toggle("is-highlight", Boolean(isFeatured));
      item.textContent = `${date.getMonth() + 1} \u6708 ${date.getDate()} \u65e5\uff08${weekdays[date.getDay()]}\uff09`;
      rule.textContent = label;
      item.appendChild(rule);

      return item;
    })
  );

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("holiday-modal-open");
    closeButton?.focus();
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("holiday-modal-open");

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      // The modal still closes if session storage is unavailable.
    }
  };

  openButton.addEventListener("click", () => {
    openModal();
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      closeModal();
      openButton.focus();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
      openButton.focus();
    }
  });

  let wasClosed = false;

  try {
    wasClosed = window.sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch (error) {
    wasClosed = false;
  }

  if (!wasClosed) {
    openModal();
  }
})();

(() => {
  if (currentPage !== "index.html") return;

  const footerInner = document.querySelector(".site-footer .footer-inner");
  if (!footerInner || document.querySelector(".dashboard-entry")) return;

  const DASHBOARD_PATH = "alice_dashboard_index_v2.html";
  const PASSWORD_HASH = "e4f76467f7dce76a4575e1951f60501429ae3accf07c138950c4b8df9df07109";

  const entry = document.createElement("div");
  entry.className = "dashboard-entry";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "dashboard-entry-button";
  button.textContent = "STAFF｜管理儀表板";
  button.setAttribute("aria-label", "開啟 ALICE 管理儀表板");

  const style = document.createElement("style");
  style.textContent = `
    .dashboard-entry {
      width: 100%;
      flex: 0 0 100%;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, .12);
      display: flex;
      justify-content: flex-end;
    }

    .dashboard-entry-button {
      appearance: none;
      padding: 4px 0;
      border: 0;
      background: transparent;
      color: inherit;
      opacity: .58;
      cursor: pointer;
      font: inherit;
      font-size: .75rem;
      letter-spacing: .08em;
      transition: opacity .18s ease;
    }

    .dashboard-entry-button:hover,
    .dashboard-entry-button:focus-visible {
      opacity: 1;
      outline: none;
      text-decoration: underline;
      text-underline-offset: 4px;
    }

    @media (max-width: 860px) {
      .dashboard-entry {
        justify-content: flex-start;
        margin-top: 28px;
        padding-top: 16px;
      }

      .dashboard-entry-button {
        /* Keep the staff link clear of the fixed holiday button on the right. */
        max-width: calc(100% - 118px);
      }
    }
  `;

  const sha256 = async (value) => {
    const data = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  button.addEventListener("click", async () => {
    const password = window.prompt("請輸入 ALICE 管理密碼");
    if (password === null) return;

    if (!window.crypto?.subtle) {
      window.alert("此瀏覽器無法使用安全驗證功能，請改用最新版瀏覽器。");
      return;
    }

    try {
      const passwordHash = await sha256(password.trim());

      if (passwordHash === PASSWORD_HASH) {
        window.location.href = DASHBOARD_PATH;
        return;
      }
    } catch (error) {
      window.alert("密碼驗證暫時無法使用，請稍後再試。");
      return;
    }

    window.alert("密碼錯誤，請重新輸入。");
  });

  document.head.appendChild(style);
  entry.appendChild(button);
  footerInner.appendChild(entry);
})();
