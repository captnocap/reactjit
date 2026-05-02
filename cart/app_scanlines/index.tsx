import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppScanlines() {
  return (
    <Filter shader="scanlines" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
