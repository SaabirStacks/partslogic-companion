import { syncState } from '../sync-state';

describe('syncState', () => {
  it('is green when everything is sent', () => {
    expect(syncState({ waiting: 0, needsAttention: 0, online: true })).toEqual({ tone: 'safe', icon: 'sent', label: 'All sent' });
  });

  it('is yellow while work waits, with the no-signal pictogram when offline', () => {
    expect(syncState({ waiting: 3, needsAttention: 0, online: true })).toEqual({ tone: 'warning', icon: 'waiting', label: '3 waiting' });
    expect(syncState({ waiting: 3, needsAttention: 0, online: false })).toEqual({ tone: 'warning', icon: 'offline', label: '3 waiting' });
  });

  it('says so when offline with nothing waiting', () => {
    expect(syncState({ waiting: 0, needsAttention: 0, online: false })).toEqual({ tone: 'warning', icon: 'offline', label: 'Offline' });
  });

  it('puts problems first, in red', () => {
    expect(syncState({ waiting: 5, needsAttention: 1, online: false })).toEqual({ tone: 'stop', icon: 'stop', label: '1 problem' });
    expect(syncState({ waiting: 0, needsAttention: 2, online: true }).label).toBe('2 problems');
  });
});
