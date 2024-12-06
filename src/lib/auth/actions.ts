"use server";

/* eslint @typescript-eslint/no-explicit-any:0, @typescript-eslint/prefer-optional-chain:0 */

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateId, Scrypt } from "lucia";
import { isWithinExpirationDate, TimeSpan, createDate } from "oslo";
import { generateRandomString, alphabet } from "oslo/crypto";
import { eq } from "drizzle-orm";
import { lucia } from "@/lib/auth";
import { db } from "@/server/db";
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
  resetPasswordSchema,
  verifyCodeSchema,
} from "@/lib/validators/auth";
import { emailVerificationCodes, passwordResetTokens, users } from "@/server/db/schema";
import { sendMail, EmailTemplate } from "@/lib/email";
import { validateRequest } from "@/lib/auth/validate-request";
import { Paths } from "../constants";
import { env } from "@/env";
import { resend } from "../services/email";

export interface ActionResponse<T> {
  fieldError?: Partial<Record<keyof T, string | undefined>>;
  formError?: string;
}

export async function login(_: any, formData: FormData): Promise<ActionResponse<LoginInput>> {
  const obj = Object.fromEntries(formData.entries());

  const parsed = loginSchema.safeParse(obj);
  if (!parsed.success) {
    const err = parsed.error.flatten();
    return {
      fieldError: {
        email: err.fieldErrors.email?.[0],
        // password: err.fieldErrors.password?.[0],
      },
    };
  }

  const { email } = parsed.data;

  const existingUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.email, email),
  });

  if (!existingUser) {
    return {
      formError: "Email ou senha incorreta",
    };
  }
  // Gerar código aleatório

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Definir a validade do código

  const expiresAt = new Date(Date.now() + 100 * 60 * 1000); // 10 minutos

  // Inserir código no banco de dados

  const insertVerificationResponse = await db
    .insert(emailVerificationCodes)
    .values({
      userId: existingUser.id,
      email,
      code,
      expiresAt,
    })
    .returning({ insertedId: emailVerificationCodes.id });
  const insertedId = insertVerificationResponse[0]?.insertedId;
  if (!insertedId) {
    return {
      formError: "Oops,  houve um erro ao criar código de verificação.",
    };
  }
  // Enviar email com resend

  const resendResponse = await resend.emails.send({
    from: "Acme <onboarding@resend.dev>",
    to: email,
    subject: "Seu código de verificação",
    html: `<p>Seu código de verificação é <strong>${code}</strong>. Ele expira em 10 minutos.</p>`,
  });
  console.log(resendResponse);
  redirect(`/verify-email/${insertedId}`);
}

export async function verifyCode(_: any, formData: FormData) {
  // 1. Extrair os dados do formulário

  const obj = Object.fromEntries(formData.entries());
  const { email, code } = obj as { email?: string; code?: string };

  // 2. Validar os dados

  if (!email || !code) {
    return { error: "E-mail e código são obrigatórios." };
  }
  if (length != 6) {
    return { error: "Código de verificação inválido." };
  }

  // 3. Buscar o código no banco de dados

  const verificationData = await db.query.emailVerificationCodes.findFirst({
    where: (table, { eq }) => eq(table.email, email),
  });

  // 4. Validar a data de expiração

  if (!verificationData || verificationData.code !== code) {
    return { error: "Código de verificação incorreto." };
  }

  if (!isWithinExpirationDate(verificationData.expiresAt)) {
    return { errorr: "O código de verificação expirou." };
  }

  // 5. Atualizar o usuário como verificado

  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.email, email),
  });

  if (!user) {
    return { error: "usuário não encontrado." };
  }

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
  // 6. Redirecionar

  return redirect("/dashboard");
}

export async function validateVerificationCode(_: any, formData: FormData) {
  const obj = Object.fromEntries(formData.entries());

  const parsed = verifyCodeSchema.safeParse(obj);
  if (!parsed.success) {
    const err = parsed.error.flatten();
    return {
      fieldError: {
        code: err.fieldErrors.code?.[0],
        // password: err.fieldErrors.password?.[0],
      },
    };
  }
  const { code, verificationCodeId } = parsed.data;

  const verificationRecord = await db.query.emailVerificationCodes.findFirst({
    where: (table, { eq }) => eq(table.id, verificationCodeId),
  });
  if (!verificationRecord) {
    return { formError: "Código de verificação não encontrado." };
  }

  if (verificationRecord.code != code) {
    return { formError: "Código inválido." };
  }

  if (!isWithinExpirationDate(verificationRecord.expiresAt)) {
    return { formError: "Código expirado" };
  }

  const session = await lucia.createSession(verificationRecord.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, verificationCodeId));

  redirect(`/dashboard`);
}

