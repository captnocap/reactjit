import { Tooltip, type RichTooltipMethod, type TooltipData, type TooltipRow, type TooltipTone } from '../tooltip/Tooltip';

export type RichTooltipKind = RichTooltipMethod;
export type RichTooltipTone = TooltipTone;
export type RichTooltipRow = TooltipRow;

export type RichTooltipProps = TooltipData & {
  kind?: RichTooltipKind;
};

export function RichTooltip({ kind = 'metrics', ...data }: RichTooltipProps) {
  return <Tooltip type="rich" method={kind} data={data} />;
}
