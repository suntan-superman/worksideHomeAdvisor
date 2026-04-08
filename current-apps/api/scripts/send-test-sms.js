import { getTwilioConfigurationStatus, sendTestTwilioSms } from '../src/modules/marketplace-sms/marketplace-sms.service.js';

function parseArgs(argv = []) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    parsed[key] = rest.join('=');
  }
  return parsed;
}

function resolveDestination(args = {}) {
  return (
    args.to ||
    args.phone ||
    args.destination ||
    process.env.TEST_SMS_TO ||
    process.env.npm_config_to ||
    process.env.npm_config_phone ||
    process.env.npm_config_destination ||
    process.env.npm_config_token_description ||
    ''
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const to = resolveDestination(args);
  const body =
    args.body ||
    process.env.TEST_SMS_BODY ||
    process.env.npm_config_body ||
    '';

  const config = getTwilioConfigurationStatus();

  console.log('Twilio configuration status');
  console.log(`- Configured: ${config.configured ? 'yes' : 'no'}`);
  console.log(`- Account SID present: ${config.accountSidPresent ? 'yes' : 'no'}`);
  console.log(`- Auth token present: ${config.authTokenPresent ? 'yes' : 'no'}`);
  console.log(`- Messaging Service SID present: ${config.messagingServiceSidPresent ? 'yes' : 'no'}`);
  console.log(`- From number present: ${config.fromNumberPresent ? 'yes' : 'no'}`);
  console.log(`- Inbound webhook: ${config.inboundWebhookUrl}`);
  console.log(`- Status callback: ${config.statusWebhookUrl}`);
  console.log('');
  console.log('Note: this script uses the local API environment loaded from .env files, not the deployed Cloud Run environment.');

  if (!to) {
    throw new Error(
      'Missing destination number. Use --phone=+15555550123, --destination=+15555550123, or set TEST_SMS_TO.',
    );
  }

  const response = await sendTestTwilioSms({
    to,
    body,
    statusCallbackUrl: config.statusWebhookUrl,
  });

  console.log('');
  console.log('Test SMS sent successfully.');
  console.log(`- To: ${to}`);
  console.log(`- Message SID: ${response.sid || ''}`);
  console.log(`- Twilio status: ${response.status || ''}`);
  console.log('');
  console.log('Suggested next step: reply "YES TEST" from the destination phone and confirm the inbound webhook logs the reply.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
