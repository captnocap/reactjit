import { getElement, type Element } from '../lib/chemistry/elements';
import { getElementMeta } from '../lib/chemistry/elementMeta';

export type ChemistryElement = Element & {
  firstIonization: number | null;
  isotopeCount: number | null;
  discoverer: string | null;
  yearDiscovered: number | null;
};

export function useElement(key: number | string): ChemistryElement | undefined {
  const element = useMemo(() => getElement(key), [key]);
  if (!element) return undefined;
  const meta = getElementMeta(element.number);
  return {
    ...element,
    firstIonization: meta.ionization,
    isotopeCount: meta.isotopes,
    discoverer: null,
    yearDiscovered: null,
  };
}
