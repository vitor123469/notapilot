import "server-only";

export type SendWhatsAppResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export async function sendWhatsApp(input: {
  to: string;
  body: string;
}): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_FROM not configured",
    };
  }

  const toPhone = input.to.startsWith("whatsapp:") ? input.to : `whatsapp:${input.to}`;
  const fromPhone = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const body = new URLSearchParams({
    To: toPhone,
    From: fromPhone,
    Body: input.body,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const responseText = await response.text();
    let responseJson: Record<string, unknown> = {};
    try {
      responseJson = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // leave empty
    }

    if (!response.ok) {
      const errorMessage =
        typeof responseJson.message === "string"
          ? responseJson.message
          : `Twilio HTTP ${response.status}`;
      return { ok: false, error: errorMessage };
    }

    const sid = typeof responseJson.sid === "string" ? responseJson.sid : "";
    return { ok: true, sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return { ok: false, error: message };
  }
}
