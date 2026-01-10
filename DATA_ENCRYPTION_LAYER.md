# Data Encryption Layer Implementation

## ✅ Implementation Complete

This document describes the comprehensive data encryption layer for protecting sensitive data throughout the application.

---

## 📋 Overview

The data encryption layer provides field-level encryption, key management, and secure data handling for sensitive information stored in the database and transmitted over the network.

### Key Features
- **Field-level encryption** - Encrypt individual database fields
- **Multiple algorithms** - Support for AES-256-GCM, AES-256-CBC, ChaCha20-Poly1305
- **Key management** - Key versioning and rotation support
- **Automatic encryption/decryption** - Mongoose plugin for seamless field encryption
- **Type-safe helpers** - Convenience functions for common data types
- **Request/Response middleware** - Encrypt sensitive fields in API requests/responses

---

## 🏗️ Architecture

### Components

1. **Data Encryption Service** (`api/src/services/dataEncryption.service.ts`)
   - Core encryption/decryption functions
   - Key management
   - Multiple algorithm support

2. **Encryption Helpers** (`api/src/utils/encryptionHelpers.ts`)
   - Type-safe encryption functions
   - Convenience utilities
   - Field detection

3. **Data Encryption Middleware** (`api/src/middleware/dataEncryption.middleware.ts`)
   - Request encryption
   - Response decryption
   - Automatic field handling

4. **Encryption Key Model** (`api/src/models/EncryptionKey.ts`)
   - Key metadata tracking
   - Version history
   - Rotation support

---

## 📦 Implementation Details

### 1. Data Encryption Service

**File**: `api/src/services/dataEncryption.service.ts`

#### Core Functions

**Encrypt Data**
```typescript
import { encryptData, EncryptedData } from '../services/dataEncryption.service';

const encrypted: EncryptedData = encryptData('sensitive data', {
  algorithm: 'aes-256-gcm', // Optional, defaults to 'aes-256-gcm'
  keyVersion: 1, // Optional
  keyId: 'key-v1', // Optional
});
```

**Decrypt Data**
```typescript
import { decryptData } from '../services/dataEncryption.service';

const decrypted = decryptData(encrypted);
// Returns: Buffer or string
```

**Field-Level Encryption**
```typescript
import { encryptField, decryptField } from '../services/dataEncryption.service';

// Encrypt a field value (returns JSON string for database storage)
const encrypted = encryptField('sensitive value');
// Store encrypted in database

// Decrypt a field value (from database)
const decrypted = decryptField(encrypted);
```

**Encrypt/Decrypt Multiple Fields**
```typescript
import { encryptFields, decryptFields } from '../services/dataEncryption.service';

const data = {
  name: 'John Doe',
  ssn: '123-45-6789',
  bankAccount: '1234567890',
};

// Encrypt specific fields
const encrypted = encryptFields(data, ['ssn', 'bankAccount']);

// Decrypt specific fields
const decrypted = decryptFields(encrypted, ['ssn', 'bankAccount']);
```

#### Supported Algorithms

- **AES-256-GCM** (Default) - Authenticated encryption, recommended
- **AES-256-CBC** - Compatibility mode
- **ChaCha20-Poly1305** - Modern alternative

#### Key Management

**Get Current Key Info**
```typescript
import { getEncryptionKeyInfo } from '../services/dataEncryption.service';

const keyInfo = getEncryptionKeyInfo();
// Returns: { keyId, version, algorithm, active }
```

**Rotate Encryption Key**
```typescript
import { rotateEncryptionKey } from '../services/dataEncryption.service';

const newKeyId = rotateEncryptionKey();
// Old key remains for decryption, new key used for encryption
```

---

### 2. Encryption Helpers

**File**: `api/src/utils/encryptionHelpers.ts`

#### Type-Safe Functions

```typescript
import {
  encryptString,
  decryptString,
  encryptNumber,
  decryptNumber,
  encryptBoolean,
  decryptBoolean,
  encryptObject,
  decryptObject,
  encryptArray,
  decryptArray,
  isEncrypted,
} from '../utils/encryptionHelpers';

// String encryption
const encrypted = encryptString('sensitive data');
const decrypted = decryptString(encrypted);

// Number encryption
const encryptedNum = encryptNumber(12345);
const decryptedNum = decryptNumber(encryptedNum);

// Boolean encryption
const encryptedBool = encryptBoolean(true);
const decryptedBool = decryptBoolean(encryptedBool);

// Object encryption
const obj = { name: 'John', age: 30 };
const encryptedObj = encryptObject(obj);
const decryptedObj = decryptObject(encryptedObj);

// Array encryption
const arr = [1, 2, 3, 4, 5];
const encryptedArr = encryptArray(arr);
const decryptedArr = decryptArray(encryptedArr);

// Check if encrypted
if (isEncrypted(someValue)) {
  // Value is encrypted
}
```

---

### 3. Mongoose Schema Plugin

**Automatic Field Encryption**

