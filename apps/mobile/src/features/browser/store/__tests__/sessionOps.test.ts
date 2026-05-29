import {
  upsertSession,
  removeSession,
  touchSession,
  updateSessionChain,
  findSession,
} from "../sessionOps";
import type { DAppSession } from "../useDAppSessionsStore";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}
function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

const A = "https://app.uniswap.org";
const B = "https://app.aave.com";
const ADDR = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function run(): void {
  // upsert adds a new session with id + timestamps
  let acc = upsertSession([], { origin: A, accountAddress: ADDR, chainId: 84532 }, "id1", "t0");
  let sessions: DAppSession[] = acc.sessions;
  assertEqual(sessions.length, 1, "one session after first upsert");
  assertEqual(acc.session.id, "id1", "id assigned");
  assertEqual(acc.session.approvedAt, "t0", "approvedAt set");
  assertEqual(acc.session.lastUsedAt, "t0", "lastUsedAt set");

  // upsert same origin replaces (no duplicate), keeps newest chainId
  acc = upsertSession(sessions, { origin: A, accountAddress: ADDR, chainId: 1 }, "id2", "t1");
  sessions = acc.sessions;
  assertEqual(sessions.length, 1, "upsert same origin replaces");
  assertEqual(findSession(sessions, A)?.chainId, 1, "replacement keeps newest chainId");

  // second origin coexists
  acc = upsertSession(sessions, { origin: B, accountAddress: ADDR, chainId: 84532 }, "id3", "t2");
  sessions = acc.sessions;
  assertEqual(sessions.length, 2, "two distinct origins");

  // findSession
  assert(findSession(sessions, A) !== null, "find A");
  assertEqual(findSession(sessions, "https://nope.xyz"), null, "missing origin -> null");

  // touchSession updates only the matching origin's lastUsedAt
  const touched = touchSession(sessions, A, "t9");
  assertEqual(findSession(touched, A)?.lastUsedAt, "t9", "touch updates lastUsedAt");
  assertEqual(findSession(touched, B)?.lastUsedAt, "t2", "touch leaves others");

  // updateSessionChain bumps chain + lastUsedAt
  const chained = updateSessionChain(sessions, B, 11155111, "t10");
  assertEqual(findSession(chained, B)?.chainId, 11155111, "chain updated");
  assertEqual(findSession(chained, B)?.lastUsedAt, "t10", "chain update bumps lastUsedAt");

  // removeSession
  const removed = removeSession(sessions, A);
  assertEqual(removed.length, 1, "remove drops one");
  assertEqual(findSession(removed, A), null, "removed origin gone");

  console.log("OK sessionOps");
}

run();
