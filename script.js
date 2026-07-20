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
    </svg>
  `;
  const scriptElement =
    document.currentScript || document.querySelector('script[src$="script.js"]');
  const scriptUrl = scriptElement?.src
    ? new URL(scriptElement.src)
    : new URL("/script.js", window.location.origin);
  let audio = null;
  let isPlaying = false;

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
    button.innerHTML = MUSIC_NOTE_ICON;
    button.classList.toggle("is-playing", isPlaying);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(isPlaying));
  }

  const playAudio = () => {
    const bgm = createAudio();
    const playPromise = bgm.play();

    if (!playPromise || typeof playPromise.then !== "function") {
      isPlaying = true;
      updateButton();
      return Promise.resolve();
    }

    return playPromise
      .then(() => {
        isPlaying = true;
        updateButton();
      })
      .catch(() => {
        isPlaying = false;
        updateButton();
      });
  };

  const pauseAudio = () => {
    if (audio) {
      audio.pause();
    }

    isPlaying = false;
    updateButton();
  };

  const mountMusicControl = () => {
    document.head.appendChild(style);
    document.body.appendChild(button);
    updateButton();

    button.addEventListener("click", () => {
      if (isPlaying) {
        storeChoice(PAUSED_VALUE);
        pauseAudio();
        return;
      }

      storeChoice(PLAYING_VALUE);
      playAudio();
    });

    if (getStoredChoice() === PLAYING_VALUE) {
      playAudio();
    }
  };

  if (document.body) {
    mountMusicControl();
  } else {
    document.addEventListener("DOMContentLoaded", mountMusicControl, { once: true });
  }
})();

(() => {
  const monthLabel = document.querySelector("#holiday-current-month");
  const dateList = document.querySelector("#holiday-date-list");
  const modal = document.querySelector("#holiday-modal");
  const openButton = document.querySelector("#holiday-open-button");
  const closeButtons = document.querySelectorAll("[data-holiday-close]");
  const closeButton = modal?.querySelector(".holiday-modal__close");
  const STORAGE_KEY = "alice-holiday-modal-closed";

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
  const taiwanDateParts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(
    taiwanDateParts.find((part) => part.type === "year")?.value
  );
  const month =
    Number(taiwanDateParts.find((part) => part.type === "month")?.value) - 1;

  const getNthWeekday = (targetWeekday, nth) => {
    const firstDay = new Date(year, month, 1);
    const offset = (targetWeekday - firstDay.getDay() + 7) % 7;

    return new Date(year, month, 1 + offset + (nth - 1) * 7);
  };

  const closures = [
    { date: getNthWeekday(1, 1), label: "\u7b2c 1 \u500b\u661f\u671f\u4e00" },
    { date: getNthWeekday(0, 2), label: "\u7b2c 2 \u500b\u661f\u671f\u65e5" },
    { date: getNthWeekday(1, 3), label: "\u7b2c 3 \u500b\u661f\u671f\u4e00" },
    { date: getNthWeekday(0, 4), label: "\u7b2c 4 \u500b\u661f\u671f\u65e5" },
  ].sort((a, b) => a.date - b.date);

  monthLabel.textContent = `${year} \u5e74 ${month + 1} \u6708\u516c\u4f11\u65e5`;
  dateList.replaceChildren(
    ...closures.map(({ date, label }) => {
      const item = document.createElement("li");
      const rule = document.createElement("span");

      item.textContent = `${month + 1} \u6708 ${date.getDate()} \u65e5\uff08${
        weekdays[date.getDay()]
      }\uff09`;
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
