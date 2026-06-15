export type EmailContent = { subject: string; body: string };

// v1 emails are plain-text English. Recipient locale is not tracked yet; localize later.
export function orderCreatedEmail(d: { orderNumber: string; orderTitle: string; url: string }): EmailContent {
  return {
    subject: `New order ${d.orderNumber}: ${d.orderTitle}`,
    body:
      `A new order has been created.\n\n` +
      `Order: ${d.orderNumber}\nTitle: ${d.orderTitle}\n\n` +
      `View it here: ${d.url}\n`,
  };
}

export function orderStatusChangedEmail(d: { orderNumber: string; status: string; url: string }): EmailContent {
  return {
    subject: `Order ${d.orderNumber} status: ${d.status}`,
    body:
      `The status of order ${d.orderNumber} changed to "${d.status}".\n\n` +
      `View it here: ${d.url}\n`,
  };
}

export function newCommentEmail(d: { orderNumber: string; authorName: string; preview: string; url: string }): EmailContent {
  return {
    subject: `New comment on order ${d.orderNumber}`,
    body:
      `${d.authorName} commented on order ${d.orderNumber}:\n\n` +
      `"${d.preview}"\n\n` +
      `Reply here: ${d.url}\n`,
  };
}

export function invitationEmail(d: { url: string; role: string }): EmailContent {
  return {
    subject: `You have been invited to FreightOps`,
    body:
      `You have been invited to FreightOps as a ${d.role}.\n\n` +
      `Accept your invitation here: ${d.url}\n\n` +
      `This link expires in 7 days.\n`,
  };
}
