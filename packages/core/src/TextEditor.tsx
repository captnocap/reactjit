/** @deprecated Use <Input multiline /> from './Input' */
import { Input } from './Input';
import type { InputProps } from './types';

export function TextEditor(props: InputProps & { initialValue?: string }) {
  const { initialValue, ...rest } = props as any;
  return Input({
    multiline: true,
    lineNumbers: true,
    ...rest,
    ...(initialValue !== undefined && rest.defaultValue === undefined
      ? { defaultValue: initialValue }
      : {}),
  });
}
