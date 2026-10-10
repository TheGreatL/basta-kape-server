declare module '@emailjs/nodejs' {
    export interface EmailJSOptions {
        publicKey?: string;
        privateKey?: string;
    }

    export interface EmailJSResponse {
        status: number;
        text: string;
    }

    export function send(
        serviceID: string,
        templateID: string,
        templateParams?: Record<string, unknown>,
        options?: EmailJSOptions
    ): Promise<EmailJSResponse>;

    const emailjs: {
        send: typeof send;
    };

    export default emailjs;
}
