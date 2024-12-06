"use client";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateVerificationCode } from "@/lib/auth/actions";
import { useRouter } from "next/navigation";
import React from "react";
import { useFormState } from "react-dom";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { toast, Toaster } from "sonner";

function VerifyCodeComponent({ verificationCodeId }: { verificationCodeId: string }) {
  // Create a wrapper action that appends verificationCodeId to FormData
  const formAction = async (prevState: any, formData: FormData) => {
    formData.append("verificationCodeId", verificationCodeId);
    return validateVerificationCode(prevState, formData);
  };

  const [state, dispatch] = useFormState(formAction, null);

  return (
    <Card className="w-full max-w-md bg-slate-100">
      <CardContent>
        <form action={dispatch} className="grid gap-8 p-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código de Verificação</Label>
            <InputOTP
              required
              id="code"
              autoComplete="code"
              name="code"
              type="text"
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {/* <Input
              required
              id="code"
              placeholder="******"
              autoComplete="code"
              name="code"
              type="text"
            /> */}
          </div>

          {state?.fieldError ? (
            <ul className="list-disc space-y-1 rounded-lg border bg-destructive/10 p-2 text-[0.8rem] font-medium text-destructive">
              {Object.values(state.fieldError).map((err) => (
                <li className="ml-4" key={err}>
                  {err}
                </li>
              ))}
            </ul>
          ) : state?.formError ? (
            <p className="rounded-lg border bg-destructive/10 p-2 text-[0.8rem] font-medium text-destructive">
              {state?.formError}
            </p>
          ) : null}
          <SubmitButton className="w-full hover:bg-slate-700" aria-label="submit-btn">
            Verificar Código
          </SubmitButton>
        </form>
        <Button onClick={() => toast("Código reenviado!")} variant={"link"}>
          Não recebi o código. Reenviar
        </Button>
      </CardContent>
    </Card>
  );
}

export default VerifyCodeComponent;
