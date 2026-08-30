/**
 * THE SWAP FILE. Point `remotePeople` at PDL instead of Coresignal here and nowhere else.
 * If that edit is not enough, the abstraction is wrong (core rule 1).
 */
export { coresignalSource as remotePeople } from "./coresignal";
export { localSource } from "./local";
