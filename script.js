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
