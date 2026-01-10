import dotenv from 'dotenv';

// Load environment variables from .env file ONLY in development/local
// On Vercel, environment variables are automatically available via process.env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export function validateEnv() {
  // Some deployments use legacy env var names; accept either form.
  const requiredAlways = ['MONGODB_URI', 'FRONTEND_URL'] as const;
  const hasAccessSecret = !!(process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const hasRefreshSecret = !!(process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET);

  const missingAlways = requiredAlways.filter((k) => !process.env[k]);
  const missing = [
    ...missingAlways,
    ...(hasAccessSecret ? [] : ['JWT_ACCESS_SECRET (or JWT_SECRET)']),
    ...(hasRefreshSecret ? [] : ['JWT_REFRESH_SECRET (or REFRESH_TOKEN_SECRET)']),
  ];
  if (missing.length) {
    const errorMessage = `Missing required env vars: ${missing.join(', ')}`;
    console.error(`❌ ${errorMessage}`);
    console.error('📝 Please add these environment variables (local: api/.env, deploy: your host env vars):');
    missing.forEach((key) => {
      console.error(`   - ${key}`);
    });
    
    // In production (or when explicitly requested), fail fast.
    // In local dev, warn and continue so the server can boot and return helpful 503s.
    const strict = process.env.STRICT_ENV_VALIDATION === 'true';
    if (process.env.NODE_ENV === 'production' || strict) {
      throw new Error(errorMessage);
    }
  }
}


