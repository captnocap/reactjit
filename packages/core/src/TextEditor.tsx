/** @deprecated Use <Input multiline /> from './Input' */
import { Input } from './Input';
import type { InputProps } from './types';

export function TextEditor(props: InputProps) {
  return Input({ multiline: true, ...props });
}
