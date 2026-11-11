import { getApiUrl } from "./config";
import { firebaseAuth } from "../firebase";

export async function notifyWhatsApp(event: "ad" | "new-user" | "load", data: Record<string, any>): Promise<void> {
  try {
    let token = "";
    try {
      token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : "";
    } catch {}
    await fetch(`${getApiUrl()}/whatsapp-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event, data }),
    });
  } catch {}
}
