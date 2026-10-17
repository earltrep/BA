// Pure-frontend Google Drive upload via Google Identity Services (GIS).
// Uses only a PUBLIC OAuth Client ID (no client secret, no backend) and the
// minimal drive.file scope (the app can only see/manage files it creates).
const SCOPE = "https://www.googleapis.com/auth/drive.file";
let gisPromise = null;

export function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error("Couldn't load Google. Check your connection.")); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export async function getAccessToken(clientId) {
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp && resp.access_token) resolve(resp.access_token);
          else reject(new Error(resp && resp.error ? resp.error : "Google authorization failed."));
        },
        error_callback: (err) => reject(new Error(err && err.message ? err.message : "Google authorization was cancelled.")),
      });
      client.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Google authorization failed."));
    }
  });
}

export async function uploadToDrive(token, filename, jsonString) {
  const boundary = "budgetly" + Math.random().toString(16).slice(2);
  const metadata = { name: filename, mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    jsonString +
    `\r\n--${boundary}--`;
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status}). ${t.slice(0, 140)}`);
  }
  return res.json();
}
