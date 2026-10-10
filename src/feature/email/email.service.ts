import emailjs from '@emailjs/nodejs';
import { env } from '@/env';

export interface ISendPasswordResetParams {
    toEmail: string;
    toName: string;
    resetLink: string;
    resetToken: string;
    expiryMinutes?: number;
}

export interface ISendOtpParams {
    toEmail: string;
    toName: string;
    otpCode: string;
    expiryMinutes?: number;
}

export class EmailService {
    private static getCredentials() {
        const serviceId = env.EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID;
        const publicKey = env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY;
        const privateKey = env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_PRIVATE_KEY;
        const otpTemplateId = env.EMAILJS_OTP_TEMPLATE_ID || process.env.EMAILJS_OTP_TEMPLATE_ID;
        const passwordResetTemplateId = env.EMAILJS_PASSWORD_RESET_TEMPLATE_ID || process.env.EMAILJS_PASSWORD_RESET_TEMPLATE_ID;

        if (!serviceId || !publicKey || !privateKey) {
            console.warn('[EmailService] Missing EmailJS credentials. Emails will not be dispatched.');
            return null;
        }

        return {
            serviceId,
            publicKey,
            privateKey,
            otpTemplateId,
            passwordResetTemplateId
        };
    }

    /**
     * Send Password Reset Email using EmailJS template (template_k4wb3er)
     */
    static async sendPasswordResetEmail(params: ISendPasswordResetParams): Promise<{ success: boolean; error?: string }> {
        const creds = this.getCredentials();
        if (!creds || !creds.passwordResetTemplateId) {
            console.warn('[EmailService] Password reset template not configured.');
            return { success: false, error: 'Email service credentials not configured' };
        }

        try {
            const templateParams = {
                to_email: params.toEmail,
                to_name: params.toName,
                reset_link: params.resetLink,
                reset_token: params.resetToken,
                otp_code: params.resetToken,
                expiry_minutes: String(params.expiryMinutes ?? 60)
            };

            await emailjs.send(creds.serviceId, creds.passwordResetTemplateId, templateParams, {
                publicKey: creds.publicKey,
                privateKey: creds.privateKey
            });

            console.log(`[EmailService] Password reset email sent to ${params.toEmail}`);
            return { success: true };
        } catch (error) {
            console.error('[EmailService] Failed to send password reset email:', error instanceof Error ? error.message : String(error));
            return { success: false, error: error instanceof Error ? error.message : String(error) || 'Failed to dispatch email' };
        }
    }

    /**
     * Send One-Time Password (OTP) Email using EmailJS template (template_cxf4g5f)
     */
    static async sendOtpEmail(params: ISendOtpParams): Promise<{ success: boolean; error?: string }> {
        const creds = this.getCredentials();
        if (!creds || !creds.otpTemplateId) {
            console.warn('[EmailService] OTP template not configured.');
            return { success: false, error: 'Email service credentials not configured' };
        }

        try {
            const templateParams = {
                to_email: params.toEmail,
                to_name: params.toName,
                otp_code: params.otpCode,
                expiry_minutes: String(params.expiryMinutes ?? 10)
            };

            await emailjs.send(creds.serviceId, creds.otpTemplateId, templateParams, {
                publicKey: creds.publicKey,
                privateKey: creds.privateKey
            });

            console.log(`[EmailService] OTP email sent to ${params.toEmail}`);
            return { success: true };
        } catch (error) {
            console.error('[EmailService] Failed to send OTP email:', error instanceof Error ? error.message : String(error));
            return { success: false, error: error instanceof Error ? error.message : String(error) || 'Failed to dispatch email' };
        }
    }
}
