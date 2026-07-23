import nodemailer from 'nodemailer'
import type { SendEmailReceiptParams, EmailProvider } from '@/modules/receipt/application/providers/EmailProvider.interface'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const emailLog = logger.child('EmailProvider')

export class NodemailerEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter

    if (!environment.SMTP_HOST || !environment.SMTP_USER || !environment.SMTP_PASS) {
      emailLog.warn('smtp_not_configured')
      return null
    }

    this.transporter = nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_PORT === 465,
      auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASS },
    })

    return this.transporter
  }

  async sendReceipt(params: SendEmailReceiptParams): Promise<void> {
    const transporter = this.getTransporter()
    if (!transporter) {
      emailLog.warn('email_skipped_no_smtp', { to: params.to, shortCode: params.shortCode })
      return
    }

    const from = environment.MAIL_FROM || environment.SMTP_USER

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: `Olá! Segue em anexo o comprovante do seu pedido ${params.shortCode} na ${params.storeName}.`,
      attachments: [
        {
          filename: `recibo-${params.shortCode}.pdf`,
          content: params.pdf,
          contentType: 'application/pdf',
        },
      ],
    })

    emailLog.info('email_sent', { to: params.to, shortCode: params.shortCode })
  }
}
