# Cloud Run Backend Deployment

This guide deploys the API in this repo to Google Cloud Run while keeping MongoDB Atlas as the database and Netlify as the web host.

It is written for the current repository layout:

- API code: `apps/api`
- API Dockerfile: `apps/api/Dockerfile`
- Cloud Build config: `infrastructure/gcp/cloudbuild.api.yaml`

## Before You Start

You need:

- a Google Cloud project with billing enabled
- the `gcloud` CLI installed and authenticated
- a MongoDB Atlas connection string
- existing app secrets ready:
  - `MONGODB_URI`
  - `MONGODB_DB_NAME`
  - `JWT_SECRET`
  - `OPENAI_API_KEY`
  - `RENTCAST_API_KEY`
- any email provider settings you plan to use in production

Important: Cloud Run uses an ephemeral filesystem, so production media should use Google Cloud Storage instead of local disk. The GCS migration steps now live in `docs/deployment/google-cloud-storage-media.md`.

## 1. Pick Your Deployment Values

Use your own values for these placeholders throughout this document. Do not run the uppercase placeholder names literally.

```text
PROJECT_ID=your-gcp-project-id
REGION=us-central1
SERVICE=workside-api
AR_REPO=workside-backend
IMAGE_NAME=workside-api
IMAGE_TAG=latest
AR_HOST=us-central1-docker.pkg.dev
RUNTIME_SERVICE_ACCOUNT=workside-api-runtime@PROJECT_ID.iam.gserviceaccount.com
```

If you want a production and staging split, keep the same commands but vary `SERVICE`, `IMAGE_TAG`, and the secret names.

## 2. Authenticate And Point gcloud At The Right Project

```powershell
gcloud auth login
gcloud config set project PROJECT_ID
gcloud config set run/region REGION
```

Optional, but helpful:

```powershell
gcloud config set artifacts/location REGION
```

## 3. Enable Required Google Cloud APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  iam.googleapis.com
```

## 4. Create The Artifact Registry Repository

Run this once per region. Replace `AR_REPO` with a real repository name such as `workside-backend` before running the command:

```powershell
gcloud artifacts repositories create AR_REPO `
  --repository-format=docker `
  --location=REGION `
  --description="Containers for Workside backend services"
```

If the repository already exists, Google Cloud will return an error and you can move on.

Example:

```powershell
gcloud artifacts repositories create workside-backend `
  --repository-format=docker `
  --location=us-central1 `
  --description="Containers for Workside backend services"
```

## 5. Create A Dedicated Runtime Service Account

This is the identity Cloud Run will use at runtime.

```powershell
gcloud iam service-accounts create workside-api-runtime `
  --display-name="Workside API runtime"
```

Grant it access to read your secrets:

```powershell
gcloud projects add-iam-policy-binding PROJECT_ID `
  --member="serviceAccount:RUNTIME_SERVICE_ACCOUNT" `
  --role="roles/secretmanager.secretAccessor"
```

After the media migration, this same service account should also receive Cloud Storage bucket access. The exact command is documented in `docs/deployment/google-cloud-storage-media.md`.

## 6. Create Or Update Secret Manager Secrets

Recommended secret names:

- `workside-mongodb-uri`
- `workside-jwt-secret`
- `workside-openai-api-key`
- `workside-rentcast-api-key`
- `workside-sendgrid-api-key`
- `workside-smtp-user`
- `workside-smtp-pass`

Create a secret the first time:

```powershell
Write-Output "your-secret-value" | gcloud secrets create workside-jwt-secret `
  --data-file=-
```

Add a new version later when the secret already exists:

```powershell
Write-Output "your-new-secret-value" | gcloud secrets versions add workside-jwt-secret `
  --data-file=-
```

PowerShell adds a trailing newline when you use `Write-Output`. For API keys and JWT secrets, prefer creating a temporary file and passing `--data-file=path` if you want exact byte-for-byte values without a newline.

## 7. Build The API Container With Cloud Build

This repo includes a build config at `infrastructure/gcp/cloudbuild.api.yaml` that builds `apps/api/Dockerfile` and pushes the image to Artifact Registry.

From the repo root:

```powershell
gcloud builds submit . `
  --config infrastructure/gcp/cloudbuild.api.yaml `
  --substitutions "_AR_HOST=AR_HOST,_AR_REPO=AR_REPO,_IMAGE_NAME=IMAGE_NAME,_IMAGE_TAG=IMAGE_TAG"
```

Example with concrete values:

```powershell
gcloud builds submit . `
  --config infrastructure/gcp/cloudbuild.api.yaml `
  --substitutions "_AR_HOST=us-central1-docker.pkg.dev,_AR_REPO=workside-backend,_IMAGE_NAME=workside-api,_IMAGE_TAG=latest"
```

The image URL will be:

```text
AR_HOST/PROJECT_ID/AR_REPO/IMAGE_NAME:IMAGE_TAG
```

## 8. Deploy The API To Cloud Run

Run this from the repo root after the image build succeeds:

```powershell
gcloud run deploy SERVICE `
  --image AR_HOST/PROJECT_ID/AR_REPO/IMAGE_NAME:IMAGE_TAG `
  --region REGION `
  --platform managed `
  --service-account RUNTIME_SERVICE_ACCOUNT `
  --allow-unauthenticated `
  --port 8080 `
  --memory 1Gi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars NODE_ENV=production,MONGODB_DB_NAME=workside-home-seller,PUBLIC_API_URL=https://SERVICE-URL,PUBLIC_WEB_URL=https://your-netlify-site.netlify.app,EMAIL_PROVIDER=console,EMAIL_FROM=hello@workside.software,MARKET_DATA_PROVIDER=rentcast,RENTCAST_BASE_URL=https://api.rentcast.io/v1,STORAGE_PROVIDER=gcs,GCS_PROJECT_ID=PROJECT_ID,GCS_BUCKET_NAME=your-media-bucket,GCS_UPLOAD_PREFIX=media-assets `
  --set-secrets MONGODB_URI=workside-mongodb-uri:latest,JWT_SECRET=workside-jwt-secret:latest,OPENAI_API_KEY=workside-openai-api-key:latest,RENTCAST_API_KEY=workside-rentcast-api-key:latest
