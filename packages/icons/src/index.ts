export { Icon } from './Icon';
export type { IconProps } from './Icon';
export * from './icons';
export { iconNames } from './iconNames';

// Auto-register all icons into core's registry so <Image src="heart" /> works
import { registerIcons } from '@reactjit/core';
import * as allIcons from './icons';
registerIcons(allIcons as unknown as Record<string, number[][]>);
