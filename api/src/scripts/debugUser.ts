import { User } from '../models/User';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function debugUser(email?: string) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);

    if (!email) {
      // List all users
      console.log('\n=== ALL USERS ===');
      const users = await User.find({}).select('email name role isActive isBlocked approvalStatus').lean();
      users.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - Active: ${user.isActive}, Blocked: ${user.isBlocked}, Status: ${user.approvalStatus}`);
      });

      if (users.length === 0) {
        console.log('No users found in database!');
      }
      console.log(`\nTotal users: ${users.length}`);
      console.log('\nRun: npm run debug:user <email> to debug a specific user\n');
      return;
    }

    const user = await User.findOne({ email }).select('+passwordHash').lean();

    if (!user) {
      console.log(`\nUser ${email} not found`);
      console.log('Try running without email to see all users: npm run debug:user');
      return;
    }

    console.log('User Status:');
    console.log(`- ID: ${user._id}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Name: ${user.name}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- isActive: ${user.isActive}`);
    console.log(`- isBlocked: ${user.isBlocked}`);
    console.log(`- approvalStatus: ${user.approvalStatus}`);
    console.log(`- isEmailVerified: ${user.isEmailVerified}`);
    console.log(`- failedLoginAttempts: ${user.failedLoginAttempts}`);
    console.log(`- lockUntil: ${user.lockUntil}`);

    // Check what the login logic would do
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isAdmin = user.role === 'admin';
    const isApproved = user.approvalStatus === 'approved';
    const isReseller = user.role === 'reseller';

    console.log('\nLogin Logic Check:');
    console.log(`- Is development: ${isDevelopment}`);
    console.log(`- Is admin: ${isAdmin}`);
    console.log(`- Is approved: ${isApproved}`);
    console.log(`- Is reseller: ${isReseller}`);

    if ((!isApproved && !isAdmin) && (isDevelopment || isReseller)) {
      console.log('-> Would auto-approve this user');
    }

    if (!isDevelopment && !isAdmin && user.approvalStatus !== 'approved') {
      console.log('-> Would block login (pending approval)');
    }

    if (user.isBlocked) {
      console.log('-> Would block login (account blocked)');
    }

    if (!user.isActive) {
      console.log('-> Would block login (account inactive)');
    }

    // Fix common issues
    if (!user.isActive && user.approvalStatus === 'approved' && !user.isBlocked) {
      console.log('\nFixing: Activating approved user...');
      await User.updateOne(
        { _id: user._id },
        { $set: { isActive: true } }
      );
      console.log('User activated!');
    }

    if (user.approvalStatus === 'pending' && (isDevelopment || isReseller)) {
      console.log('\nFixing: Auto-approving pending user...');
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            approvalStatus: 'approved',
            approvedAt: new Date(),
            isActive: true
          }
        }
      );
      console.log('User auto-approved and activated!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

const email = process.argv[2];

debugUser(email);
