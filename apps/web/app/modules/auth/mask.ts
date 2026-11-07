/**
 * Hides most of an email address when it is shown back to the person ("p***@gmail.com"): enough to
 * recognise, not enough for someone looking over a shoulder to read it. The domain stays visible.
 */
export function maskEmail(email: string): string {
  const v = email.trim();
  const at = v.lastIndexOf('@');
  if (at < 1) return v ? '***' : '';
  const local = v.slice(0, at);
  return `${local.length > 1 ? local[0] : ''}***${v.slice(at)}`;
}
