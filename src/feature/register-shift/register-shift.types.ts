import { z } from 'zod';

export const OpenShiftSchema = z.object({
    startBalance: z.number().nonnegative().default(0),
    notes: z.string().max(1000).optional().nullable()
});

export type TOpenShift = z.infer<typeof OpenShiftSchema>;

export const CloseShiftSchema = z.object({
    actualBalance: z.number().nonnegative(),
    notes: z.string().max(1000).optional().nullable()
});

export type TCloseShift = z.infer<typeof CloseShiftSchema>;

export const RegisterShiftResponseSchema = z.object({
    id: z.string(),
    cashierId: z.string(),
    openedAt: z.date().or(z.string()),
    closedAt: z.date().nullable().or(z.string().nullable()),
    startBalance: z.number(),
    endBalance: z.number().nullable(),
    actualBalance: z.number().nullable(),
    notes: z.string().nullable()
});

export type TRegisterShiftResponse = z.infer<typeof RegisterShiftResponseSchema>;
