import React, { useMemo } from 'react';
import type { ReactNode, ReactElement } from 'react';
import type { RouteProps, LinkProps, NavigateOptions } from './types';
import { matchRoute, scorePattern } from './matcher';
import { useRouter, useNavigate, RouteParamsContext, OutletContext } from './context';

// ── Route ───────────────────────────────────────────────

/**
 * Renders its element when the current location matches the path pattern.
 * Use inside a <Routes> wrapper for best-match semantics, or standalone
 * for simple conditional rendering.
 *
 * <Route path="/users/:id" element={<UserPage />} />
 */
export function Route(_props: RouteProps): ReactElement | null {
  // Route is a marker component — actual rendering is done by <Routes>
  // or by standalone usage below
  return null;
}

// ── Routes (best-match container) ───────────────────────

/**
 * Evaluates all child <Route> elements and renders the best match.
 * "Best" = highest specificity score among matching patterns.
 *
 * <Routes>
 *   <Route path="/" element={<Home />} />
 *   <Route path="/users/:id" element={<User />} />
 *   <Route path="/users/new" element={<NewUser />} />
 *   <Route path="*" element={<NotFound />} />
 * </Routes>
 */
export function Routes({ children }: { children: ReactNode }): ReactElement | null {
  const { location } = useRouter();
  const pathname = location.pathname;

  // Collect route definitions from children
  const routes = useMemo(() => {
    const result: { path: string; element: ReactNode }[] = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type !== Route) return;
      const props = child.props as RouteProps;
      result.push({ path: props.path, element: props.element });
    });
    return result;
  }, [children]);

  // Find best match
  let bestRoute: { path: string; element: ReactNode } | null = null;
  let bestScore = -1;
  let bestParams: Record<string, string> = {};

  for (const route of routes) {
    const match = matchRoute(route.path, pathname);
    if (match.matched) {
      const score = scorePattern(route.path);
      if (score > bestScore) {
        bestRoute = route;
        bestScore = score;
        bestParams = match.params;
      }
    }
  }

  if (!bestRoute) return null;

  return React.createElement(
    RouteParamsContext.Provider,
    { value: bestParams },
    bestRoute.element,
  );
}

// ── Link ────────────────────────────────────────────────

/**
 * Navigable element. Renders its children and calls navigate() on click.
 * Works in both web and native modes — uses onClick handler.
 *
 * <Link to="/about">About</Link>
 */
export function Link({ to, replace, children, style, ...rest }: LinkProps & Record<string, any>) {
  const navigate = useNavigate();

  const handleClick = (e: any) => {
    // If it's a DOM event, prevent default link behavior
    if (e?.preventDefault) e.preventDefault();
    const options: NavigateOptions = replace ? { replace: true } : {};
    navigate(to, options);
  };

  // Render as <a> element for web (provides hover, right-click, etc.)
  // The onClick handler does the actual navigation
  return React.createElement(
    'a',
    {
      href: to,
      onClick: handleClick,
      style: { textDecoration: 'none', color: 'inherit', cursor: 'pointer', ...style },
      ...rest,
    },
    children,
  );
}

// ── Outlet ──────────────────────────────────────────────

/**
 * Renders nested route content. Used inside a parent route's element
 * to show where child routes should render.
 *
 * function Layout() {
 *   return (
 *     <div>
 *       <NavBar />
 *       <Outlet />
 *     </div>
 *   );
 * }
 */
export function Outlet(): ReactElement | null {
  const outlet = React.useContext(OutletContext);
  return (outlet as ReactElement) ?? null;
}

// ── Navigate (declarative redirect) ─────────────────────

/**
 * Declarative navigation. When rendered, immediately navigates to `to`.
 *
 * <Route path="/old" element={<Navigate to="/new" replace />} />
 */
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to, { replace });
  }, [to, replace, navigate]);
  return null;
}
