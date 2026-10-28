// PartsLogic's two system bins in every location: UNBINNED, where received stock waits for a shelf, and
// UNASSIGNED, for stock with no bin. They hold stock but can never be counted (open_bin_count refuses them),
// so the phone never offers to count one. PartsLogic names them this way in every location.
export const SYSTEM_BINS: readonly string[] = ['UNBINNED', 'UNASSIGNED'];

export const isSystemBin = (code: string) => SYSTEM_BINS.includes(code.trim().toUpperCase());
