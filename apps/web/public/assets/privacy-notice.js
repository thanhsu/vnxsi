(() => {
  const KEY = "vnxsi:privacy-notice-dismissed:v1";
  const read = () => {
    try {
      return window.localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  };
  const remember = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Storage denied: the native <details> close still works for this page.
    }
  };
  document.querySelectorAll('details[data-privacy-notice="true"]').forEach((notice) => {
    if (read()) notice.open = false;
    notice.addEventListener("toggle", () => {
      if (!notice.open) remember();
    });
  });
})();