```

Notes:

- Replace `SERVICE-URL` after the first deploy with the actual Cloud Run URL, then run the deploy command again so `PUBLIC_API_URL` matches reality.
- If you want the API private, replace `--allow-unauthenticated` with `--no-allow-unauthenticated`, but that will require another public access strategy for Netlify and Expo clients.
- If you are using SMTP in production, add the SMTP settings with `--set-env-vars` and `--set-secrets`.
- If you are using SendGrid in production, add the SendGrid settings below instead of SMTP.
- For stricter production change control, replace `:latest` with a numbered secret version after your initial setup.

Suggested SMTP additions:

```text
--set-env-vars EMAIL_PROVIDER=smtp,SMTP_HOST=smtp.your-provider.com,SMTP_PORT=587
--set-secrets SMTP_USER=workside-smtp-user:latest,SMTP_PASS=workside-smtp-pass:latest
```

Suggested SendGrid additions:

```text
--set-env-vars EMAIL_PROVIDER=sendgrid,SENDGRID_FROM_EMAIL=noreply@yourdomain.com
--set-secrets SENDGRID_API_KEY=workside-sendgrid-api-key:latest
```

## 9. Verify The Deployment

Health check:

```powershell
curl https://YOUR_CLOUD_RUN_URL/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "workside-api"
}
```

Useful runtime checks:

- sign up or log in from the web app
- request an OTP
- load a seller dashboard
- run a pricing analysis

If any of those fail, check logs immediately.

## 10. View Logs

Tail recent service logs:

```powershell
gcloud run services logs tail SERVICE --region REGION
```

Describe the current service revision and URL:

```powershell
gcloud run services describe SERVICE --region REGION
```

## 11. How To Update The Backend

Every backend update follows the same loop:

1. Commit your code changes locally.
2. Build a new image tag with Cloud Build.
3. Deploy that new image to the same Cloud Run service.
4. Smoke test `/health`, auth, and pricing.

Example update flow:

```powershell
gcloud builds submit . `
  --config infrastructure/gcp/cloudbuild.api.yaml `
  --substitutions "_AR_HOST=us-central1-docker.pkg.dev,_AR_REPO=workside-backend,_IMAGE_NAME=workside-api,_IMAGE_TAG=2026-03-26-1"

gcloud run deploy workside-api `
  --image us-central1-docker.pkg.dev/PROJECT_ID/workside-backend/workside-api:2026-03-26-1 `
  --region us-central1 `
  --platform managed `
  --service-account workside-api-runtime@PROJECT_ID.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --port 8080 `
  --memory 1Gi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars NODE_ENV=production,MONGODB_DB_NAME=workside-home-seller,PUBLIC_API_URL=https://YOUR_CLOUD_RUN_URL,PUBLIC_WEB_URL=https://your-netlify-site.netlify.app,EMAIL_PROVIDER=console,EMAIL_FROM=hello@workside.software,MARKET_DATA_PROVIDER=rentcast,RENTCAST_BASE_URL=https://api.rentcast.io/v1,STORAGE_PROVIDER=gcs,GCS_PROJECT_ID=PROJECT_ID,GCS_BUCKET_NAME=your-media-bucket,GCS_UPLOAD_PREFIX=media-assets `
  --set-secrets MONGODB_URI=workside-mongodb-uri:latest,JWT_SECRET=workside-jwt-secret:latest,OPENAI_API_KEY=workside-openai-api-key:latest,RENTCAST_API_KEY=workside-rentcast-api-key:latest
```

Tip: use a unique `IMAGE_TAG` for every deploy instead of reusing `latest`. That makes rollbacks easier and gives you clearer revision history.

## 12. How To Update Secrets Without Rebuilding

If a secret changes, add a new version in Secret Manager:

```powershell
Write-Output "new-secret-value" | gcloud secrets versions add workside-openai-api-key `
  --data-file=-
```

Then redeploy the service so the latest secret version is picked up:

```powershell
gcloud run deploy SERVICE `
  --image AR_HOST/PROJECT_ID/AR_REPO/IMAGE_NAME:IMAGE_TAG `
  --region REGION `
  --update-secrets OPENAI_API_KEY=workside-openai-api-key:latest
```

You can reuse the full deploy command if that is easier.

## 13. Roll Back If Needed

List revisions:

```powershell
gcloud run revisions list --service SERVICE --region REGION
```

Fast rollback pattern:

1. Identify the last good image tag or revision.
2. Re-run `gcloud run deploy` using that older image URL.
3. Verify `/health` and one real app flow.

## 14. Netlify Integration Notes

After Cloud Run is live:

- set `NEXT_PUBLIC_API_URL` in Netlify to the Cloud Run URL
- keep the backend public unless you plan to add a secure proxy layer
- if the frontend domain changes, redeploy the API with the updated `PUBLIC_WEB_URL`

## 15. Media Storage On Google Cloud

Production media storage now targets Google Cloud Storage. Use `docs/deployment/google-cloud-storage-media.md` for:

1. bucket creation
2. runtime service account permissions
3. Cloud Run env var changes
4. verification steps for photo uploads

## Official References

- Cloud Run deploy docs: https://docs.cloud.google.com/run/docs/deploying
- Cloud Run secrets docs: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Cloud Build container docs: https://docs.cloud.google.com/build/docs/building/build-containers
