(() => {
  // One key per notice: closing the board notice must not close the M7 one (VNX-2707a).
  const KEYS = { m7: "vnxsi:privacy-notice-dismissed:v1", board: "vnxsi:board-notice-dismissed:v1" };
  const keyOf = (notice) => KEYS[notice.dataset.noticeId] || KEYS.m7;
  const read = (key) => {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const remember = (key) => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage denied: the native <details> close still works for this page.
    }
  };
  document.querySelectorAll('details[data-privacy-notice="true"]').forEach((notice) => {
    const key = keyOf(notice);
    if (read(key)) notice.open = false;
    notice.addEventListener("toggle", () => {
      if (!notice.open) remember(key);
    });
  });
})();
