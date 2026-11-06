export type PageInfo = { limit: number; offset: number; total: number };
export type Page<T> = { rows: T[]; page: PageInfo };
