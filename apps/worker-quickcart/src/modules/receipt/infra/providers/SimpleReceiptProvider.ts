import PDFDocument from 'pdfkit'
import type { ReceiptProvider, ReceiptParams, ReceiptResult } from '@/modules/receipt/application/providers/ReceiptProvider.interface'

function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export class SimpleReceiptProvider implements ReceiptProvider {
  async generate(params: ReceiptParams): Promise<ReceiptResult> {
    const pdf = await this.buildPdf(params)
    return { pdf, fiscalDocumentId: null }
  }

  private buildPdf(params: ReceiptParams): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const doc = new PDFDocument({ margin: 40, size: 'A4' })

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(18).text(params.storeName, { align: 'center' })
      if (params.storeCnpj) {
        doc.fontSize(9).text(`CNPJ: ${params.storeCnpj}`, { align: 'center' })
      }
      if (params.storeAddress) {
        doc.fontSize(9).text(params.storeAddress, { align: 'center' })
      }
      doc.moveDown(0.5)

      doc.fontSize(12).text(`Pedido ${params.shortCode}`, { align: 'center' })
      doc.fontSize(9).text(`Emitido em ${formatDate(params.createdAt)}`, { align: 'center' })
      doc.moveDown(0.5)

      if (params.customerName) {
        doc.fontSize(10).text(`Cliente: ${params.customerName}`)
      }

      doc.fontSize(10).text(`Entrega: ${this.deliveryTypeLabel(params.deliveryType)}`)
      doc.fontSize(10).text(`Pagamento: ${this.paymentMethodLabel(params.paymentMethod)}`)
      doc.moveDown(0.5)

      this.drawLine(doc)
      doc.fontSize(9).text('Item', 40, doc.y, { width: 220 })
      doc.text('Qtd', 270, doc.y - 12, { width: 40, align: 'right' })
      doc.text('Unit', 320, doc.y - 12, { width: 70, align: 'right' })
      doc.text('Total', 400, doc.y - 12, { width: 70, align: 'right' })
      this.drawLine(doc)

      for (const item of params.items) {
        doc.fontSize(9).text(item.productName, 40, doc.y + 2, { width: 220 })
        doc.text(String(item.quantity), 270, doc.y - 10, { width: 40, align: 'right' })
        doc.text(formatPrice(item.unitPriceInCents), 320, doc.y - 10, { width: 70, align: 'right' })
        doc.text(formatPrice(item.totalInCents), 400, doc.y - 10, { width: 70, align: 'right' })
      }

      this.drawLine(doc)
      doc.moveDown(0.3)
      doc.fontSize(11).text(`Total: ${formatPrice(params.totalInCents)}`, { align: 'right' })
      doc.moveDown(1)

      doc.fontSize(8).text('Obrigado por comprar com a gente!', { align: 'center' })

      doc.end()
    })
  }

  private drawLine(doc: PDFKit.PDFDocument): void {
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke()
    doc.moveDown(0.3)
  }

  private deliveryTypeLabel(type: string): string {
    return type === 'delivery' ? 'Delivery' : 'Retirada na loja'
  }

  private paymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      pix: 'Pix',
      card_on_delivery: 'Cartão na entrega',
      cash: 'Dinheiro',
    }
    return labels[method] ?? method
  }
}
