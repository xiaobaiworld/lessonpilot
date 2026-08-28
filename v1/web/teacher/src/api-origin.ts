interface PageLocation {
  hostname: string;
  origin: string;
}

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function getTeacherApiOrigin(pageLocation: PageLocation): string {
  return localHosts.has(pageLocation.hostname) ? '' : pageLocation.origin;
}
