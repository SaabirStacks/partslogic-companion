// The one-line summary at the top of the Outbox tab.
export function outboxSummary(input: {
  waiting: number;
  needsAttention: number;
  online: boolean;
  lastProblem: string | null;
}): { icon: 'sent' | 'warning' | 'offline' | 'outbox'; title: string; body: string } {
  const { waiting, needsAttention, online, lastProblem } = input;
  const items = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;
  if (needsAttention > 0) {
    return {
      icon: 'warning',
      title: `${items(needsAttention)} need${needsAttention === 1 ? 's' : ''} attention`,
      body: 'PartsLogic refused these. The rest of the same delivery or count waits behind them.',
    };
  }
  if (waiting > 0 && !online) {
    return { icon: 'offline', title: `${items(waiting)} waiting`, body: 'They’ll send when you’re back online.' };
  }
  if (waiting > 0) {
    return {
      icon: 'outbox',
      title: `Sending ${items(waiting)}`,
      body: lastProblem ? `The last try didn’t get through (${lastProblem}). Trying again shortly.` : 'This takes a moment.',
    };
  }
  return { icon: 'sent', title: 'All sent', body: 'Nothing is waiting to send.' };
}
