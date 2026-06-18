import type { Address } from "viem";
import { decodeBundlerError } from "@/src/integration/viem/revertDecoding";
import type { AssetDelta, GasFee, SimulationResult, TxPreview } from "../types/txPreview";
import type { AssetSimulationProvider } from "./assetSim/AssetSimulationProvider";

type PreflightClient = {
  call: (args: { account: Address; to: Address; data: `0x${string}`; value: bigint }) => Promise<{ data?: `0x${string}` }>;
};

export type SimulateDeps = {
  gasFee: GasFee;
  client: PreflightClient;
  provider: AssetSimulationProvider;
  timeoutMs?: number;
};

const withTimeout = async <T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(onTimeout()), ms); });
  try { return await Promise.race([p, t]); } finally { clearTimeout(timer!); }
};

export class SimulationService {
  static async simulate(preview: TxPreview, deps: SimulateDeps): Promise<SimulationResult> {
    const primary = preview.calls[0];

    // 1) preflight: does the inner call revert?
    //
    // Swap/bridge inner calls target a DEX router (Uniswap SwapRouter02) or an
    // Across SpokePool. A standalone eth_call from the smart-account address to
    // those contracts does NOT reproduce EntryPoint execution context and yields
    // FALSE reverts (e.g. router pay()/wrap branches, transferFrom accounting).
    // For these flows the bundler's eth_estimateUserOperationGas — already run
    // inside prepareUserOperation before this sheet is shown — is the
    // authoritative simulation: if the op would revert, preparation throws and we
    // never reach here. So we skip the redundant, false-positive preflight and
    // surface the quote-derived deltas. `send` and `dapp` keep the preflight,
    // where a direct eth_call faithfully models the inner call (ADR 0013).
    const shouldPreflight = preview.kind === "send" || preview.kind === "dapp";
    let status: SimulationResult["status"] = "success";
    let revertReason: string | undefined;
    if (primary && shouldPreflight) {
      try {
        await deps.client.call({ account: preview.account, to: primary.to, data: primary.data, value: primary.value });
      } catch (err) {
        status = "revert";
        revertReason = decodeBundlerError(err) ?? "Transaction is expected to fail";
      }
    }

    if (status === "revert") {
      return { status, revertReason, gasFee: deps.gasFee, source: "preflight" };
    }

    // 2) deltas: dapp escalates to provider; own flows use derived preview deltas
    if (preview.kind === "dapp") {
      const sim = primary
        ? await withTimeout(
            deps.provider.simulate({ account: preview.account, chainId: preview.network.chainId, call: primary }),
            deps.timeoutMs ?? 6000,
            () => null,
          )
        : null;
      if (sim) {
        const assetDeltas: AssetDelta[] = sim.deltas.map((d) => ({
          symbol: d.symbol,
          iconAddress: d.contractAddress,
          direction: d.direction,
          amountRaw: d.rawAmount,
          amountDisplay: d.amountDisplay,
          chainId: preview.network.chainId,
          kind: "transfer" as const,
        }));
        return { status: "success", assetDeltas, warnings: sim.warnings, gasFee: deps.gasFee, source: "provider" };
      }
      // preflight passed but no provider deltas — unknown
      return { status: "unknown", gasFee: deps.gasFee, source: "preflight" };
    }

    // own flows: outcome already known from intent/quote (preview.assetDeltas)
    return { status: "success", gasFee: deps.gasFee, source: "derived" };
  }
}
