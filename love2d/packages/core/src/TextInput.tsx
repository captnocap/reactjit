/** @deprecated Use <Input /> from './Input' */
import { Input } from './Input';
import type { InputProps } from './types';

export function TextInput(props: InputProps) {
  return Input(props);
}