export async function signup(_: any, formData: FormData): Promise<ActionResponse<SignupInput>> {
  const obj = Object.fromEntries(formData.entries());

  const parsed = signupSchema.safeParse(obj);
  if (!parsed.success) {
    const err = parsed.error.flatten();
    return {
      fieldError: {
        email: err.fieldErrors.email?.[0],
        password: err.fieldErrors.password?.[0],
      },
    };
  }

  const { email, password } = parsed.data;

  const existingUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.email, email),
    columns: { email: true },
  });

  if (existingUser) {
    return {
      formError: "Cannot create account with that email",
    };
  }

  const userId = generateId(21);
  const hashedPassword = await new Scrypt().hash(password);
  await db.insert(users).values({
    id: userId,
    email,
    hashedPassword,
  });

  const verificationCode = await generateEmailVerificationCode(userId, email);
  await sendMail(email, EmailTemplate.EmailVerification, { code: verificationCode });

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  return redirect(Paths.VerifyEmail);
}

export async function logout(): Promise<{ error: string } | void> {
  const { session } = await validateRequest();
  if (!session) {
    return {
      error: "No session found",
    };
  }
  await lucia.invalidateSession(session.id);
  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  return redirect("/");
}

export async function resendVerificationEmail(): Promise<{
  error?: string;
  success?: boolean;
}> {
  const { user } = await validateRequest();
  if (!user) {
    return redirect(Paths.Login);
  }
  const lastSent = await db.query.emailVerificationCodes.findFirst({
    where: (table, { eq }) => eq(table.userId, user.id),
    columns: { expiresAt: true },
  });

  if (lastSent && isWithinExpirationDate(lastSent.expiresAt)) {
    return {
      error: `Please wait ${timeFromNow(lastSent.expiresAt)} before resending`,
    };
  }
  const verificationCode = await generateEmailVerificationCode(user.id, user.email);
  await sendMail(user.email, EmailTemplate.EmailVerification, { code: verificationCode });

  return { success: true };
}

export async function verifyEmail(_: any, formData: FormData): Promise<{ error: string } | void> {
  const code = formData.get("code");
  if (typeof code !== "string" || code.length !== 8) {
    return { error: "Invalid code" };
  }
  const { user } = await validateRequest();
  if (!user) {
    return redirect(Paths.Login);
  }

  const dbCode = await db.transaction(async (tx) => {
    const item = await tx.query.emailVerificationCodes.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    if (item) {
      await tx.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, item.id));
    }
    return item;
  });

  if (!dbCode || dbCode.code !== code) return { error: "Invalid verification code" };

  if (!isWithinExpirationDate(dbCode.expiresAt)) return { error: "Verification code expired" };

  if (dbCode.email !== user.email) return { error: "Email does not match" };

  await lucia.invalidateUserSessions(user.id);
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  redirect(Paths.Dashboard);
}

export async function sendPasswordResetLink(
  _: any,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email");
  const parsed = z.string().trim().email().safeParse(email);
  if (!parsed.success) {
    return { error: "Provided email is invalid." };
  }
  try {
    const user = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.email, parsed.data),
    });

    if (!user || !user.emailVerified) return { error: "Provided email is invalid." };

    const verificationToken = await generatePasswordResetToken(user.id);

    const verificationLink = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${verificationToken}`;

    await sendMail(user.email, EmailTemplate.PasswordReset, { link: verificationLink });

    return { success: true };
  } catch (error) {
    return { error: "Failed to send verification email." };
  }
}

export async function resetPassword(
  _: any,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const obj = Object.fromEntries(formData.entries());

  const parsed = resetPasswordSchema.safeParse(obj);

  if (!parsed.success) {
    const err = parsed.error.flatten();
    return {
      error: err.fieldErrors.password?.[0] ?? err.fieldErrors.token?.[0],
    };
  }
  const { token, password } = parsed.data;

  const dbToken = await db.transaction(async (tx) => {
    const item = await tx.query.passwordResetTokens.findFirst({
      where: (table, { eq }) => eq(table.id, token),
    });
    if (item) {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, item.id));
    }
    return item;
  });

  if (!dbToken) return { error: "Invalid password reset link" };

  if (!isWithinExpirationDate(dbToken.expiresAt)) return { error: "Password reset link expired." };

  await lucia.invalidateUserSessions(dbToken.userId);
  const hashedPassword = await new Scrypt().hash(password);
  await db.update(users).set({ hashedPassword }).where(eq(users.id, dbToken.userId));
  const session = await lucia.createSession(dbToken.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  redirect(Paths.Dashboard);
}

const timeFromNow = (time: Date) => {
  const now = new Date();
  const diff = time.getTime() - now.getTime();
  const minutes = Math.floor(diff / 1000 / 60);
  const seconds = Math.floor(diff / 1000) % 60;
  return `${minutes}m ${seconds}s`;
};

async function generateEmailVerificationCode(userId: string, email: string): Promise<string> {
  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
  const code = generateRandomString(8, alphabet("0-9")); // 8 digit code
  await db.insert(emailVerificationCodes).values({
    userId,
    email,
    code,
    expiresAt: createDate(new TimeSpan(10, "m")), // 10 minutes
  });
  return code;
}

async function generatePasswordResetToken(userId: string): Promise<string> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  const tokenId = generateId(40);
  await db.insert(passwordResetTokens).values({
    id: tokenId,
    userId,
    expiresAt: createDate(new TimeSpan(2, "h")),
  });
  return tokenId;
}
