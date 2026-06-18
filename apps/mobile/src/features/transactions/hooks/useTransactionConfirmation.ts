import { useCallback, useRef, useState } from "react";
import { formatEther } from "viem";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { getPublicClient } from "@/src/integration/viem/clients";
import { SmartAccountExecutionService } from "@features/wallet/services/SmartAccountExecutionService";
import type { PreparedSmartAccountExecution, PreparedUserOperation } from "@features/wallet/types/execution";
import { SimulationService } from "../services/SimulationService";
import { NullAssetSimulationProvider, type AssetSimulationProvider } from "../services/assetSim/AssetSimulationProvider";
import { resolveAssetSimProvider } from "../services/assetSim/resolveAssetSimProvider";
import type { GasFee, SimulationResult, TxPreview } from "../types/txPreview";

type ConfirmArgs = {
  preview: TxPreview;
  execution: PreparedSmartAccountExecution;
  userId: string;
  usePaymaster?: boolean;
};

const gasFeeFromUserOp = (op: PreparedUserOperation["userOp"], sponsored: boolean): GasFee => {
  const total =
    (op.callGasLimit ?? 0n) +
    (op.verificationGasLimit ?? 0n) +
    (op.preVerificationGas ?? 0n);
  const wei = total * (op.maxFeePerGas ?? 0n);
  return { nativeDisplay: `${Number(formatEther(wei)).toFixed(6)} ETH`, sponsored };
};

export function useTransactionConfirmation() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const decisionRef = useRef<boolean>(false);
  const [preview, setPreview] = useState<TxPreview | undefined>();
  const [simulation, setSimulation] = useState<SimulationResult | undefined>();
  const [gasFee, setGasFee] = useState<GasFee | undefined>();
  const [loading, setLoading] = useState(false);

  // Settle the pending confirm() promise exactly once, then clear the resolver so
  // any further calls (double-fire, late dismiss) are harmless no-ops.
  const settle = useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(ok);
  }, []);

  const confirm = useCallback(
    async (args: ConfirmArgs): Promise<{ approved: boolean; prepared?: PreparedUserOperation }> => {
      // Defensively settle any orphaned prior round before starting a new one.
      settle(false);

      setPreview(args.preview);
      setSimulation(undefined);
      setGasFee(undefined);
      setLoading(true);
      decisionRef.current = false;

      // Wire the resolver SYNCHRONOUSLY — before present() and before any await.
      // Resolution happens in onDismiss (the single canonical "sheet closed"
      // event). This guarantees that dismissing the sheet at ANY point — including
      // during the async prepare/simulate window below — settles this promise
      // instead of orphaning it (which previously wedged the whole flow and left
      // the sheet unable to re-open on the next attempt).
      const decision = new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });

      sheetRef.current?.present();

      let prepared: PreparedUserOperation | undefined;
      try {
        if (args.preview.requiresPriorApproval) {
          // Deferred-prepare path: the swap UserOp would revert during bundler gas
          // estimation (transferFrom fails with no allowance). Skip prepareUserOperation
          // and SimulationService — show derived deltas with a sponsored gas placeholder.
          const fee: GasFee = { nativeDisplay: "—", sponsored: args.usePaymaster ?? true };
          setGasFee(fee);
          setSimulation({
            status: "success",
            source: "derived",
            gasFee: fee,
            warnings: ["Token approval required first — you'll sign twice"],
          });
          setLoading(false);
        } else {
          // Normal path: prepare + (derived) simulation before the user taps Approve.
          prepared = await SmartAccountExecutionService.prepareUserOperation(args.execution, {
            userId: args.userId,
            usePaymaster: args.usePaymaster ?? true,
          });
          // If the user already dismissed during preparation, the promise is
          // settled and the sheet is gone — skip the now-pointless simulation.
          if (resolverRef.current !== null) {
            const fee = gasFeeFromUserOp(prepared.userOp, !!prepared.paymasterUrl);
            setGasFee(fee);
            const provider: AssetSimulationProvider =
              resolveAssetSimProvider(args.preview.network) ?? new NullAssetSimulationProvider();
            const client = getPublicClient(args.preview.network.chainId);
            const result = await SimulationService.simulate(args.preview, {
              gasFee: fee,
              client: client as any,
              provider,
            });
            setSimulation(result);
          }
          setLoading(false);
        }
      } catch (err) {
        // Preparation failed — settle as rejected, close the sheet, and rethrow so
        // the caller surfaces the error and resets its own UI state.
        setLoading(false);
        settle(false);
        sheetRef.current?.dismiss();
        throw err;
      }

      const approved = await decision;
      return { approved, prepared };
    },
    [settle],
  );

  const onApprove = useCallback(() => {
    decisionRef.current = true;
    sheetRef.current?.dismiss(); // settles via onDismiss once the sheet closes
  }, []);

  const onReject = useCallback(() => {
    decisionRef.current = false;
    sheetRef.current?.dismiss(); // settles via onDismiss once the sheet closes
  }, []);

  // Canonical close event — fires once when the sheet finishes closing for ANY
  // reason (Approve, Reject, pan-down, backdrop tap). Guarantees the confirm()
  // promise settles exactly once with the recorded decision (default: rejected).
  const onDismiss = useCallback(() => {
    settle(decisionRef.current);
  }, [settle]);

  return { sheetRef, preview, simulation, gasFee, loading, confirm, onApprove, onReject, onDismiss };
}
