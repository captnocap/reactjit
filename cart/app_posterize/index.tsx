import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppPosterize() {
  return (
    <Filter shader="posterize" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
