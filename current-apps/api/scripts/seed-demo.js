import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { PropertyModel } from '../src/modules/properties/property.model.js';
import { UserModel } from '../src/modules/auth/auth.model.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
  });

  const user = await UserModel.findOneAndUpdate(
    { email: 'seller-demo@worksideadvisor.com' },
    {
      $setOnInsert: {
        email: 'seller-demo@worksideadvisor.com',
        passwordHash: '$2a$12$yXQmeu5N9gmgx9v2jYH8AOW8xOLnQxV8cp8mbn1gS0cNjm0v7odxu',
        firstName: 'Jamie',
        lastName: 'Seller',
        emailVerifiedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  await PropertyModel.findOneAndUpdate(
    { title: '1234 Ridgeview Lane', ownerUserId: user._id },
    {
      title: '1234 Ridgeview Lane',
      ownerUserId: user._id,
      addressLine1: '1234 Ridgeview Lane',
      city: 'Sacramento',
      state: 'CA',
      zip: '95829',
      propertyType: 'single_family',
      bedrooms: 4,
      bathrooms: 3,
      squareFeet: 2460,
      readinessScore: 78,
      sellerProfile: {
        saleTimeline: 'sixty_days',
        budgetMin: 2500,
        budgetMax: 7500,
        urgencyLevel: 'medium',
        diyPreference: 'light',
        goals: ['maximize-profit', 'move-before-school-year'],
      },
    },
    { upsert: true, new: true },
  );

  console.log('Seed complete.');
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
