// app_fried — cart/app rendered through the deepfry post-process filter.
//
// The Filter primitive captures its subtree into an offscreen texture every
// frame and runs a fragment-shader pass on the way back to the main surface.
// Animations and hit testing inside are unaffected — only pixels are mangled.
import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppFried() {
  return (
    <Filter shader="deepfry" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
