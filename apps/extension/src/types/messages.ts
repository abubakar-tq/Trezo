export type RpcRequestMsg = {
  type: "trezo-rpc";
  id: string;
  method: string;
  params: unknown[];
  origin?: string; // filled by content script
};

export type RpcResponseMsg = {
  type: "trezo-rpc-response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
};

export type ProviderEventMsg = {
  type: "trezo-event";
  event: string;
  data: unknown;
};
