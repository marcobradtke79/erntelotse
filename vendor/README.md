# Vendored libraries

Third-party files are copied into this folder so the app runs without a build step and without CDN requests. Do not edit them; update them by downloading a new version.

| Library | Version | File(s) | Licence | Source |
|---|---|---|---|---|
| Vue | 3.5.46 | `vue/vue.esm-browser.prod.js` (includes the template compiler) | MIT | `https://cdn.jsdelivr.net/npm/vue@3.5.46/dist/vue.esm-browser.prod.js` |
| vue-router | 5.5.1 | `vue-router/vue-router.esm-browser.prod.js` | MIT | `https://cdn.jsdelivr.net/npm/vue-router@5.5.1/dist/vue-router.esm-browser.prod.js` |
| vue-i18n | 11.4.23 | `vue-i18n/vue-i18n.esm-browser.prod.js` | MIT | `https://cdn.jsdelivr.net/npm/vue-i18n@11.4.23/dist/vue-i18n.esm-browser.prod.js` |
| Nunito (variable) | @fontsource-variable/nunito 5.3.0 | `fonts/nunito/nunito-latin-wght-normal.woff2`, `fonts/nunito/nunito-latin-ext-wght-normal.woff2` | SIL OFL 1.1 | `https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito@5.3.0/files/` |

Each folder contains the library's `LICENSE` file.

## Updating

1. Download the new file to the same path (replace the version in the URL).
2. Use the production `esm-browser` builds: the development builds of vue-router import `@vue/devtools-api` and `nostics`, which are not vendored. The production builds of vue-router and vue-i18n import only `vue`. Check with:
   `grep -oE "from\s*['\"][^'\"./][^'\"]*['\"]" vendor/<lib>/<file>.js | sort -u`
3. Update the version in this table.
4. Run the tests (`/tests/`) and click through the app.

The import map in `index.html` maps `vue`, `vue-router` and `vue-i18n` to these files. The font's `@font-face` rules (with their `unicode-range`) are in `css/base.css`.
