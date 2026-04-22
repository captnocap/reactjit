import { applyTheme } from '../../theme';

let didRoll = false;

export function useRandomThemeOnLoad() {
  const rolled = useRef(false);
  useEffect(() => {
    if (didRoll || rolled.current) return;
    didRoll = true;
    rolled.current = true;
    const names = ['soft', 'sharp', 'studio', 'high-contrast'];
    const pick = names[Math.floor(Math.random() * names.length)];
    applyTheme(pick);
  }, []);
}
