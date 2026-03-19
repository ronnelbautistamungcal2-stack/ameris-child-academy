export function buildParentMessageComposeHref({ subject, message }) {
  const params = new URLSearchParams();
  params.set("compose", "1");

  if (subject) params.set("subject", subject);
  if (message) params.set("message", message);

  return `/parent/messages?${params.toString()}`;
}
