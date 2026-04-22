import { EmailTemplate, EmailTemplateData, NotificationType } from '../types';

// Company branding
const BRAND = {
  name: 'LaLaRente',
  primaryColor: '#002395',
  secondaryColor: '#FFB81C',
  supportEmail: 'support@lalarente.co.za',
  website: 'https://lalarente.co.za',
};

// Email layout wrapper
const emailLayout = (content: string, preheader: string = ''): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${BRAND.name}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
  </style>
</head>
<body style="background-color: #f5f5f5; margin: 0; padding: 0;">
  <span class="preheader">${preheader}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: ${BRAND.primaryColor}; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${BRAND.name}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                Need help? Contact us at <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.primaryColor};">${BRAND.supportEmail}</a>
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Button component
const button = (text: string, url: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td style="background-color: ${BRAND.primaryColor}; border-radius: 6px;">
      <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;

// Alert box component
const alertBox = (message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info'): string => {
  const colors = {
    info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
    warning: { bg: '#fff8e1', border: '#ffc107', text: '#f57c00' },
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  };
  const style = colors[type];
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background-color: ${style.bg}; border-left: 4px solid ${style.border}; padding: 15px 20px; border-radius: 4px;">
          <p style="margin: 0; color: ${style.text}; font-size: 14px;">${message}</p>
        </td>
      </tr>
    </table>
  `;
};

// Email templates
export const emailTemplates: Record<NotificationType, (data: EmailTemplateData) => EmailTemplate> = {
  // Lease notifications
  lease_created: (data) => ({
    subject: `New Lease Created - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Lease Created</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A new lease has been created for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Property:</strong> ${data.propertyTitle}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Start Date:</strong> ${data.startDate}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>End Date:</strong> ${data.endDate}</p>
          <p style="margin: 0; color: #333;"><strong>Monthly Rent:</strong> R${data.monthlyRent}</p>
        </td></tr>
      </table>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please review and sign the lease agreement to proceed.
      </p>
      ${button('View Lease', data.leaseUrl || '#')}
    `, `New lease created for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nA new lease has been created for ${data.propertyTitle}.\n\nProperty: ${data.propertyTitle}\nStart Date: ${data.startDate}\nEnd Date: ${data.endDate}\nMonthly Rent: R${data.monthlyRent}\n\nPlease review and sign the lease agreement to proceed.\n\nView lease: ${data.leaseUrl || '#'}`,
  }),

  lease_signed: (data) => ({
    subject: `Lease Signed - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Lease Agreement Signed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('The lease agreement has been successfully signed by all parties.', 'success')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        The lease for <strong>${data.propertyTitle}</strong> is now active.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Property:</strong> ${data.propertyTitle}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Signed By:</strong> ${data.signerName}</p>
          <p style="margin: 0; color: #333;"><strong>Signed On:</strong> ${data.signedDate}</p>
        </td></tr>
      </table>
      ${button('View Signed Lease', data.leaseUrl || '#')}
    `, `Lease signed for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nThe lease agreement has been successfully signed.\n\nProperty: ${data.propertyTitle}\nSigned By: ${data.signerName}\nSigned On: ${data.signedDate}\n\nView signed lease: ${data.leaseUrl || '#'}`,
  }),

  lease_expiring: (data) => ({
    subject: `Lease Expiring Soon - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Lease Expiring Soon</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox(`Your lease for ${data.propertyTitle} will expire on ${data.expiryDate}.`, 'warning')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please contact ${data.role === 'tenant' ? 'your landlord' : 'your tenant'} to discuss renewal options.
      </p>
      ${button('View Lease Details', data.leaseUrl || '#')}
    `, `Lease expiring on ${data.expiryDate}`),
    text: `Hello ${data.recipientName},\n\nYour lease for ${data.propertyTitle} will expire on ${data.expiryDate}.\n\nPlease contact ${data.role === 'tenant' ? 'your landlord' : 'your tenant'} to discuss renewal options.\n\nView lease: ${data.leaseUrl || '#'}`,
  }),

  lease_expired: (data) => ({
    subject: `Lease Expired - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Lease Has Expired</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox(`The lease for ${data.propertyTitle} has expired.`, 'error')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please take action to either renew the lease or arrange for move-out procedures.
      </p>
      ${button('View Options', data.leaseUrl || '#')}
    `, `Lease expired for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nThe lease for ${data.propertyTitle} has expired.\n\nPlease take action to either renew the lease or arrange for move-out procedures.`,
  }),

  // Payment notifications
  payment_due: (data) => ({
    subject: `Payment Due - R${data.amount}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Payment Due</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A payment is due for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px; text-align: center;">
          <p style="margin: 0 0 5px; color: #666; font-size: 14px;">Amount Due</p>
          <p style="margin: 0 0 15px; color: ${BRAND.primaryColor}; font-size: 32px; font-weight: 700;">R${data.amount}</p>
          <p style="margin: 0; color: #666; font-size: 14px;">Due Date: <strong>${data.dueDate}</strong></p>
        </td></tr>
      </table>
      ${button('Pay Now', data.paymentUrl || '#')}
    `, `Payment of R${data.amount} due on ${data.dueDate}`),
    text: `Hello ${data.recipientName},\n\nA payment is due for ${data.propertyTitle}.\n\nAmount: R${data.amount}\nDue Date: ${data.dueDate}\n\nPay now: ${data.paymentUrl || '#'}`,
  }),

  payment_received: (data) => ({
    subject: `Payment Received - R${data.amount}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Payment Received</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Thank you! Your payment has been received.', 'success')}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Amount:</strong> R${data.amount}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Property:</strong> ${data.propertyTitle}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Reference:</strong> ${data.reference}</p>
          <p style="margin: 0; color: #333;"><strong>Date:</strong> ${data.paymentDate}</p>
        </td></tr>
      </table>
      ${button('View Receipt', data.receiptUrl || '#')}
    `, `Payment of R${data.amount} received`),
    text: `Hello ${data.recipientName},\n\nThank you! Your payment has been received.\n\nAmount: R${data.amount}\nProperty: ${data.propertyTitle}\nReference: ${data.reference}\nDate: ${data.paymentDate}`,
  }),

  payment_overdue: (data) => ({
    subject: `⚠️ Payment Overdue - R${data.amount}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Payment Overdue</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox(`Your payment of R${data.amount} is now ${data.daysOverdue} days overdue.`, 'error')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please make payment as soon as possible to avoid any late fees or further action.
      </p>
      ${button('Pay Now', data.paymentUrl || '#')}
    `, `Payment overdue by ${data.daysOverdue} days`),
    text: `Hello ${data.recipientName},\n\nYour payment of R${data.amount} is now ${data.daysOverdue} days overdue.\n\nPlease make payment as soon as possible.\n\nPay now: ${data.paymentUrl || '#'}`,
  }),

  payment_failed: (data) => ({
    subject: `Payment Failed - R${data.amount}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Payment Failed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Unfortunately, your payment could not be processed.', 'error')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        <strong>Reason:</strong> ${data.failureReason || 'Transaction declined'}
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please try again or use a different payment method.
      </p>
      ${button('Retry Payment', data.paymentUrl || '#')}
    `, `Payment of R${data.amount} failed`),
    text: `Hello ${data.recipientName},\n\nYour payment of R${data.amount} could not be processed.\n\nReason: ${data.failureReason || 'Transaction declined'}\n\nPlease try again: ${data.paymentUrl || '#'}`,
  }),

  // Maintenance notifications
  maintenance_created: (data) => ({
    subject: `New Maintenance Request - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Maintenance Request</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A new maintenance request has been submitted for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Issue:</strong> ${data.title}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Category:</strong> ${data.category}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Priority:</strong> ${data.priority}</p>
          <p style="margin: 0; color: #333;"><strong>Description:</strong> ${data.description}</p>
        </td></tr>
      </table>
      ${button('View Request', data.requestUrl || '#')}
    `, `Maintenance request: ${data.title}`),
    text: `Hello ${data.recipientName},\n\nA new maintenance request has been submitted.\n\nProperty: ${data.propertyTitle}\nIssue: ${data.title}\nCategory: ${data.category}\nPriority: ${data.priority}\n\nView request: ${data.requestUrl || '#'}`,
  }),

  maintenance_updated: (data) => ({
    subject: `Maintenance Update - ${data.title}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Maintenance Update</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        There's an update on your maintenance request.
      </p>
      ${alertBox(`Status: ${data.newStatus}`, 'info')}
      ${data.comment ? `<p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;"><strong>Note:</strong> ${data.comment}</p>` : ''}
      ${button('View Details', data.requestUrl || '#')}
    `, `Maintenance update: ${data.newStatus}`),
    text: `Hello ${data.recipientName},\n\nThere's an update on your maintenance request "${data.title}".\n\nNew Status: ${data.newStatus}\n${data.comment ? `Note: ${data.comment}` : ''}\n\nView details: ${data.requestUrl || '#'}`,
  }),

  maintenance_completed: (data) => ({
    subject: `Maintenance Completed - ${data.title}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Maintenance Completed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Your maintenance request has been completed.', 'success')}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Issue:</strong> ${data.title}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Completed On:</strong> ${data.completedDate}</p>
          ${data.completionNotes ? `<p style="margin: 0; color: #333;"><strong>Notes:</strong> ${data.completionNotes}</p>` : ''}
        </td></tr>
      </table>
      ${button('Rate Service', data.ratingUrl || '#')}
    `, `Maintenance completed: ${data.title}`),
    text: `Hello ${data.recipientName},\n\nYour maintenance request "${data.title}" has been completed.\n\nCompleted On: ${data.completedDate}\n${data.completionNotes ? `Notes: ${data.completionNotes}` : ''}`,
  }),

  // Inspection notifications
  inspection_scheduled: (data) => ({
    subject: `Inspection Scheduled - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Inspection Scheduled</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A ${data.inspectionType} inspection has been scheduled for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Date:</strong> ${data.inspectionDate}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Time:</strong> ${data.inspectionTime}</p>
          <p style="margin: 0; color: #333;"><strong>Type:</strong> ${data.inspectionType}</p>
        </td></tr>
      </table>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Please ensure the property is accessible at the scheduled time.
      </p>
      ${button('View Details', data.inspectionUrl || '#')}
    `, `Inspection on ${data.inspectionDate}`),
    text: `Hello ${data.recipientName},\n\nAn inspection has been scheduled.\n\nProperty: ${data.propertyTitle}\nDate: ${data.inspectionDate}\nTime: ${data.inspectionTime}\nType: ${data.inspectionType}\n\nView details: ${data.inspectionUrl || '#'}`,
  }),

  inspection_completed: (data) => ({
    subject: `Inspection Completed - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Inspection Completed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('The inspection has been completed.', 'success')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        The ${data.inspectionType} inspection report for <strong>${data.propertyTitle}</strong> is now available.
      </p>
      ${button('View Report', data.reportUrl || '#')}
    `, `Inspection report ready for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nThe inspection has been completed.\n\nProperty: ${data.propertyTitle}\nType: ${data.inspectionType}\n\nView report: ${data.reportUrl || '#'}`,
  }),

  // Message notification
  message_received: (data) => ({
    subject: `New Message from ${data.senderName}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Message</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        You have a new message from <strong>${data.senderName}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0; color: #333; font-style: italic;">"${data.messagePreview}..."</p>
        </td></tr>
      </table>
      ${button('View Message', data.threadUrl || '#')}
    `, `Message from ${data.senderName}`),
    text: `Hello ${data.recipientName},\n\nYou have a new message from ${data.senderName}.\n\n"${data.messagePreview}..."\n\nView message: ${data.threadUrl || '#'}`,
  }),

  // Document notifications
  document_uploaded: (data) => ({
    subject: `New Document Uploaded - ${data.documentTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Document</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A new document has been uploaded: <strong>${data.documentTitle}</strong>
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Type:</strong> ${data.documentType}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Uploaded By:</strong> ${data.uploaderName}</p>
          ${data.propertyTitle ? `<p style="margin: 0; color: #333;"><strong>Property:</strong> ${data.propertyTitle}</p>` : ''}
        </td></tr>
      </table>
      ${button('View Document', data.documentUrl || '#')}
    `, `${data.documentTitle} uploaded`),
    text: `Hello ${data.recipientName},\n\nA new document has been uploaded.\n\nTitle: ${data.documentTitle}\nType: ${data.documentType}\nUploaded By: ${data.uploaderName}\n\nView document: ${data.documentUrl || '#'}`,
  }),

  document_expiring: (data) => ({
    subject: `Document Expiring Soon - ${data.documentTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Document Expiring</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox(`"${data.documentTitle}" will be deleted on ${data.expiryDate}.`, 'warning')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        If you need to keep this document, please download it or extend the retention period.
      </p>
      ${button('Manage Document', data.documentUrl || '#')}
    `, `Document expiring on ${data.expiryDate}`),
    text: `Hello ${data.recipientName},\n\n"${data.documentTitle}" will be deleted on ${data.expiryDate}.\n\nIf you need to keep this document, please download it or extend the retention period.\n\nManage document: ${data.documentUrl || '#'}`,
  }),

  // Application notifications
  application_received: (data) => ({
    subject: `New Application Received - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Application</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        You have received a new rental application for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Applicant:</strong> ${data.applicantName}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Move-in Date:</strong> ${data.moveInDate}</p>
          <p style="margin: 0; color: #333;"><strong>Submitted:</strong> ${data.submittedDate}</p>
        </td></tr>
      </table>
      ${button('Review Application', data.applicationUrl || '#')}
    `, `New application from ${data.applicantName}`),
    text: `Hello ${data.recipientName},\n\nYou have received a new rental application.\n\nProperty: ${data.propertyTitle}\nApplicant: ${data.applicantName}\nMove-in Date: ${data.moveInDate}\n\nReview application: ${data.applicationUrl || '#'}`,
  }),

  application_approved: (data) => ({
    subject: `Application Approved - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Application Approved!</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Congratulations! Your rental application has been approved.', 'success')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Your application for <strong>${data.propertyTitle}</strong> has been approved.
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Next steps: Review and sign the lease agreement.
      </p>
      ${button('View Lease', data.leaseUrl || '#')}
    `, `Your application for ${data.propertyTitle} has been approved!`),
    text: `Hello ${data.recipientName},\n\nCongratulations! Your rental application has been approved.\n\nProperty: ${data.propertyTitle}\n\nNext steps: Review and sign the lease agreement.\n\nView lease: ${data.leaseUrl || '#'}`,
  }),

  application_rejected: (data) => ({
    subject: `Application Update - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Application Update</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Unfortunately, your application for <strong>${data.propertyTitle}</strong> was not successful at this time.
      </p>
      ${data.reason ? `<p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        We encourage you to continue searching for other properties that may be a better fit.
      </p>
      ${button('Browse Properties', data.searchUrl || '#')}
    `, `Application update for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nUnfortunately, your application for ${data.propertyTitle} was not successful.\n\n${data.reason ? `Reason: ${data.reason}\n\n` : ''}We encourage you to continue searching for other properties.`,
  }),

  // Viewing notifications
  viewing_scheduled: (data) => ({
    subject: `Viewing Scheduled - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Confirmed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A viewing has been scheduled for <strong>${data.propertyTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Date:</strong> ${data.viewingDate}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Time:</strong> ${data.viewingTime}</p>
          <p style="margin: 0; color: #333;"><strong>Address:</strong> ${data.propertyAddress}</p>
        </td></tr>
      </table>
      ${button('View Details', data.viewingUrl || '#')}
    `, `Viewing on ${data.viewingDate} at ${data.viewingTime}`),
    text: `Hello ${data.recipientName},\n\nA viewing has been scheduled.\n\nProperty: ${data.propertyTitle}\nDate: ${data.viewingDate}\nTime: ${data.viewingTime}\nAddress: ${data.propertyAddress}`,
  }),

  viewing_reminder: (data) => ({
    subject: `Reminder: Viewing Tomorrow - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Reminder</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Reminder: You have a property viewing tomorrow.', 'info')}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 10px; color: #333;"><strong>Property:</strong> ${data.propertyTitle}</p>
          <p style="margin: 0 0 10px; color: #333;"><strong>Time:</strong> ${data.viewingTime}</p>
          <p style="margin: 0; color: #333;"><strong>Address:</strong> ${data.propertyAddress}</p>
        </td></tr>
      </table>
      ${button('Get Directions', data.mapsUrl || '#')}
    `, `Viewing tomorrow at ${data.viewingTime}`),
    text: `Hello ${data.recipientName},\n\nReminder: You have a property viewing tomorrow.\n\nProperty: ${data.propertyTitle}\nTime: ${data.viewingTime}\nAddress: ${data.propertyAddress}`,
  }),

  // Account notifications
  welcome: (data) => ({
    subject: `Welcome to ${BRAND.name}!`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Welcome to ${BRAND.name}!</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Thank you for joining ${BRAND.name}. We're excited to help you with your rental journey.
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Here's what you can do:
      </p>
      <ul style="margin: 0 0 20px; padding-left: 20px; color: #666; font-size: 16px; line-height: 1.8;">
        <li>Browse available properties</li>
        <li>Submit rental applications</li>
        <li>Manage your leases and payments</li>
        <li>Communicate with landlords/tenants</li>
      </ul>
      ${button('Get Started', data.dashboardUrl || '#')}
    `, `Welcome to ${BRAND.name}`),
    text: `Hello ${data.recipientName},\n\nWelcome to ${BRAND.name}!\n\nThank you for joining us. We're excited to help you with your rental journey.\n\nGet started: ${data.dashboardUrl || '#'}`,
  }),

  password_reset: (data) => ({
    subject: `Reset Your Password - ${BRAND.name}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Reset Your Password</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        We received a request to reset your password. Click the button below to create a new password.
      </p>
      ${button('Reset Password', data.resetUrl || '#')}
      <p style="margin: 20px 0 0; color: #999; font-size: 14px;">
        This link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
      </p>
    `, 'Reset your password'),
    text: `Hello ${data.recipientName},\n\nWe received a request to reset your password.\n\nReset your password: ${data.resetUrl || '#'}\n\nThis link will expire in 24 hours. If you didn't request this, you can safely ignore this email.`,
  }),

  account_verified: (data) => ({
    subject: `Account Verified - ${BRAND.name}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Account Verified</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Your account has been successfully verified!', 'success')}
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        You now have full access to all features on ${BRAND.name}.
      </p>
      ${button('Go to Dashboard', data.dashboardUrl || '#')}
    `, 'Your account is verified'),
    text: `Hello ${data.recipientName},\n\nYour account has been successfully verified!\n\nYou now have full access to all features on ${BRAND.name}.\n\nGo to dashboard: ${data.dashboardUrl || '#'}`,
  }),

  // Viewing notifications
  viewing_requested: (data) => ({
    subject: `New Viewing Request - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Viewing Request</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        A viewing has been requested for <strong>${data.propertyTitle}</strong>.
      </p>
      ${button('View Request', data.viewingUrl || '#')}
    `, `Viewing request for ${data.propertyTitle}`),
    text: `Hello ${data.recipientName},\n\nA viewing has been requested for ${data.propertyTitle}.\n\nView request: ${data.viewingUrl || '#'}`,
  }),

  viewing_approved: (data) => ({
    subject: `Viewing Approved - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Approved</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      ${alertBox('Your viewing request has been approved!', 'success')}
      ${button('View Details', data.viewingUrl || '#')}
    `, 'Your viewing is approved'),
    text: `Hello ${data.recipientName},\n\nYour viewing request has been approved!\n\nView details: ${data.viewingUrl || '#'}`,
  }),

  viewing_declined: (data) => ({
    subject: `Viewing Declined - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Declined</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Unfortunately, your viewing request for <strong>${data.propertyTitle}</strong> has been declined.
      </p>
    `, 'Viewing declined'),
    text: `Hello ${data.recipientName},\n\nUnfortunately, your viewing request for ${data.propertyTitle} has been declined.`,
  }),

  viewing_cancelled: (data) => ({
    subject: `Viewing Cancelled - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Cancelled</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        The viewing for <strong>${data.propertyTitle}</strong> has been cancelled.
      </p>
    `, 'Viewing cancelled'),
    text: `Hello ${data.recipientName},\n\nThe viewing for ${data.propertyTitle} has been cancelled.`,
  }),

  viewing_completed: (data) => ({
    subject: `Viewing Completed - ${data.propertyTitle}`,
    html: emailLayout(`
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Viewing Completed</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Hello ${data.recipientName},
      </p>
      <p style="margin: 0 0 15px; color: #666; font-size: 16px; line-height: 1.6;">
        Thank you for viewing <strong>${data.propertyTitle}</strong>. We hope you enjoyed the tour!
      </p>
    `, 'Thank you for viewing'),
    text: `Hello ${data.recipientName},\n\nThank you for viewing ${data.propertyTitle}. We hope you enjoyed the tour!`,
  }),
};

export default emailTemplates;
