export function createCurseMessage(element) {
  let shown = false;
  let timeout;
  let history = [];

  function hide() {
    clearTimeout(timeout);
    element.hidden = true;
    element.classList?.remove('storm-warning');
  }

  function remember() {
    shown = true;
    if (typeof element.textContent === 'string' && !history.includes(element.textContent)) history.push(element.textContent);
  }

  return {
    hide,
    remember,
    getHistory: () => [...history],
    restoreHistory(entries) {
      history = Array.isArray(entries) ? entries.filter(text => typeof text === 'string' && text.trim()) : [];
    },
    show(text, { keepHistory = true } = {}) {
      hide();
      element.textContent = text;
      if (keepHistory && !history.includes(text)) history.push(text);
      element.hidden = false;
      timeout = setTimeout(hide, 15000);
    },
    reset() {
      hide();
      shown = false;
      history = [];
    },
    isShown: () => shown,
    showOnce(text) {
      if (shown) return false;
      hide();
      if (typeof text === 'string') element.textContent = text;
      remember();
      element.hidden = false;
      timeout = setTimeout(hide, 15000);
      return true;
    },
  };
}
