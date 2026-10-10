import { describe, it, expect, vi, beforeEach } from 'vitest';
import emailjs from '@emailjs/nodejs';
import { EmailService } from '@/feature/email/email.service';

vi.mock('@emailjs/nodejs', () => ({
    default: {
        send: vi.fn()
    }
}));

describe('EmailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should format and send password reset email via EmailJS', async () => {
        vi.mocked(emailjs.send).mockResolvedValueOnce({ status: 200, text: 'OK' });

        const result = await EmailService.sendPasswordResetEmail({
            toEmail: 'customer@example.com',
            toName: 'Maria Santos',
            resetLink: 'http://localhost:5173/reset-password?token=test-token-123',
            resetToken: 'test-token-123',
            expiryMinutes: 60
        });

        expect(result.success).toBe(true);
        expect(emailjs.send).toHaveBeenCalledTimes(1);
        expect(emailjs.send).toHaveBeenCalledWith(
            'service_d20371i',
            'template_k4wb3er',
            expect.objectContaining({
                to_email: 'customer@example.com',
                to_name: 'Maria Santos',
                reset_link: 'http://localhost:5173/reset-password?token=test-token-123',
                reset_token: 'test-token-123',
                otp_code: 'test-token-123',
                expiry_minutes: '60'
            }),
            expect.objectContaining({
                publicKey: 'oh1IZ--hlPRtd7rLz',
                privateKey: '5HLyLrbu3-8GjVicZliEP'
            })
        );
    });

    it('should format and send OTP email via EmailJS', async () => {
        vi.mocked(emailjs.send).mockResolvedValueOnce({ status: 200, text: 'OK' });

        const result = await EmailService.sendOtpEmail({
            toEmail: 'customer@example.com',
            toName: 'Juan Dela Cruz',
            otpCode: '849201',
            expiryMinutes: 10
        });

        expect(result.success).toBe(true);
        expect(emailjs.send).toHaveBeenCalledTimes(1);
        expect(emailjs.send).toHaveBeenCalledWith(
            'service_d20371i',
            'template_cxf4g5f',
            expect.objectContaining({
                to_email: 'customer@example.com',
                to_name: 'Juan Dela Cruz',
                otp_code: '849201',
                expiry_minutes: '10'
            }),
            expect.objectContaining({
                publicKey: 'oh1IZ--hlPRtd7rLz',
                privateKey: '5HLyLrbu3-8GjVicZliEP'
            })
        );
    });

    it('should handle EmailJS errors gracefully without throwing', async () => {
        vi.mocked(emailjs.send).mockRejectedValueOnce(new Error('Network error or invalid template'));

        const result = await EmailService.sendOtpEmail({
            toEmail: 'error@example.com',
            toName: 'Test User',
            otpCode: '111222'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error or invalid template');
    });
});
