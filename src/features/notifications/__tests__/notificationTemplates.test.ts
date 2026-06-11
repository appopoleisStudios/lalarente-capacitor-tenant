import { emailTemplates } from "../templates/emailTemplates";
import { smsTemplates } from "../templates/smsTemplates";
import { EmailTemplateData, SmsTemplateData } from "../types";

describe ('Notification Templates Coverage', () => {
    describe ('Payment Due (Rent reminder)', () => {
        const mockData: EmailTemplateData & SmsTemplateData = {
            recipientName: 'Aamir',
            amount: 8500,
            dueDate: '2026-07-01',
            propertyTitle: 'Crystal Mira Road',
            paymentUrl: 'https://lalarente.co.za/pay/123',
            recipientEmail: 'amirbehlim123@gmail.com',
            recipientPhone: '1234567890',
 };

        it('should correctly format the rent reminder email subject and body content', () => {
            const email = emailTemplates.payment_due(mockData as unknown as EmailTemplateData);
            expect(email.subject).toBe('Payment Due - R8500');
            expect(email.html).toContain('Hello Aamir');
            expect(email.html).toContain('Crystal Mira Road');
            expect(email.html).toContain('R8500');
            expect(email.html).toContain('2026-07-01');
        });

        it('should correctly format the rent reminder SMS string text', () => {
            const sms = smsTemplates.payment_due(mockData);
            expect(sms.message).toBe('LaLaRente: Payment of R8500 due on 2026-07-01 for Crystal Mira Road. Pay via app.');
        });

        it('should handle edge case if the amount is 0 gracefully', () => {
            const zeroData = { ...mockData, amount: 0 };
            const email = emailTemplates.payment_due(zeroData);
            const sms = smsTemplates.payment_due(zeroData);

            expect(email.subject).toBe('Payment Due - R0');
            expect(sms.message).toContain('Payment of R0 due');
        });
    });
 
    describe('Maintenance Updated', () => {
    const mockData: EmailTemplateData & SmsTemplateData = {
      recipientName: 'zack',
      title: 'Geyser Leak',
      newStatus: 'In Progress',
      comment: 'Plumber dispatched to site.',
      requestUrl: 'https://lalarente.co.za/maintenance/456',
       recipientEmail: 'amirbehlim123@gmail.com',
      recipientPhone: '1234567890'
    };

    it('should inject the status correctly into the maintenance email template', () => {
      const email = emailTemplates.maintenance_updated(mockData);
      
      expect(email.subject).toContain('Maintenance Update');
      expect(email.html).toContain('Status: In Progress');
      expect(email.html).toContain('Plumber dispatched to site.');
    });

    it('should include the title and the status inside the SMS output text', () => {
        const sms = smsTemplates.maintenance_updated(mockData);
      expect(sms.message).toBe('LaLaRente: Maintenance "Geyser Leak" updated to In Progress. Check app for details.');
    });
    
    it('should handle edge case when status and comment are empty strings', () => {
      const emptyData = { ...mockData, newStatus: '', comment: '' };
      const email = emailTemplates.maintenance_updated(emptyData);
      const sms = smsTemplates.maintenance_updated(emptyData);

      expect(email.html).toContain('Status: ');
      expect(sms.message).toContain('updated to ');
    });
});

describe('Lease Expiring Soon', ()=> {
    const mockData: EmailTemplateData & SmsTemplateData = {
      recipientName: 'mike',
      propertyTitle: 'Beachfront Villa 12',
      expiryDate: '2026-08-10',
      role: 'tenant',
      leaseUrl: 'https://lalarente.co.za/leases/789',
      recipientPhone: '0821234567',
      recipientEmail: 'xyz@gmail.coom'
    };

    it('should correctly output the 60-day expiry date in the email warning details', () => {
      const email = emailTemplates.lease_expiring(mockData);
      
      expect(email.subject).toBe('Lease Expiring Soon - Beachfront Villa 12');
      expect(email.html).toContain('will expire on 2026-08-10');
      expect(email.html).toContain('your landlord');
    });

    it('should correctly mention the target expiry date string in the SMS message', () => {
      const sms = smsTemplates.lease_expiring(mockData);
      expect(sms.message).toBe('LaLaRente: Your lease for Beachfront Villa 12 expires on 2026-08-10. Contact us to discuss renewal.');
    });

    it ('should alter context dynamically when recipient role changes to landlord', () => {
        const landlordData = {...mockData, role: 'landlord'};
        const email = emailTemplates.lease_expiring(landlordData);

        expect(email.html).toContain('your tenant');
    });

    it('should handle edge case when recipient name is an empty string', () => {
        const emptyNameData = { ...mockData, recipientName: '' };
        const email = emailTemplates.lease_expiring(emptyNameData);

        expect(email.html).toContain('Hello ,');
    });
});
});



