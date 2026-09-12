import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// Workbox injects a revisioned list of the current Vite build assets here.
// Do not call skipWaiting: the app decides when an update is safe to activate.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// A cached app shell keeps the calculator reachable on an offline restart.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));
