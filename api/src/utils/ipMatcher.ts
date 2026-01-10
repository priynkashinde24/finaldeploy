import ipaddr from 'ipaddr.js';

/**
 * Check if an IP matches a given ipRange (single IP or CIDR)
 * Supports IPv4. IPv6 can be added later if needed.
 */
export function matchIP(ip: string, ipRange: string): boolean {
  try {
    const addr = ipaddr.parse(ip);

    // Single IP
    if (!ipRange.includes('/')) {
      const rangeAddr = ipaddr.parse(ipRange);
      return addr.toString() === rangeAddr.toString();
    }

    // CIDR
    const [range, prefix] = ipRange.split('/');
    const rangeAddr = ipaddr.parse(range);
    const parsed = ipaddr.parseCIDR(`${rangeAddr.toString()}/${prefix}`);
    return addr.kind() === parsed[0].kind() && addr.match(parsed);
  } catch (e) {
    console.error('[IP MATCHER] Invalid IP or CIDR:', { ip, ipRange, error: e });
    return false;
  }
}


