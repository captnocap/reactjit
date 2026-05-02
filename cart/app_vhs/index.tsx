import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppVHS() {
  return (
    <Filter shader="vhs" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
