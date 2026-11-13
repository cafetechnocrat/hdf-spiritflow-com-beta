// The page sizes of the lists that are read a page at a time. Kept apart from the
// pager component so server code can use them: a value imported from a client
// component is not usable on the server. Safe to import anywhere.
export const PAGE_SIZES = [10, 25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 10;
