// landing.tsx — thin re-export so index.tsx import stays stable
// The actual homepage lives in cart/sweatshop/components/home/

const React: any = require('react');
const { memo } = React;

import { HomeCanvas } from './home/HomeCanvas';

function LandingSurfaceImpl(props: any) {
  return <HomeCanvas {...props} />;
}

export const LandingSurface = memo(LandingSurfaceImpl);
