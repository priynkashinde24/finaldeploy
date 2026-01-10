# Debug: Registration 400 Bad Request Error

## 🔍 Common Causes

The 400 error can come from several validation checks. Here's how to debug:

### 1. Check Backend Console Logs

Look at your backend terminal for detailed error messages. The error handler should show:
- Which field failed validation
- What the error message is

### 2. Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Find the `/api/auth/register` request
4. Click on it
5. Check **Response** tab for error details

The response should look like:
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

---

## ✅ Required Fields

Make sure your registration request includes ALL these fields:

```json
{
  "name": "John Doe",           // Required: 2-100 characters
  "email": "user@example.com",  // Required: Valid email format
  "password": "password123",    // Required: Minimum 6 characters
  "role": "reseller"            // Required: "admin" | "supplier" | "reseller"
}
```

---

## 🚨 Common Validation Errors

### Error: "Invalid email address"
**Fix**: Use a valid email format
```json
❌ "email": "notanemail"
✅ "email": "user@example.com"
```

### Error: "Name must be at least 2 characters"
**Fix**: Name must be 2+ characters
```json
❌ "name": "A"
✅ "name": "John Doe"
```

### Error: "Password must be at least 6 characters"
**Fix**: Password must be 6+ characters
```json
❌ "password": "12345"
✅ "password": "password123"
```

### Error: "Invalid enum value. Expected 'admin' | 'supplier' | 'reseller'"
**Fix**: Role must be one of the allowed values
```json
❌ "role": "user"
✅ "role": "reseller"
```

### Error: "User with this email already exists"
**Fix**: Use a different email or login with existing account
```json
❌ Email already registered
✅ Use different email or login instead
```

### Error: "Only admins can create admin or supplier accounts"
**Fix**: You can only register as `reseller` without admin privileges
```json
❌ "role": "admin"     // Requires admin authentication
❌ "role": "supplier"  // Requires admin authentication
✅ "role": "reseller"  // Anyone can register
```

---

## 🧪 Test Registration with cURL

Test the registration endpoint directly:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "reseller"
  }'
```

**Expected Success Response**:
```json
{
  "success": true,
  "message": "Registration successful. Please login.",
  "data": {
    "user": {
      "id": "...",
      "name": "Test User",
      "email": "test@example.com",
      "role": "reseller"
    }
  }
}
```

**Expected Error Response**:
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

---

## 🔧 Frontend Registration Form

Make sure your frontend sends the correct format:

```typescript
// Example: Frontend registration call
const response = await fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: formData.name,        // Required
    email: formData.email,      // Required
    password: formData.password, // Required
    role: 'reseller',           // Required: 'admin' | 'supplier' | 'reseller'
  }),
});
```

---

## 📋 Quick Checklist

- [ ] All 4 fields are included: `name`, `email`, `password`, `role`
- [ ] Email is valid format (contains @)
- [ ] Name is 2+ characters
- [ ] Password is 6+ characters
- [ ] Role is exactly: `"admin"`, `"supplier"`, or `"reseller"` (lowercase)
- [ ] Email is not already registered
- [ ] If registering as `admin` or `supplier`, you're authenticated as admin
- [ ] Content-Type header is `application/json`
- [ ] Request body is valid JSON

---

## 🐛 Debug Steps

1. **Check Backend Console**
   - Look for error logs
   - Check for validation errors

2. **Check Network Tab**
   - See the exact request being sent
   - See the exact error response

3. **Test with cURL**
   - Bypass frontend to test API directly
   - Verify backend is working

4. **Check Request Format**
   - Ensure JSON is valid
   - Ensure all fields are present
   - Ensure Content-Type header is set

---

## 💡 Quick Fix

If you're trying to register as `admin` or `supplier`:

**Option 1**: Register as `reseller` first
```json
{
  "name": "Your Name",
  "email": "your@email.com",
  "password": "password123",
  "role": "reseller"  // ✅ Anyone can register as reseller
}
```

**Option 2**: Create admin user directly in database, then login and create other users

**Option 3**: In development, you can temporarily allow admin registration (not recommended for production)

---

## 🔍 Still Not Working?

1. **Check backend is running**: `http://localhost:5000/health`
2. **Check MongoDB is connected**: Look for connection logs
3. **Check CORS**: Make sure frontend URL is allowed
4. **Check request format**: Use browser DevTools Network tab

**Share these details for help**:
- Backend console error logs
- Network tab request/response
- Request body you're sending
- Browser console errors

---

**Most common issue**: Missing `role` field or trying to register as `admin`/`supplier` without admin privileges.

