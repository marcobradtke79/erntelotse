// Online/offline state of the browser. Offline, the map shows the grid instead of the
// street map (OSM tiles must not be stored for offline use) and weather is not fetched.

import { reactive } from 'vue';

export const network = reactive({ online: globalThis.navigator?.onLine ?? true });

globalThis.addEventListener?.('online', () => { network.online = true; });
globalThis.addEventListener?.('offline', () => { network.online = false; });
