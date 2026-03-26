# Google Cloud Storage Media Setup

This guide finishes the production media migration for the API by moving uploaded photos from local disk to Google Cloud Storage.

It matches the current backend implementation:

- `STORAGE_PROVIDER=gcs`
- `GCS_BUCKET_NAME=your-bucket-name`
- optional `GCS_PROJECT_ID`
- optional `GCS_UPLOAD_PREFIX`, default `media-assets`

The API keeps serving media through its existing route:

- `/api/v1/media/assets/:assetId/file`

That means the mobile and web clients do not need a storage-specific URL change when you switch from local storage to GCS.

## 1. Choose A Bucket Name

Example:

```text
worksidehomeadvisor-media
```

Bucket names must be globally unique.

## 2. Create The Bucket

```powershell
gcloud storage buckets create gs://worksidehomeadvisor-media `
  --project=worksidehomeadvisor `
  --location=us-central1 `
  --uniform-bucket-level-access
```

Uniform bucket-level access is the recommended default.

## 3. Grant The Cloud Run Runtime Service Account Access

The Cloud Run runtime service account needs object read/write access to this bucket.

```powershell
gcloud storage buckets add-iam-policy-binding gs://worksidehomeadvisor-media `
  --member="serviceAccount:workside-api-runtime@worksidehomeadvisor.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"
```

That is enough for uploads and reads. If you later split upload and read responsibilities, we can narrow the permissions.

## 4. Update Cloud Run Environment Variables

Redeploy the API with the storage settings switched to GCS:

```powershell
gcloud run deploy workside-api `
  --image us-central1-docker.pkg.dev/worksidehomeadvisor/homeadvisor-api/workside-api:latest `
  --region us-central1 `
  --platform managed `
  --service-account workside-api-runtime@worksidehomeadvisor.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --port 8080 `
  --memory 1Gi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=production,MONGODB_DB_NAME=workside-home-seller,PUBLIC_WEB_URL=https://worksidehomeadvisor.netlify.app,PUBLIC_API_URL=https://workside-api-166927680198.us-central1.run.app,EMAIL_PROVIDER=console,EMAIL_FROM=hello@workside.software,MARKET_DATA_PROVIDER=rentcast,RENTCAST_BASE_URL=https://api.rentcast.io/v1,STORAGE_PROVIDER=gcs,GCS_PROJECT_ID=worksidehomeadvisor,GCS_BUCKET_NAME=worksidehomeadvisor-media,GCS_UPLOAD_PREFIX=media-assets" `
  --set-secrets "MONGODB_URI=workside-mongodb-uri:latest,JWT_SECRET=workside-jwt-secret:latest,OPENAI_API_KEY=workside-openai-api-key:latest,RENTCAST_API_KEY=workside-rentcast-api-key:latest"
```

## 5. Verify The Migration

After the deploy:

1. Upload a new photo from the mobile app.
2. Confirm the upload succeeds.
3. Confirm the saved gallery image loads.
4. Confirm the media record in Mongo has:
   - `storageProvider: "gcs"`
   - a `storageKey`
   - no need for local file persistence

You can also inspect the bucket:

```powershell
gcloud storage ls gs://worksidehomeadvisor-media/media-assets
```

## 6. Local Development Options

For local development you have two reasonable choices:

1. Keep `STORAGE_PROVIDER=local`
   This is simplest for day-to-day local work.

2. Use GCS locally with Application Default Credentials
   Set `STORAGE_PROVIDER=gcs`, `GCS_BUCKET_NAME`, and either:
   - authenticate with `gcloud auth application-default login`, or
   - set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON key path

## 7. Existing Local Assets

Existing media records that were stored with `storageProvider=local` can still be served by the API as long as the local files still exist in that environment.

New uploads after this migration will be stored in GCS.

If you want, the next follow-up can be a one-time migration script that copies existing local assets into GCS and updates Mongo records in place.

## Official References

- Cloud Storage access control: https://cloud.google.com/storage/docs/access-control
- Cloud Storage buckets with gcloud: https://cloud.google.com/storage/docs/creating-buckets