```typescript
import mongoose from 'mongoose';
import { encryptFieldsPlugin } from '../services/dataEncryption.service';

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  ssn: String, // Will be encrypted
  bankAccount: String, // Will be encrypted
});

// Apply encryption plugin
UserSchema.plugin(encryptFieldsPlugin, {
  fields: ['ssn', 'bankAccount'],
});

const User = mongoose.model('User', UserSchema);

// Usage - encryption/decryption happens automatically
const user = new User({
  name: 'John Doe',
  email: 'john@example.com',
  ssn: '123-45-6789', // Automatically encrypted on save
  bankAccount: '1234567890', // Automatically encrypted on save
});

await user.save(); // Fields are encrypted before saving

const retrieved = await User.findById(user._id);
// Fields are automatically decrypted when retrieved
console.log(retrieved.ssn); // '123-45-6789' (decrypted)
```

---

### 4. Request/Response Middleware

**File**: `api/src/middleware/dataEncryption.middleware.ts`

#### Usage

```typescript
import { dataEncryptionMiddleware } from '../middleware/dataEncryption.middleware';

// Apply to route
router.post(
  '/sensitive-endpoint',
  dataEncryptionMiddleware({
    encryptRequestFields: ['ssn', 'bankAccount'], // Encrypt in request
    decryptResponseFields: ['ssn', 'bankAccount'], // Decrypt in response
    encryptQueryParams: ['token'], // Encrypt query params
  }),
  handler
);
```

**Individual Middleware**

```typescript
import {
  encryptRequestMiddleware,
  decryptResponseMiddleware,
} from '../middleware/dataEncryption.middleware';

// Encrypt request only
router.use(
  encryptRequestMiddleware({
    encryptRequestFields: ['ssn'],
  })
);

// Decrypt response only
router.use(
  decryptResponseMiddleware({
    decryptResponseFields: ['ssn'],
  })
);
```

---

### 5. Encryption Key Model

**File**: `api/src/models/EncryptionKey.ts`

**Purpose**: Track encryption key metadata (keys themselves are NOT stored)

```typescript
import { EncryptionKey } from '../models/EncryptionKey';

// Create key metadata
const keyMetadata = new EncryptionKey({
  keyId: 'key-v1',
  version: 1,
  algorithm: 'aes-256-gcm',
  active: true,
});

await keyMetadata.save();

// Find active keys
const activeKeys = await EncryptionKey.find({ active: true });

// Mark key as rotated
await EncryptionKey.updateOne(
  { keyId: 'key-v1' },
  { active: false, rotatedAt: new Date() }
);
```

---

## 🔐 Security Features

### Encryption Standards

- **AES-256-GCM** - Authenticated encryption with associated data (AEAD)
- **Unique IV per encryption** - Prevents pattern analysis
- **Key derivation** - PBKDF2 with 100,000 iterations
- **Key versioning** - Support for key rotation without data loss

### Key Management

- **Environment-based keys** - Keys derived from environment variables
- **Key rotation** - Rotate keys without losing access to old data
- **Key versioning** - Track key versions for decryption
- **No key storage** - Keys are never stored in database

### Data Protection

- **Field-level encryption** - Encrypt only sensitive fields
- **Automatic encryption/decryption** - Seamless integration
- **Type safety** - Type-safe encryption functions
- **Error handling** - Graceful error handling

---

## 🚀 Usage Examples

### Example 1: Encrypt User SSN

```typescript
import { encryptField, decryptField } from '../services/dataEncryption.service';

// Encrypt SSN before saving
const user = {
  name: 'John Doe',
  email: 'john@example.com',
  ssn: encryptField('123-45-6789'), // Encrypted string
};

await User.create(user);

// Decrypt when retrieving
const retrieved = await User.findById(user._id);
const ssn = decryptField(retrieved.ssn); // '123-45-6789'
```

### Example 2: Encrypt API Keys

```typescript
import { encryptString, decryptString } from '../utils/encryptionHelpers';

// Store encrypted API key
const apiKey = 'sk_live_1234567890';
const encrypted = encryptString(apiKey);

await ApiKey.create({
  provider: 'stripe',
  encryptedKey: encrypted,
});

// Retrieve and decrypt
const key = await ApiKey.findOne({ provider: 'stripe' });
const decryptedKey = decryptString(key.encryptedKey);
```

### Example 3: Encrypt Sensitive Configuration

```typescript
import { encryptObject, decryptObject } from '../utils/encryptionHelpers';

const config = {
  databaseUrl: 'mongodb://...',
  apiSecret: 'secret-key',
  webhookSecret: 'webhook-secret',
};

const encrypted = encryptObject(config);

await Config.create({
  name: 'production',
  encryptedConfig: encrypted,
});

// Retrieve and decrypt
const stored = await Config.findOne({ name: 'production' });
const decryptedConfig = decryptObject(stored.encryptedConfig);
```

### Example 4: Mongoose Model with Encrypted Fields

