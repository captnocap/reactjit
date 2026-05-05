import { Filter } from '@reactjit/runtime/primitives';
import App from '../app/index';

export default function AppBytecode() {
  return (
    <Filter shader="bytecode" intensity={1} style={{ width: '100%', height: '100%' }}>
      <App />
    </Filter>
  );
}
