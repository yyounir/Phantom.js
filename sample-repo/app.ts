import { aliveCalled } from "./utils/alive";

// Lazy route loader: lazyLoaded is resolved at runtime via dynamic import(),
// so it must NOT be flagged as dead even though there is no static call site.
export const routes: Record<string, () => Promise<number>> = {
  lazy: () => import("./utils/dynamic").then((m) => m.lazyLoaded(10)),
};

function main() {
  console.log(aliveCalled(5));
  return routes;
}

main();
