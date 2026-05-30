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
  const [preview, setPreview] = useState<TxPreview | undefined>();
  const [simulation, setSimulation] = useState<SimulationResult | undefined>();
  const [gasFee, setGasFee] = useState<GasFee | undefined>();
  const [loading, setLoading] = useState(false);

  const confirm = useCallback(
    async (args: ConfirmArgs): Promise<{ approved: boolean; prepared?: PreparedUserOperation }> => {
      setPreview(args.preview);
      setSimulation(undefined);
      setGasFee(undefined);
      setLoading(true);
      sheetRef.current?.present();

      const prepared = await SmartAccountExecutionService.prepareUserOperation(args.execution, {
        userId: args.userId,
        usePaymaster: args.usePaymaster ?? true,
      });
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
      setLoading(false);

      const approved = await new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
      return { approved, prepared };
    },
    [],
  );

  const onApprove = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    sheetRef.current?.dismiss();
  }, []);

  const onReject = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    sheetRef.current?.dismiss();
  }, []);

  return { sheetRef, preview, simulation, gasFee, loading, confirm, onApprove, onReject };
}
