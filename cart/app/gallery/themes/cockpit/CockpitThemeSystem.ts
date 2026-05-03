import { defineThemeSystem } from '../../theme-system';
import { sharedGlobalThemeTokens } from '../shared/global-theme-tokens';
import { cockpitThemeClassifier, cockpitDefaultTheme } from './theme-classifier';
import { cockpitStyleClassifier } from './style-classifier';
import { cockpitVariantClassifier } from './variant-classifier';
import { cockpitBreakpointClassifier } from './breakpoint-classifier';

export const cockpitThemeSystem = defineThemeSystem({
  classifiers: [
    cockpitThemeClassifier,
    cockpitStyleClassifier,
    cockpitVariantClassifier,
    cockpitBreakpointClassifier,
  ],
  globalTokens: sharedGlobalThemeTokens,
  themes: [cockpitDefaultTheme],
});
