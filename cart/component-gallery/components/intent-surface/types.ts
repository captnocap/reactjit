/**
 * Intent chat surface — vocabulary contract.
 *
 * The surface area a model has when it composes a response as an interactive
 * UI tree. Every supported tag is listed here. Anything outside this set is
 * not part of the contract and parsers should treat it as text/recoverable.
 *
 * Three concrete affordances:
 *   - Layout    — Row, Col, Card, Title, Text, List   (display only)
 *   - Action    — Btn                                  (single-choice reply)
 *   - Form      — Form, Field, Submit                  (multi-value reply)
 *
 * The model authors `reply=` strings for Btn and Submit. Submit's reply is
 * a template — every {fieldName} is replaced with the field's current value
 * before being sent as the next user message.
 */

export type IntentTag =
  | 'Title' | 'Text' | 'Card' | 'Row' | 'Col' | 'List'
  | 'Btn'
  | 'Form' | 'Field' | 'Submit'
  | 'Badge' | 'Code' | 'Divider' | 'Kbd' | 'Spacer';

export interface FormCtx {
  /** Live value map. Mutated by Field, read by Submit. */
  valuesRef: { current: Record<string, string> };
  /** Update a field value and trigger a re-render of the form's Submit-button label area if needed. */
  set: (name: string, value: string) => void;
}

export type OnAction = (reply: string) => void;
