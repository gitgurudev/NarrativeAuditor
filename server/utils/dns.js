// Resolves mongodb+srv:// URIs via Google DNS (bypasses ISP SRV block)
// Borrowed from AstroTalks — same MongoDB Atlas setup
import { Resolver } from 'dns/promises';

export async function resolveSrvUri(srvUri) {
  const withoutScheme = srvUri.replace('mongodb+srv://', 'https://');
  const url = new URL(withoutScheme);
  const host = url.hostname;

  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4']);

  console.log(`🔍 Resolving SRV for ${host} via Google DNS…`);
  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${host}`);

  let txtOptions = '';
  try {
    const txtRecords = await resolver.resolveTxt(host);
    txtOptions = txtRecords.flat().join('&');
  } catch { /* TXT optional */ }

  const hosts  = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
  const auth   = `${url.username}:${url.password}@`;
  const db     = url.pathname || '/';
  const search = url.search   || '';
  const params = txtOptions
    ? `?${txtOptions}&ssl=true`
    : `?authSource=admin&ssl=true${search ? '&' + search.slice(1) : ''}`;

  console.log('✅ SRV resolved');
  return `mongodb://${auth}${hosts}${db}${params}`;
}
