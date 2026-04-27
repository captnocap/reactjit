import { Tooltip, type BasicTooltipMethod, type TooltipData, type TooltipTone } from '../tooltip/Tooltip';

export type BasicTooltipKind = BasicTooltipMethod;
export type BasicTooltipTone = TooltipTone;

export type BasicTooltipProps = TooltipData & {
  kind?: BasicTooltipKind;
};

export function BasicTooltip({ kind = 'command', ...data }: BasicTooltipProps) {
  return <Tooltip type="basic" method={kind} data={data} />;
}
