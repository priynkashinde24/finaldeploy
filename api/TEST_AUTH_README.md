# Authentication System Test Script

## Overview

This test script verifies that the authentication system is working correctly, including:
- Database connection
- Password hashing and verification
- User registration
- JWT token generation and verification
- User login flow
- Account lockout mechanism
- User model fields (SMS/WhatsApp)

## Usage

### Run the test script:

```bash
cd api
npm run test:auth
```

Or directly with ts-node:

```bash
cd api
ts-node src/scripts/testAuth.ts
```

## Prerequisites

1. **Environment Variables**: Make sure your `.env` file has:
   - `MONGODB_URI` - MongoDB connection string
   - `JWT_ACCESS_SECRET` or `JWT_SECRET` - JWT secret key
   - `JWT_REFRESH_SECRET` - JWT refresh token secret (optional)

2. **Database**: MongoDB should be running and accessible

## Test Coverage

The script tests:

1. ✅ **Database Connection** - Verifies MongoDB connection
2. ✅ **Password Hashing** - Tests bcrypt password hashing and comparison
3. ✅ **User Registration** - Tests creating a new user
4. ✅ **JWT Token Generation** - Tests token creation and verification
5. ✅ **User Login Flow** - Tests complete login process
6. ✅ **Account Lockout** - Tests failed login attempt tracking
7. ✅ **User Model Fields** - Verifies SMS/WhatsApp fields exist

## Expected Output

```
🧪 Starting Authentication System Tests...

✅ Database Connection
✅ Password Hashing
   Details: { hashLength: 60 }
✅ User Registration
   Details: { userId: '...', email: 'test-...@example.com' }
✅ JWT Token Generation
   Details: { tokenLength: ..., decodedEmail: 'test@example.com', decodedRole: 'reseller' }
✅ User Login
   Details: { userId: '...', email: '...', role: 'reseller', tokenGenerated: true }
✅ Account Lockout
   Details: { failedAttempts: 5, lockUntil: ... }
✅ User Model Fields
   Details: { hasSMSFields: true, hasWhatsAppFields: true, ... }

============================================================
📊 TEST SUMMARY
============================================================
Total Tests: 7
✅ Passed: 7
❌ Failed: 0
Success Rate: 100.0%

============================================================

✅ Database connection closed.
```

## Troubleshooting

### Database Connection Failed
- Check `MONGODB_URI` in `.env` file
- Verify MongoDB is running
- Check network connectivity

### JWT Token Generation Failed
- Verify `JWT_ACCESS_SECRET` or `JWT_SECRET` is set in `.env`
- Check that the secret is not empty

### Password Hashing Failed
- This usually indicates a bcrypt configuration issue
- Check that `bcryptjs` package is installed

## Notes

- The script creates temporary test users and cleans them up automatically
- All test data is isolated and won't affect production data
- The script exits with code 0 on success, 1 on failure (useful for CI/CD)




















