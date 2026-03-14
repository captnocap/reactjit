import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Box } from './primitives';

// ── Portal Context ─────────────────────────────────────

interface PortalContextValue {
  register: (key: string, children: ReactNode) => void;
  unregister: (key: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

// ── PortalHost ─────────────────────────────────────────

export interface PortalHostProps {
  children: ReactNode;
}

export function PortalHost({ children }: PortalHostProps) {
  const [portals, setPortals] = useState<Map<string, ReactNode>>(new Map());

  const contextValue = useRef<PortalContextValue>({
    register: (key: string, content: ReactNode) => {
      setPortals((prev) => {
        const next = new Map(prev);
        next.set(key, content);
        return next;
      });
    },
    unregister: (key: string) => {
      setPortals((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
  }).current;

  return (
    <PortalContext.Provider value={contextValue}>
      {children}
      {Array.from(portals.entries()).map(([key, portalContent]) => (
        <Box
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1000,
          }}
        >
          {portalContent}
        </Box>
      ))}
    </PortalContext.Provider>
  );
}

// ── Context-based portal (registers with nearest PortalHost) ──

function ContextPortal({
  portalKey,
  children,
}: {
  portalKey: string;
  children: ReactNode;
}) {
  const portalContext = useContext(PortalContext);

  // rjit-ignore-next-line — Dep-driven: re-registers portal content when key/children change
  useEffect(() => {
    if (portalContext) {
      portalContext.register(portalKey, children);
      return () => {
        portalContext.unregister(portalKey);
      };
    }
  }, [portalContext, portalKey, children]);

  return null;
}

// ── Portal ─────────────────────────────────────────────

export interface PortalProps {
  children: ReactNode;
  name?: string;
}

let portalCounter = 0;

export function Portal({ children, name }: PortalProps) {
  const portalKeyRef = useRef<string>(`portal-${name || portalCounter++}`);
  return <ContextPortal portalKey={portalKeyRef.current}>{children}</ContextPortal>;
}
