import { z } from "zod";

export const verifyCodeInput = z.object({
  code: z.string(),
  verificationCodeId: z.string().uuid("ID de verificação inálido."),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeInput>;