```typescript
import mongoose from 'mongoose';
import { encryptFieldsPlugin } from '../services/dataEncryption.service';

const PaymentMethodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: String,
  last4: String, // Last 4 digits (not encrypted)
  encryptedToken: String, // Encrypted payment token
  encryptedMetadata: String, // Encrypted metadata
});

PaymentMethodSchema.plugin(encryptFieldsPlugin, {
  fields: ['encryptedToken', 'encryptedMetadata'],
});

const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema);

// Usage
const payment = new PaymentMethod({
  userId: userId,
  provider: 'stripe',
  last4: '1234',
  encryptedToken: 'tok_1234567890', // Auto-encrypted
  encryptedMetadata: JSON.stringify({ customerId: 'cus_123' }), // Auto-encrypted
});

await payment.save();
// encryptedToken and encryptedMetadata are encrypted in database

const retrieved = await PaymentMethod.findById(payment._id);
// encryptedToken and encryptedMetadata are auto-decrypted
```

---

## 🔧 Configuration

### Environment Variables

```env
# Primary encryption key (required in production)
DATA_ENCRYPTION_KEY=your-secure-encryption-key-here

# Alternative key names (fallback order)
ENCRYPTION_KEY=your-secure-encryption-key-here
JWT_SECRET=your-secure-encryption-key-here

# Key ID (optional, defaults to 'default-key-v1')
ENCRYPTION_KEY_ID=production-key-v1
```

### Key Requirements

- **Minimum length**: 32 characters recommended
- **Complexity**: Use a strong, random key
- **Storage**: Store in environment variables, never in code
- **Rotation**: Rotate keys periodically (every 90 days recommended)

---

## 🔄 Key Rotation

### Rotating Encryption Keys

```typescript
import { rotateEncryptionKey } from '../services/dataEncryption.service';
import { EncryptionKey } from '../models/EncryptionKey';

// Rotate to new key
const newKeyId = rotateEncryptionKey();

// Update key metadata in database
const oldKey = await EncryptionKey.findOne({ active: true });
if (oldKey) {
  oldKey.active = false;
  oldKey.rotatedAt = new Date();
  await oldKey.save();
}

// Create new key metadata
const newKey = new EncryptionKey({
  keyId: newKeyId,
  version: oldKey ? oldKey.version + 1 : 1,
  algorithm: 'aes-256-gcm',
  active: true,
});
await newKey.save();
```

### Migration Strategy

1. **Dual encryption**: Encrypt new data with new key, keep old key for decryption
2. **Gradual migration**: Re-encrypt old data with new key over time
3. **Key retention**: Keep old keys for decryption until all data is migrated
4. **Cleanup**: Remove old keys after migration complete

---

## 📊 Monitoring

### Key Information

```typescript
import { getEncryptionKeyInfo } from '../services/dataEncryption.service';

const keyInfo = getEncryptionKeyInfo();
console.log('Current encryption key:', keyInfo);
// { keyId: 'default-key-v1', version: 1, algorithm: 'aes-256-gcm', active: true }
```

### Key Metadata

```typescript
import { EncryptionKey } from '../models/EncryptionKey';

// Get all keys
const keys = await EncryptionKey.find().sort({ createdAt: -1 });

// Get active keys
const activeKeys = await EncryptionKey.find({ active: true });

// Get key history
const keyHistory = await EncryptionKey.find({ keyId: 'default-key' }).sort({ version: -1 });
```

---

## ⚠️ Important Notes

1. **Key Security**: Never commit encryption keys to version control
2. **Key Storage**: Store keys in secure environment variables or key management service
3. **Key Rotation**: Rotate keys regularly (every 90 days recommended)
4. **Backup Keys**: Keep secure backups of encryption keys
5. **Key Loss**: Losing encryption keys means losing access to encrypted data
6. **Performance**: Encryption/decryption adds overhead, use selectively
7. **Algorithm**: Use AES-256-GCM for new implementations (default)

---

## 🔍 Troubleshooting

### Encryption Errors

**Error: "Encryption key not found"**
- Check environment variable `DATA_ENCRYPTION_KEY` is set
- Verify key version matches encrypted data
- Check key rotation history

**Error: "Failed to decrypt field"**
- Verify encrypted data format is correct
- Check key version matches
- Ensure key hasn't been rotated without migration

### Performance Issues

- **Index encrypted fields**: Encrypted fields can't be indexed effectively
- **Selective encryption**: Only encrypt truly sensitive fields
- **Caching**: Consider caching decrypted values (with caution)

---

## 📚 Best Practices

1. **Encrypt at Rest**: Use field-level encryption for sensitive database fields
2. **Encrypt in Transit**: Use HTTPS/TLS for network transmission
3. **Key Management**: Use secure key management service in production
4. **Key Rotation**: Rotate keys regularly
5. **Access Control**: Limit access to encryption keys
6. **Audit Logging**: Log encryption/decryption operations
7. **Testing**: Test encryption/decryption in all environments

---

## ✅ Checklist

- [x] Core encryption service implemented
- [x] Multiple algorithm support
- [x] Key management and rotation
- [x] Field-level encryption utilities
- [x] Mongoose plugin for automatic encryption
- [x] Request/Response middleware
- [x] Type-safe helper functions
- [x] Encryption key model
- [x] Documentation

---

**Status**: ✅ Complete and Ready for Production

**Last Updated**: 2024-01-15

