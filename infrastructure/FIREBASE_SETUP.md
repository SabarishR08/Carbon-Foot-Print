# Firebase & Google Auth Setup — agentflow-prod-assistant

## Root cause of `auth/configuration-not-found`

Firebase Auth is **not linked** to this GCP project yet. The API key alone is not enough — you need either:

1. **Google OAuth Client ID** (works immediately — already wired in the app), OR
2. **Full Firebase linking** (for Firebase SDK + email/password)

---

## Option A — Google Sign-In (recommended, fastest)

### 1. Create OAuth 2.0 Web Client

1. Open [GCP Credentials](https://console.cloud.google.com/apis/credentials?project=agentflow-prod-assistant)
2. **Create Credentials → OAuth 2.0 Client ID → Web application**
3. Name: `EcoTrack Web`
4. **Authorized JavaScript origins:**
   - `https://carbon-footprint-ui-pamlpivwwa-uc.a.run.app`
   - `http://localhost:5173`
5. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)

### 2. Configure OAuth consent screen (if prompted)

- User type: External
- App name: EcoTrack
- Support email: your email
- Scopes: `email`, `profile`, `openid`

### 3. Redeploy with Client ID

```powershell
$CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com"
$API_URL = "https://carbon-footprint-api-pamlpivwwa-uc.a.run.app"

cd frontend
gcloud builds submit --config=cloudbuild-frontend.yaml `
  --substitutions="_API_URL=$API_URL,_GOOGLE_CLIENT_ID=$CLIENT_ID,_AUTH_ENABLED=false" `
  --project=agentflow-prod-assistant --region=us-central1

gcloud run deploy carbon-footprint-ui `
  --image=us-central1-docker.pkg.dev/agentflow-prod-assistant/carbon-footprint/carbon-footprint-ui:latest `
  --region=us-central1 --project=agentflow-prod-assistant
```

### 4. Set backend Google Client ID

```powershell
gcloud run services update carbon-footprint-api `
  --region=us-central1 --project=agentflow-prod-assistant `
  --update-env-vars="GOOGLE_CLIENT_ID=$CLIENT_ID,ALLOW_GUEST_ACCESS=false"
```

---

## Option B — Full Firebase Auth (email + Google via Firebase SDK)

### 1. Link Firebase (requires Project Owner)

1. [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Select existing GCP project: **agentflow-prod-assistant**
3. Enable Google Analytics (optional)

### 2. Enable sign-in providers

Firebase Console → **Authentication → Sign-in method**:

- ✅ Google
- ✅ Email/Password

### 3. Register Web App

Project Settings → **Your apps → Web** → Register app `EcoTrack`

Copy all config values:

| Env var | Source |
|---------|--------|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |

### 4. Redeploy with full Firebase config

```powershell
gcloud builds submit --config=cloudbuild-frontend.yaml `
  --substitutions="_API_URL=$API_URL,_AUTH_ENABLED=true,_FIREBASE_API_KEY=...,_FIREBASE_AUTH_DOMAIN=...,_FIREBASE_STORAGE_BUCKET=...,_FIREBASE_MESSAGING_SENDER_ID=...,_FIREBASE_APP_ID=...,_GOOGLE_CLIENT_ID=$CLIENT_ID" `
  --project=agentflow-prod-assistant --region=us-central1
```

---

## Verify

1. Open UI → should show **Continue with Google**
2. Sign in → lands on Dashboard
3. Log an activity → data saved to Firestore under your user ID
4. API: `POST /api/v1/auth/verify` with Google credential returns user profile
