interface AttemptRecord {
  attempts: number[];
}

const ipFailures: Record<string, AttemptRecord> = {};
const emailFailures: Record<string, AttemptRecord> = {};

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function prune(record: AttemptRecord, now: number) {
  record.attempts = record.attempts.filter((ts) => now - ts <= WINDOW_MS);
}

export function registerFailedAttempt(ip: string, email?: string): { ipFlagged: boolean; emailFlagged: boolean } {
  const now = Date.now();

  if (ip) {
    ipFailures[ip] = ipFailures[ip] || { attempts: [] };
    prune(ipFailures[ip], now);
    ipFailures[ip].attempts.push(now);
  }

  if (email) {
    const key = email.toLowerCase();
    emailFailures[key] = emailFailures[key] || { attempts: [] };
    prune(emailFailures[key], now);
    emailFailures[key].attempts.push(now);
  }

  const ipFlagged = ip && ipFailures[ip]?.attempts.length >= MAX_ATTEMPTS;
  const emailFlagged = email ? emailFailures[email.toLowerCase()]?.attempts.length >= MAX_ATTEMPTS : false;

  return { ipFlagged: !!ipFlagged, emailFlagged: !!emailFlagged };
}

export function clearAttempts(ip: string, email?: string) {
  if (ip && ipFailures[ip]) delete ipFailures[ip];
  if (email && emailFailures[email.toLowerCase()]) delete emailFailures[email.toLowerCase()];
}


