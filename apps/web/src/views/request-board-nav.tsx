import { createContext, useContext, type Child } from "hono/jsx";

/**
 * VNX-2705b (M1): whether the public request board is open (flag AND go-live date), as the site middleware computed it for this request.
 * page() provides it; Layout and ForBuildersPage read it, so views never import db/ or http/. Default false: a Layout rendered outside page()
 * (unit tests, any future path) shows no board link, the safe side.
 */
const BoardOpenContext = createContext<boolean>(false);

export function withBoardOpen(open: boolean, node: Child) {
  return <BoardOpenContext.Provider value={open}>{node}</BoardOpenContext.Provider>;
}

/** Call during render (reads the context). */
export function boardOpen(): boolean {
  return useContext(BoardOpenContext);
}
