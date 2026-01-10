/**
 * Authentication System Test Script
 * 
 * PURPOSE:
 * - Test login/register flow
 * - Verify JWT token generation
 * - Test authentication middleware
 * - Verify password hashing
 * 
 * USAGE:
 *   ts-node src/scripts/testAuth.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, verifyAccessToken } from '../utils/jwt';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details:`, details);
  }
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    await connectDB();
    logTest('Database Connection', true);
    return true;
  } catch (error: any) {
    logTest('Database Connection', false, error.message);
    return false;
  }
}

async function testPasswordHashing(): Promise<boolean> {
  try {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    if (!hash || hash === password) {
      logTest('Password Hashing', false, 'Hash is empty or same as password');
      return false;
    }
    
    const isValid = await comparePassword(password, hash);
    if (!isValid) {
      logTest('Password Hashing', false, 'Password comparison failed');
      return false;
    }
    
    const isInvalid = await comparePassword('WrongPassword', hash);
    if (isInvalid) {
      logTest('Password Hashing', false, 'Wrong password was accepted');
      return false;
    }
    
    logTest('Password Hashing', true, undefined, { hashLength: hash.length });
    return true;
  } catch (error: any) {
    logTest('Password Hashing', false, error.message);
    return false;
  }
}

async function testUserRegistration(): Promise<boolean> {
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: testEmail });
    if (existingUser) {
      await User.deleteOne({ email: testEmail });
    }
    
    const passwordHash = await hashPassword(testPassword);
    const user = new User({
      name: 'Test User',
      email: testEmail,
      passwordHash,
      role: 'reseller',
      isActive: true,
      isEmailVerified: true,
    });
    
    await user.save();
    
    logTest('User Registration', true, undefined, { userId: user._id.toString(), email: testEmail });
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    return true;
  } catch (error: any) {
    logTest('User Registration', false, error.message);
    return false;
  }
}

async function testJWTTokenGeneration(): Promise<boolean> {
  try {
    const testUserId = new mongoose.Types.ObjectId().toString();
    const testUser = {
      id: testUserId,
      email: 'test@example.com',
      role: 'reseller',
    };
    
    const token = signAccessToken(testUser);
    
    if (!token) {
      logTest('JWT Token Generation', false, 'Token is empty');
      return false;
    }
    
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.email !== testUser.email) {
      logTest('JWT Token Generation', false, 'Token verification failed');
      return false;
    }
    
    logTest('JWT Token Generation', true, undefined, { 
      tokenLength: token.length,
      decodedEmail: decoded.email,
      decodedRole: decoded.role 
    });
    return true;
  } catch (error: any) {
    logTest('JWT Token Generation', false, error.message);
    return false;
  }
}

async function testUserLogin(): Promise<boolean> {
  try {
    const testEmail = `test-login-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // Cleanup any existing test user
    await User.deleteOne({ email: testEmail });
    
    // Create test user
    const passwordHash = await hashPassword(testPassword);
    const user = new User({
      name: 'Test Login User',
      email: testEmail,
      passwordHash,
      role: 'reseller',
      isActive: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
    });
    await user.save();
    
    // Test login flow
    const foundUser = await User.findOne({ email: testEmail }).select('+passwordHash');
    if (!foundUser) {
      logTest('User Login - Find User', false, 'User not found');
      return false;
    }
    
    const isPasswordValid = await comparePassword(testPassword, foundUser.passwordHash);
    if (!isPasswordValid) {
      logTest('User Login - Password Check', false, 'Password validation failed');
      return false;
    }
    
    // Generate token
    const token = signAccessToken({
      id: foundUser._id.toString(),
      email: foundUser.email,
      role: foundUser.role,
    });
    
    if (!token) {
      logTest('User Login - Token Generation', false, 'Token generation failed');
      return false;
    }
    
    logTest('User Login', true, undefined, { 
      userId: foundUser._id.toString(),
      email: foundUser.email,
      role: foundUser.role,
      tokenGenerated: !!token 
    });
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    return true;
  } catch (error: any) {
    logTest('User Login', false, error.message);
    return false;
  }
}

async function testAccountLockout(): Promise<boolean> {
  try {
    const testEmail = `test-lockout-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const wrongPassword = 'WrongPassword123!';
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    // Create test user
    const passwordHash = await hashPassword(testPassword);
    const user = new User({
      name: 'Test Lockout User',
      email: testEmail,
      passwordHash,
      role: 'reseller',
      isActive: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
    });
    await user.save();
    
    // Simulate failed login attempts
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      const isPasswordValid = await comparePassword(wrongPassword, user.passwordHash);
      if (!isPasswordValid) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= maxAttempts) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + 30);
          user.lockUntil = lockTime;
        }
        await user.save();
      }
    }
    
    // Reload user
    const lockedUser = await User.findOne({ email: testEmail });
    if (!lockedUser) {
      logTest('Account Lockout', false, 'User not found after lockout');
      return false;
    }
    
    if (!lockedUser.lockUntil || lockedUser.failedLoginAttempts < maxAttempts) {
      logTest('Account Lockout', false, 'Account was not locked properly');
      return false;
    }
    
    logTest('Account Lockout', true, undefined, {
      failedAttempts: lockedUser.failedLoginAttempts,
      lockUntil: lockedUser.lockUntil,
    });
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    return true;
  } catch (error: any) {
    logTest('Account Lockout', false, error.message);
    return false;
  }
}

async function testUserModelFields(): Promise<boolean> {
  try {
    const testEmail = `test-fields-${Date.now()}@example.com`;
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    const user = new User({
      name: 'Test Fields User',
      email: testEmail,
      passwordHash: await hashPassword('TestPassword123!'),
      role: 'reseller',
      isActive: true,
      isEmailVerified: true,
      // Test SMS fields
      smsOptIn: true,
      smsOptInAt: new Date(),
      // Test WhatsApp fields
      whatsappOptIn: true,
      whatsappOptInAt: new Date(),
    });
    
    await user.save();
    
    const savedUser = await User.findOne({ email: testEmail });
    if (!savedUser) {
      logTest('User Model Fields', false, 'User not found after save');
      return false;
    }
    
    const hasSMSFields = savedUser.smsOptIn !== undefined && savedUser.smsOptInAt !== undefined;
    const hasWhatsAppFields = savedUser.whatsappOptIn !== undefined && savedUser.whatsappOptInAt !== undefined;
    
    if (!hasSMSFields || !hasWhatsAppFields) {
      logTest('User Model Fields', false, 'Missing SMS or WhatsApp fields');
      return false;
    }
    
    logTest('User Model Fields', true, undefined, {
      hasSMSFields,
      hasWhatsAppFields,
      smsOptIn: savedUser.smsOptIn,
      whatsappOptIn: savedUser.whatsappOptIn,
    });
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    
    return true;
  } catch (error: any) {
    logTest('User Model Fields', false, error.message);
    return false;
  }
}

async function runAllTests(): Promise<void> {
  console.log('\n🧪 Starting Authentication System Tests...\n');
  
  // Test 1: Database Connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('\n❌ Database connection failed. Cannot continue tests.');
    return;
  }
  
  // Test 2: Password Hashing
  await testPasswordHashing();
  
  // Test 3: User Registration
  await testUserRegistration();
  
  // Test 4: JWT Token Generation
  await testJWTTokenGeneration();
  
  // Test 5: User Login Flow
  await testUserLogin();
  
  // Test 6: Account Lockout
  await testAccountLockout();
  
  // Test 7: User Model Fields (SMS/WhatsApp)
  await testUserModelFields();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Close database connection
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed.');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});

