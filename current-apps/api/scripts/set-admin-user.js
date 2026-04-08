import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { env } from '../src/config/env.js';
import { connectToDatabase } from '../src/lib/db.js';
import { UserModel } from '../src/modules/auth/auth.model.js';

function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

async function promptForAccountType(rl) {
  while (true) {
    const value = (await rl.question('Account type (admin/demo): ')).trim().toLowerCase();
    if (value === 'admin' || value === 'demo') {
      return value;
    }

    console.log('Please enter "admin" or "demo".');
  }
}

async function promptForNonEmptyValue(rl, label) {
  while (true) {
    const value = (await rl.question(label)).trim();
    if (value) {
      return value;
    }

    console.log('A value is required.');
  }
}

async function promptForPasswordConfirmation(rl) {
  while (true) {
    const password = await rl.question('Password: ');
    const confirmPassword = await rl.question('Confirm password: ');

    if (!isStrongEnoughPassword(password)) {
      console.log('Password must be at least 8 characters long.');
      continue;
    }

    if (password !== confirmPassword) {
      console.log('Passwords did not match. Please try again.');
      continue;
    }

    return password;
  }
}

async function run() {
  const rl = readline.createInterface({ input, output });

  try {
    const connected = await connectToDatabase();
    if (!connected) {
      throw new Error('Could not connect to MongoDB.');
    }

    console.log('');
    console.log('Workside Home Seller Account Bootstrap');
    console.log('This will create or update an admin or demo account and mark it as verified.');
    console.log('');

    const accountType = await promptForAccountType(rl);
    const email = (await promptForNonEmptyValue(rl, 'Email: ')).toLowerCase();
    const password = await promptForPasswordConfirmation(rl);
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    const existingUser = await UserModel.findOne({ email });
    const user = existingUser || new UserModel({ email });

    user.passwordHash = passwordHash;
    user.role = accountType === 'admin' ? 'admin' : 'seller';
    user.isDemoAccount = accountType === 'demo';
    user.isBillingBypass = accountType === 'admin';
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.verificationOtp = null;

    if (!user.firstName) {
      user.firstName = accountType === 'admin' ? 'Admin' : 'Demo';
    }

    await user.save();

    console.log('');
    console.log(`Account ready for ${user.email}`);
    console.log(`Type: ${accountType}`);
    console.log(`Role: ${user.role}`);
    console.log(`User ID: ${user._id.toString()}`);
    if (user.isBillingBypass) {
      console.log('Billing access is bypassed for this account.');
    } else {
      console.log('This account can be used to test live Stripe billing flows.');
    }
  } finally {
    rl.close();
  }
}

run()
  .catch((error) => {
    console.error('');
    console.error('Failed to set admin user.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
