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
  const audio = document.createElement("audio");
  const scriptElement =
    document.currentScript || document.querySelector('script[src$="script.js"]');
  const scriptUrl = scriptElement?.src
    ? new URL(scriptElement.src)
    : new URL("/script.js", window.location.origin);
  const interactionEvents = ["click", "touchstart", "scroll", "keydown"];
  let isPlaying = false;

  audio.src = new URL("assets/audio/alice-bgm.mp3", scriptUrl).href;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.15;
  audio.controls = false;
  audio.setAttribute("aria-hidden", "true");
  audio.style.display = "none";

  const removeInteractionListeners = () => {
    interactionEvents.forEach((eventName) => {
      window.removeEventListener(eventName, playFromInteraction, true);
    });
  };

  const playAudio = () => {
    if (isPlaying) return Promise.resolve();

    const playPromise = audio.play();

    if (!playPromise || typeof playPromise.then !== "function") {
      isPlaying = true;
      removeInteractionListeners();
      return Promise.resolve();
    }

    return playPromise
      .then(() => {
        isPlaying = true;
        removeInteractionListeners();
      })
      .catch(() => {
        isPlaying = false;
      });
  };

  function playFromInteraction() {
    playAudio();
  }

  const addInteractionListeners = () => {
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, playFromInteraction, {
        capture: true,
        passive: true,
      });
    });
  };

  const mountAudio = () => {
    document.body.appendChild(audio);
    addInteractionListeners();
    playAudio();
  };

  if (document.body) {
    mountAudio();
  } else {
    document.addEventListener("DOMContentLoaded", mountAudio, { once: true });
  }
})();
