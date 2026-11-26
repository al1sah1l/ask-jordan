/**
 * Sends a password-reset link. Without Resend settings, local development
 * prints the link. Production never prints it.
 */
export async function sendPasswordRecovery(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error("Password recovery email was not sent. Set RESEND_API_KEY and RESEND_FROM.");
      return;
    }
    console.info(`Password recovery link for ${to}: ${link}`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Reset your Ask Jordan password",
        text: [
          "Use this link to choose a new Ask Jordan password.",
          "It expires in 5 minutes and works once.",
          "",
          link,
          "",
          "If you did not ask for this, you can ignore this email.",
        ].join("\n"),
      }),
    });
    if (!response.ok) console.error("Resend refused the recovery email.", response.status);
  } catch {
    console.error("Password recovery email was not sent.");
  }
}
