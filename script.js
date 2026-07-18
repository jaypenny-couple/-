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
  const ICON_PLAY = ">";
  const ICON_PAUSE = "||";
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
      right: 16px;
      bottom: 16px;
      z-index: 96;
      width: 46px;
      height: 46px;
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

    .music-toggle:hover,
    .music-toggle:focus-visible {
      border-color: rgba(201, 169, 109, .62);
      background: #fffaf4;
      outline: none;
    }

    @media (max-width: 860px) {
      .music-toggle {
        right: 18px;
        bottom: 86px;
      }
    }
  `;

  function updateButton() {
    const label = isPlaying ? "Pause background music" : "Play background music";
    button.textContent = isPlaying ? ICON_PAUSE : ICON_PLAY;
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
