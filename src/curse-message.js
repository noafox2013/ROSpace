export function createCurseMessage(element) {
  let shown = false;
  let timeout;

  function hide() {
    clearTimeout(timeout);
    element.hidden = true;
  }

  function remember() {
    shown = true;
  }

  return {
    hide,
    remember,
    reset() {
      hide();
      shown = false;
    },
    isShown: () => shown,
    showOnce() {
      if (shown) return false;
      remember();
      element.hidden = false;
      timeout = setTimeout(hide, 15000);
      return true;
    },
  };
}
