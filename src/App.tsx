import { lazy, Suspense, useDeferredValue, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { preloadAllRoutesWhenIdle, routeImports } from "./routes";

const Home = lazy(routeImports["/"]);
const NotFound = lazy(routeImports["/404"]);

const App = () => {
  const [location] = useLocation();
  const deferredLocation = useDeferredValue(location);

  useEffect(() => {
    preloadAllRoutesWhenIdle();
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="bg-brand-primary text-brand-white sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <Suspense fallback={null}>
          <Switch location={deferredLocation}>
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </>
  );
};

export default App;
