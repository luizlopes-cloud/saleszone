import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Google Service Account JWT Auth ----
function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function str2ab(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function createSignedJwt(
  serviceAccountEmail: string,
  privateKey: CryptoKey,
  subject: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: subject,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64url(str2ab(JSON.stringify(header)));
  const payloadB64 = base64url(str2ab(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    str2ab(unsigned)
  );
  const signatureB64 = base64url(new Uint8Array(signature));
  return `${unsigned}.${signatureB64}`;
}

async function getAccessToken(
  serviceAccountEmail: string,
  privateKey: CryptoKey,
  subject: string
): Promise<string> {
  const jwt = await createSignedJwt(serviceAccountEmail, privateKey, subject);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ---- Email Helpers ----
function buildEmailHtml(toName: string, inviterName: string, role: string): string {
  const dashboardUrl = "https://squad-dashboard-eight.vercel.app";
  const roleLabel = role === "diretor" ? "Diretor" : "Operador";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F3F3F5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 12px; border: 1px solid #E6E7EA; overflow: hidden;">
          <tr>
            <td style="background: #080E32; padding: 24px; text-align: center;">
              <span style="color: #FFFFFF; font-size: 18px; font-weight: 600;">Acompanhamento de Vendas</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; color: #080E32; margin: 0 0 16px;">Olá <strong>${toName}</strong>,</p>
              <p style="font-size: 14px; color: #525670; line-height: 1.6; margin: 0 0 16px;">
                <strong>${inviterName}</strong> convidou você para acessar o dashboard de Acompanhamento de Vendas da Seazone como <strong>${roleLabel}</strong>.
              </p>
              <p style="font-size: 14px; color: #525670; line-height: 1.6; margin: 0 0 24px;">
                Clique no botão abaixo para acessar usando seu email @seazone.com.br:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 32px; background-color: #0055FF; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                      Acessar Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #9C9FAD; margin: 24px 0 0; text-align: center;">
                Este convite expira em 30 dias.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRawEmail(to: string, toName: string, subject: string, html: string, from: string): string {
  const boundary = "boundary_" + Date.now();
  const raw = [
    `From: Acompanhamento Vendas <${from}>`,
    `To: ${toName} <${to}>`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
    `--${boundary}--`,
  ].join("\r\n");
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---- Main Handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, inviterName, role, full_name } = await req.json();
    if (!to || !inviterName || !role) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load SA from Vault
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: secretData, error: secretErr } = await sb.rpc("vault_read_secret", {
      secret_name: "GOOGLE_SERVICE_ACCOUNT",
    });
    if (secretErr || !secretData) {
      throw new Error(`Vault error: ${secretErr?.message || "no data"}`);
    }

    const saJson = JSON.parse(secretData);
    const privateKey = await importPrivateKey(saJson.private_key);

    // Impersonate noreply@seazone.com.br for sending
    const senderEmail = "noreply@seazone.com.br";
    const accessToken = await getAccessToken(saJson.client_email, privateKey, senderEmail);

    const toName = full_name || to.split("@")[0];
    const subject = `Convite: Acompanhamento de Vendas Seazone`;
    const html = buildEmailHtml(toName, inviterName, role);
    const rawMessage = buildRawEmail(to, toName, subject, html, senderEmail);

    // Send via Gmail API
    const gmailRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawMessage }),
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} ${errText}`);
    }

    const result = await gmailRes.json();
    console.log(`Email sent to ${to}, messageId: ${result.id}`);

    return new Response(JSON.stringify({ ok: true, messageId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-invite-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
