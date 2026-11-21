// Applies the theme setting (system | light | dark) as data-theme on <html>.

const darkQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
let current = 'system';

function effective(setting) {
  if (setting === 'light' || setting === 'dark') return setting;
  return darkQuery?.matches ? 'dark' : 'light';
}

function render() {
  const theme = effective(current);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#1B1D22' : '#FFF9EC');
}

export function applyTheme(setting) {
  current = setting;
  render();
}

darkQuery?.addEventListener('change', () => {
  if (current === 'system') render();
});
