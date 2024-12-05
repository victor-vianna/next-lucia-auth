import { emailVerificationCodes } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { isWithinExpirationDate } from "oslo";
import { TRPCContext } from "../../trpc";
import { VerifyCodeInput } from "./verify-code.input";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth";

export async function verifyCodeService(ctx: TRPCContext, input: VerifyCodeInput) {
  console.log(input);
  const verificationRecord = await ctx.db.query.emailVerificationCodes.findFirst({
    where: (table, { eq }) => eq(table.id, input.verificationCodeId),
  });

  if (!verificationRecord) {
    return { success: false, error: "Código de verificação não encontrado." };
  }

  if (verificationRecord.code != input.code) {
    return { sucess: false, error: "Código inválido." };
  }

  if (!isWithinExpirationDate(verificationRecord.expiresAt)) {
    return { success: false, error: "Código expirado" };
  }

  const session = await lucia.createSession(verificationRecord.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  await ctx.db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.id, input.verificationCodeId));

  return { success: true };
}
