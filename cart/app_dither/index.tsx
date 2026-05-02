import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppDither() {
  return (
    <Filter shader="dither" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
