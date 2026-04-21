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
  timeoutOrOptions = ASYNC_DOCUMENT_JOB_TIMEOUT_MS,
) {
  const options =
    typeof timeoutOrOptions === 'number'
      ? { timeoutMs: timeoutOrOptions }
      : timeoutOrOptions || {};
  const timeoutMs = Number(options.timeoutMs) || ASYNC_DOCUMENT_JOB_TIMEOUT_MS;
  const pollIntervalMs =
    Number(options.pollIntervalMs) || ASYNC_DOCUMENT_JOB_POLL_INTERVAL_MS;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();

  while (Date.now() < deadline) {
    const response = await getAsyncJob(jobId);
    const job = response?.job;

    if (!job) {
      throw new Error('The background job could not be found.');
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    if (onProgress) {
      onProgress({
        job,
        elapsedMs: Date.now() - startedAt,
      });
    }

    await waitForDuration(pollIntervalMs);
  }

  throw new Error('The background job did not finish within the expected time.');
}
