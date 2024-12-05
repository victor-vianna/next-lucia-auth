import { createTRPCRouter, publicProcedure } from "../../trpc";
import { verifyCodeInput } from "./verify-code.input";
import { verifyCodeService } from "./verify-code.services";

export const verificationCodeRouter = createTRPCRouter({
  verifyCode: publicProcedure
    .input(verifyCodeInput)
    .mutation(async ({ ctx, input }) => verifyCodeService(ctx, input)),
});
