import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Request Google Sheets, Google Drive file scope, and basic profile info
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");
provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

// Force Google to issue a Refresh Token
provider.setCustomParameters({
  access_type: "offline",
  prompt: "consent"
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Helper to check if a token is still valid (e.g., less than 50 minutes old)
const isTokenValid = (timestampStr: string | null): boolean => {
  if (!timestampStr) return false;
  const elapsed = Date.now() - parseInt(timestampStr, 10);
  return elapsed < 50 * 60 * 1000; // 50 minutes
};

// Auto-refresh token if needed
export const getValidAccessToken = async (): Promise<string | null> => {
  let token = localStorage.getItem("gapi_access_token");
  const timestamp = localStorage.getItem("gapi_token_timestamp");
  const refreshToken = localStorage.getItem("gapi_refresh_token");

  if (token && isTokenValid(timestamp)) {
    cachedAccessToken = token;
    return token;
  }

  // If expired or missing, try to renew using the Refresh Token
  if (refreshToken) {
    console.log("Access token expired/missing, attempting to renew with Refresh Token...");
    try {
      const response = await fetch("/api/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to call refresh token API");
      }

      const data = await response.json();
      if (data.accessToken) {
        token = data.accessToken;
        localStorage.setItem("gapi_access_token", token!);
        localStorage.setItem("gapi_token_timestamp", Date.now().toString());
        cachedAccessToken = token;
        return token;
      }
    } catch (error) {
      console.error("Error refreshing Google Access Token:", error);
      // Clean up invalid tokens if refresh fails
      localStorage.removeItem("gapi_access_token");
      localStorage.removeItem("gapi_token_timestamp");
      localStorage.removeItem("gapi_refresh_token");
    }
  }

  return null;
};

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Try to get a valid token (recovering from page refresh)
      const validToken = await getValidAccessToken();
      if (validToken) {
        if (onAuthSuccess) onAuthSuccess(user, validToken);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google Auth");
    }

    const token = credential.accessToken;
    cachedAccessToken = token;
    localStorage.setItem("gapi_access_token", token);
    localStorage.setItem("gapi_token_timestamp", Date.now().toString());

    // Extract Refresh Token from Google Auth result
    const refreshToken = (result as any)._tokenResponse?.refreshToken;
    if (refreshToken) {
      localStorage.setItem("gapi_refresh_token", refreshToken);
    }

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("gapi_access_token");
  localStorage.removeItem("gapi_token_timestamp");
  localStorage.removeItem("gapi_refresh_token");
};
