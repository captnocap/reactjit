
import { useMediaStore } from '../media/useMediaStore';

const host: any = globalThis as any;

export function useMaskPreview() {
  const store = useMediaStore();
  const [time, setTime] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setTime(Date.now());
      const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
      if (raf) raf(tick);
      else setTimeout(tick, 120);
    };
    tick();
    return () => { active = false; };
  }, []);

  const active = store.selected || null;
  const preview = useMemo(() => ({
    hasMedia: !!active,
    title: active ? active.title : 'No media selected',
    source: active ? active.source : '',
    kind: active ? active.kind : 'image',
  }), [active]);

  const liveSources = useMemo(() => ([
    {
      id: 'media-library',
      label: 'Media library',
      available: true,
      active: true,
      detail: active ? active.title : 'Pick any imported image or video from the library.',
    },
    {
      id: 'canvas-output',
      label: 'Current canvas output',
      available: false,
      active: false,
      detail: 'Not wired yet. The live frame buffer capture path is still pending.',
    },
    {
      id: 'screen-region',
      label: 'Screen region',
      available: false,
      active: false,
      detail: 'Not wired yet. Screen/window capture is not exposed to this panel.',
    },
    {
      id: 'webcam',
      label: 'Webcam',
      available: false,
      active: false,
      detail: 'Not wired yet. No live camera source is mounted in this cart.',
    },
    {
      id: 'frame-buffer',
      label: 'Canvas frame buffer',
      available: false,
      active: false,
      detail: 'Not wired yet. A direct framebuffer surface has not been exposed.',
    },
  ]), [active]);

  return {
    ...store,
    time,
    active,
    preview,
    liveSources,
    hasLiveSource: !!active,
  };
}
