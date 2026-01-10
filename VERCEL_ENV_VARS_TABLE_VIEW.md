# Vercel Environment Variables Table View

## 📊 What the Table Looks Like

When you go to **Settings → Environment Variables** in Vercel, you'll see a table like this:

---

## 🎨 Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Environment Variables                                    [Add New]          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┬──────────────────────────────────────────────────┐ │
│  │ Key                │ Value                                             │ │
│  ├────────────────────┼──────────────────────────────────────────────────┤ │
│  │ MONGODB_URI        │ mongodb+srv://admin:Priyanka%4098@cluster0...    │ │
│  │                    │ [••••••••••••••••••••••••••••••••••••••••••••]  │ │
│  │                    │ ☑ Production  ☑ Preview  ☑ Development          │ │
│  │                    │ [Edit] [Delete]                                   │ │
│  ├────────────────────┼──────────────────────────────────────────────────┤ │
│  │ JWT_ACCESS_SECRET  │ [••••••••••••••••••••••••••••••••••••••••••••]  │ │
│  │                    │ ☑ Production  ☑ Preview  ☑ Development          │ │
│  │                    │ [Edit] [Delete]                                   │ │
│  ├────────────────────┼──────────────────────────────────────────────────┤ │
│  │ JWT_REFRESH_SECRET │ [••••••••••••••••••••••••••••••••••••••••••••]  │ │
│  │                    │ ☑ Production  ☑ Preview  ☑ Development          │ │
│  │                    │ [Edit] [Delete]                                   │ │
│  ├────────────────────┼──────────────────────────────────────────────────┤ │
│  │ FRONTEND_URL       │ https://your-frontend.vercel.app                │ │
│  │                    │ ☑ Production  ☑ Preview  ☑ Development          │ │
│  │                    │ [Edit] [Delete]                                   │ │
│  ├────────────────────┼──────────────────────────────────────────────────┤ │
│  │ NODE_ENV           │ production                                        │ │
│  │                    │ ☑ Production  ☑ Preview  ☑ Development          │ │
│  │                    │ [Edit] [Delete]                                   │ │
│  └────────────────────┴──────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Table Structure Explained

### Column 1: **Key** (Variable Name)
- Shows the environment variable name
- Examples: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `NODE_ENV`
- This is what you use in your code: `process.env.MONGODB_URI`

### Column 2: **Value** (Variable Value)
- Shows the actual value
- **Security Note**: Sensitive values (like passwords, secrets) are **masked** with dots (`••••••`)
- To see the actual value, click **"Edit"** or **"Reveal"** button
- Long values may be truncated with `...`

### Additional Information Shown:

1. **Environment Checkboxes** (below each value):
   - ☑ **Production** - Used in production deployments
   - ☑ **Preview** - Used in preview deployments (PR previews)
   - ☑ **Development** - Used in local development with Vercel CLI

2. **Action Buttons** (for each row):
   - **[Edit]** - Edit the variable
   - **[Delete]** - Remove the variable

---

## 🔍 Example Table View

Here's what your table might look like with actual variables:

| Key | Value | Environments | Actions |
|-----|-------|--------------|---------|
| `MONGODB_URI` | `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart` | ☑ Production<br>☑ Preview<br>☑ Development | [Edit] [Delete] |
| `JWT_ACCESS_SECRET` | `••••••••••••••••••••••••••••••••••••••••••••••••` (masked) | ☑ Production<br>☑ Preview<br>☑ Development | [Edit] [Delete] |
| `JWT_REFRESH_SECRET` | `••••••••••••••••••••••••••••••••••••••••••••••••` (masked) | ☑ Production<br>☑ Preview<br>☑ Development | [Edit] [Delete] |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | ☑ Production<br>☑ Preview<br>☑ Development | [Edit] [Delete] |
| `NODE_ENV` | `production` | ☑ Production<br>☑ Preview<br>☑ Development | [Edit] [Delete] |

---

## 🔐 Security Features

### Masked Values
- **Sensitive values** (secrets, passwords, API keys) are automatically **masked**
- They appear as: `••••••••••••••••••••••••••••••••`
- To view the actual value, click **"Edit"** or **"Reveal"**

### Which Values Are Masked?
- Values containing words like: `secret`, `password`, `key`, `token`, `api`
- Long random strings (likely secrets)
- Values you mark as sensitive when adding

---

## ➕ Adding a New Variable

When you click **"Add New"**, you'll see a form:

```
┌─────────────────────────────────────────────────┐
│ Add Environment Variable                        │
├─────────────────────────────────────────────────┤
│                                                 │
│ Key:                                            │
│ [___________________________]                   │
│                                                 │
│ Value:                                          │
│ [___________________________________________]   │
│                                                 │
│ Environments:                                   │
│ ☑ Production                                    │
│ ☑ Preview                                       │
│ ☑ Development                                   │
│                                                 │
│ [Cancel]  [Save]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## ✏️ Editing a Variable

When you click **"Edit"** on an existing variable:

```
┌─────────────────────────────────────────────────┐
│ Edit Environment Variable                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Key:                                            │
│ MONGODB_URI                                     │
│ (cannot be changed)                             │
│                                                 │
│ Value:                                          │
│ [mongodb+srv://admin:Priyanka%4098@cluster...] │
│                                                 │
│ Environments:                                   │
│ ☑ Production                                    │
│ ☑ Preview                                       │
│ ☑ Development                                   │
│                                                 │
│ [Cancel]  [Save]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📱 Mobile View

On mobile/tablet, the table may stack vertically:

```
┌─────────────────────────┐
│ MONGODB_URI             │
│ [••••••••••••••••••••] │
│ ☑ Production            │
│ ☑ Preview               │
│ ☑ Development           │
│ [Edit] [Delete]         │
├─────────────────────────┤
│ JWT_ACCESS_SECRET       │
│ [••••••••••••••••••••] │
│ ☑ Production            │
│ ☑ Preview               │
│ ☑ Development           │
│ [Edit] [Delete]         │
└─────────────────────────┘
```

---

## 🎯 Quick Tips

1. **View Value**: Click **"Edit"** to see masked values
2. **Copy Value**: Click **"Edit"**, then copy from the input field
3. **Bulk Add**: Add variables one at a time (no bulk import)
4. **Search**: Use browser search (Ctrl+F) to find specific variables
5. **Sort**: Variables are listed in the order you added them

---

## ✅ What You Should See

After adding your required variables, your table should show:

1. ✅ `MONGODB_URI` - Your MongoDB connection string
2. ✅ `JWT_ACCESS_SECRET` - Masked secret
3. ✅ `JWT_REFRESH_SECRET` - Masked secret
4. ✅ `FRONTEND_URL` - Your frontend URL
5. ✅ `NODE_ENV` - `production`

All with ☑ Production, ☑ Preview, ☑ Development checked.

---

That's how the environment variables table looks in Vercel! 🎉

