/**
 * Script to approve a user for local development
 * Usage: npx ts-node scripts/approve-user.ts <email>
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../src/models/User';

const approveUser = async (email: string) => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/revocart';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    if (user.approvalStatus === 'approved') {
      console.log(`User ${email} is already approved`);
      process.exit(0);
    }

    // Approve user
    user.approvalStatus = 'approved';
    user.approvedAt = new Date();
    user.isActive = true;
    await user.save();

    console.log(`✅ User ${email} has been approved and activated`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Approval Status: ${user.approvalStatus}`);
    console.log(`   Is Active: ${user.isActive}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error approving user:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx ts-node scripts/approve-user.ts <email>');
  console.error('Example: npx ts-node scripts/approve-user.ts user@example.com');
  process.exit(1);
}

approveUser(email);

