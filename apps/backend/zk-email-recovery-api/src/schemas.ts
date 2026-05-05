import { z } from "zod";

export const AcceptanceRequestSchema = z.object({
  controllerEthAddr: z.string().regex(/^0x[0-9a-f]{40}$/),
  guardianEmailAddr: z.string().email(),
  templateIdx: z.number().int().nonnegative().optional(),
  command: z.string().min(1),
});

export type AcceptanceRequest = z.infer<typeof AcceptanceRequestSchema>;

export const RecoveryRequestSchema = z.object({
  controllerEthAddr: z.string().regex(/^0x[0-9a-f]{40}$/),
  guardianEmailAddr: z.string().email(),
  templateIdx: z.number().int().nonnegative().optional(),
  command: z.string().min(1),
  chainId: z.number().int().positive().optional(),
});

export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;

export const RequestStatusSchema = z.object({
  requestId: z.string().min(1),
});

export type RequestStatusRequest = z.infer<typeof RequestStatusSchema>;

export const CompleteRequestSchema = z.object({
  controllerEthAddr: z.string().regex(/^0x[0-9a-f]{40}$/),
  recoveryData: z.string().min(1),
});

export type CompleteRequest = z.infer<typeof CompleteRequestSchema>;

export const AccountSaltSchema = z.object({
  controllerEthAddr: z.string().regex(/^0x[0-9a-f]{40}$/),
  guardianEmailAddr: z.string().email(),
});

export type AccountSaltRequest = z.infer<typeof AccountSaltSchema>;

export const SendGroupRecoveryRequestsSchema = z.object({
  groupId: z.string().uuid(),
});

export type SendGroupRecoveryRequests = z.infer<typeof SendGroupRecoveryRequestsSchema>;

export const PollGroupStatusSchema = z.object({
  groupId: z.string().uuid(),
});

export type PollGroupStatusRequest = z.infer<typeof PollGroupStatusSchema>;
