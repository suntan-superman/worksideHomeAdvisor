import { getAsyncJob } from '../../../lib/api.js';

export const ASYNC_DOCUMENT_JOB_POLL_INTERVAL_MS = 1500;
export const ASYNC_DOCUMENT_JOB_TIMEOUT_MS = 2 * 60 * 1000;

export function waitForDuration(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function pollAsyncDocumentJobUntilSettled(
  jobId,
  timeoutMs = ASYNC_DOCUMENT_JOB_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await getAsyncJob(jobId);
    const job = response?.job;

    if (!job) {
      throw new Error('The background job could not be found.');
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    await waitForDuration(ASYNC_DOCUMENT_JOB_POLL_INTERVAL_MS);
  }

  throw new Error('The background job did not finish within the expected time.');
}
