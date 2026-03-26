import { GoogleAuth } from "google-auth-library";

const GOOGLE_API_SCOPE = ["https://www.googleapis.com/auth/cloud-platform"];

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

export function hasGoogleServiceAccount() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON);
}

export async function getGoogleAuthToken() {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: GOOGLE_API_SCOPE,
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token || null;
}

export async function googleApiFetch(url: string, init?: RequestInit) {
  const token = await getGoogleAuthToken();
  if (!token) {
    return null;
  }

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export async function runBigQueryQuery(projectId: string, query: string) {
  const response = await googleApiFetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
    method: "POST",
    body: JSON.stringify({
      query,
      useLegacySql: false,
    }),
  });

  if (!response) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`BigQuery query failed with ${response.status}`);
  }

  return response.json();
}
