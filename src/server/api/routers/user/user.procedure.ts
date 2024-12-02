import { z } from "zod";
import { protectedProcedure, createTRPCRouter, publicProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => ctx.user),
  getVerificationEmailById: publicProcedure
    .input(
      z.string({
        required_error: "Id da verificação de email não fornecido.",
        invalid_type_error: "Tipo do Id não válido.",
      }),
    )
    .query(async ({ ctx, input }) => {
      const emailVerfication = await ctx.db.query.emailVerificationCodes.findFirst({
        where: (fields, { eq }) => eq(fields.id, input),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              avatar: true,
              email: true,
            },
          },
        },
      });
      if (!emailVerfication)
        throw new TRPCError({
          message: "Código de verificação não encontrado.",
          code: "NOT_FOUND",
        });

      if (new Date() > emailVerfication.expiresAt)
        throw new TRPCError({ message: "Código de verificação expirou.", code: "BAD_REQUEST" });
      return emailVerfication;
    }),
});
