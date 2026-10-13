import { gameConfig } from '../gameConfig';

const fmt = new Intl.NumberFormat(gameConfig.currency.locale, {
  style: 'currency',
  currency: gameConfig.currency.code,
});
const minorPerMajor = 10 ** (fmt.resolvedOptions().maximumFractionDigits ?? 2);

/** Integer minor units to display string. Render time only. */
export const formatMoney = (minor: number) => fmt.format(minor / minorPerMajor);
