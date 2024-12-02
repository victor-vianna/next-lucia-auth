import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/trpc/server";
import React from "react";
import VerifyCodeComponent from "./verify-code";

async function VerifyEmail({ params }: { params: { id: string } }) {
  if (!params.id) return <h1>ERROR</h1>;

  const emailVerification = await api.user.getVerificationEmailById.query(params.id);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verificação de Email</CardTitle>
        <CardDescription>
          Um código de verificação foi enviado ao seu email ({emailVerification.email}), digite o
          código abaixo para acessar a plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyCodeComponent verificationCodeId={params.id} />
      </CardContent>
    </Card>
  );
}

export default VerifyEmail;
