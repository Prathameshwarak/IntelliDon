// lib/generateReceiptPDF.js
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { formatLegalEmail } from './downloadReceipt'

function numberToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function inWords(n) {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
    if (n < 1000) return inWords(Math.floor(n / 100)) + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '')
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '')
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '')
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '')
  }

  const rounded = Math.round(Number(num) || 0)
  if (rounded <= 0) return 'Rupees Zero Only'
  return `Rupees ${inWords(rounded)} Only`
}

function formatDate(isoStr) {
  try {
    const d = isoStr ? new Date(isoStr) : new Date()
    const day = d.getDate()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = monthNames[d.getMonth()]
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    const strHours = String(hours).padStart(2, '0')
    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`
  } catch {
    return '23 July 2026, 02:35 PM'
  }
}

function getInitials(name) {
  if (!name) return 'ORG'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase()
  return parts.map(p => p[0]).join('').substring(0, 3).toUpperCase()
}

function buildHtmlContent(data) {
  const mandalName = data.mandalName || 'Organisation'
  const mandalAddress = data.mandalAddress || ''
  
  const cleanPhone = (data.mandalPhone || '').replace(/\D/g, '').slice(-10)
  const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : ''
  
  const legalEmail = formatLegalEmail(data.mandalEmail)
  const initials = getInitials(mandalName)

  const logoHtml = data.mandalLogo
    ? `<img src="${data.mandalLogo}" class="org-logo-circle" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; display: block;" alt="Logo" />`
    : `<div class="org-logo-circle" style="width: 50px; height: 50px; background-color: #E05305; color: #FFFFFF; border-radius: 50%; font-weight: 800; font-size: 18px; text-align: center; line-height: 50px; margin-bottom: 12px;">${initials}</div>`

  const dateStr = formatDate(data.createdAt)
  const amountFormatted = Number(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const wordsFormatted = numberToWords(data.amount)

  const isVerified = !!data.verified
  const collectorName = data.collectedBy || null
  const isCollectorVerified = !!(collectorName || data.verifiedByRole === 'collector')

  const statusBadgeClass = isVerified ? 'status-verified' : 'status-pending'
  let statusBadgeText = isVerified ? '✓ Confirmed' : '⏳ Pending Approval'
  if (isVerified && isCollectorVerified) {
    statusBadgeText = '✓ Verified by Collector'
  }

  const paymentModeLabel = data.paymentMode === 'cash'
    ? 'Cash'
    : data.paymentMode === 'upi_collector'
    ? 'UPI (Collector)'
    : 'UPI / Digital Wallet'

  const screenshotSrc = data.screenshotImage || data.screenshotUrl || null

  return `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F5EFE6; margin: 0; padding: 0; color: #2D251E; -webkit-print-color-adjust: exact;">
    <!-- PAGE 1: Full A4 Canvas Target (Vertically & Horizontally Centered Ticket Card) -->
    <div class="page1-render-target" style="width: 840px; height: 1188px; background-color: #F5EFE6; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative;">
      
      <!-- Horizontal Ticket Card with Wavy Cutout Right Margin -->
      <div class="receipt-card" style="width: 740px; background-color: #FFFFFF; border-radius: 16px 0 0 16px; border-top-left-radius: 16px; border-bottom-left-radius: 16px; position: relative; box-shadow: 0 12px 30px rgba(45, 37, 30, 0.08); border: 1px solid #E5D7C5; border-right: none; overflow: visible;">
        <table class="receipt-layout" style="width: 100%; border-collapse: separate; border-spacing: 0;">
          <tr>
            <!-- LEFT COLUMN: ORGANIZATION DETAILS -->
            <td class="left-stub" style="width: 40%; background-color: #FAF6F0; padding: 24px 22px; border-right: 2px dashed #D8C8B5; border-top-left-radius: 16px; border-bottom-left-radius: 16px; vertical-align: top; position: relative;">
              <div class="intellidon-branding" style="font-size: 16px; font-weight: 800; color: #E05305; letter-spacing: -0.5px; margin-bottom: 18px;">Intelli<span style="color: #2D251E;">don</span></div>
              
              ${logoHtml}
              <div class="org-name" style="font-size: 18px; font-weight: 800; color: #2D251E; line-height: 1.2; margin-bottom: 6px; min-height: 22px;">${mandalName}</div>
              
              <!-- Fixed 3-line static height address container -->
              <div class="org-address" style="font-size: 11px; color: #665B50; line-height: 1.45; margin-bottom: 16px; min-height: 48px;">
                <div>${mandalAddress || '&nbsp;'}</div>
                <div>Contact: ${formattedPhone ? formattedPhone : '--'}</div>
                <div>${legalEmail ? legalEmail : '&nbsp;'}</div>
              </div>

              <!-- Static Tax Badge Box -->
              <div class="tax-badge-box" style="background-color: #FFFFFF; border: 1px solid #EAE0D2; border-radius: 8px; padding: 10px; font-size: 10px; color: #52473C; line-height: 1.6;">
                <strong style="color: #E05305;">PAN:</strong> --<br>
                <strong style="color: #E05305;">GSTIN:</strong> --<br>
                <strong style="color: #E05305;">80G Reg:</strong> --
              </div>
            </td>

            <!-- RIGHT COLUMN: DONOR & RECEIPT DETAILS -->
            <td class="right-stub" style="width: 60%; padding: 24px 28px 24px 22px; background-color: #FFFFFF; vertical-align: top; position: relative;">
              <table class="header-right" style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
                <tr>
                  <td>
                    <div class="event-tag" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #8C7E70; font-weight: 700;">Official Donation Receipt</div>
                    <div style="font-size: 11px; font-weight: 700; color: #52473C; margin-top: 2px;">
                      Receipt No: <span style="color: #2D251E;">${data.receiptNumber}</span>
                    </div>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <div class="receipt-no-badge ${statusBadgeClass}" style="display: inline-block; height: 26px; line-height: 24px; padding: 0 14px; border-radius: 13px; font-size: 11px; font-weight: 700; text-align: center; vertical-align: middle; box-sizing: border-box; ${isVerified ? 'background-color: #EAF5EA; color: #1E6B37; border: 1px solid #C2E2C7;' : 'background-color: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;'}"><span style="display: inline-block; vertical-align: middle; line-height: 1;">${statusBadgeText}</span></div>
                  </td>
                </tr>
              </table>

              <div class="event-name" style="font-size: 14px; font-weight: 800; color: #2D251E; margin-top: 2px; margin-bottom: 14px; min-height: 32px;">
                <span class="event-tag" style="display:block; margin-bottom: 1px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #8C7E70; font-weight: 700;">Event / Cause</span>
                ${data.eventName || '--'}
              </div>

              <!-- Amount Display Banner -->
              <div class="amount-display" style="background-color: #FAF6F0; border-left: 4px solid #E05305; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 18px;">
                <div class="amt-label" style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #7A6F64; font-weight: 700;">Donation Amount Received</div>
                <div class="amt-value" style="font-size: 26px; font-weight: 800; color: #E05305; margin: 2px 0;">₹ ${amountFormatted}</div>
                <div class="amt-words" style="font-size: 11px; color: #52473C; font-style: italic;">${wordsFormatted}</div>
              </div>

              <!-- Static 3-Row Donor & Transaction Grid -->
              <table class="info-table" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                  <td style="width: 50%; vertical-align: top; padding-bottom: 8px; font-size: 11px;">
                    <span class="lbl" style="color: #8C7E70; font-size: 10px; font-weight: 500; display: block;">Donor Name</span>
                    <div class="val" style="color: #2D251E; font-weight: 700; margin-top: 1px;">${data.donorName || '--'}</div>
                  </td>
                  <td style="width: 50%; vertical-align: top; padding-bottom: 8px; font-size: 11px;">
                    <span class="lbl" style="color: #8C7E70; font-size: 10px; font-weight: 500; display: block;">Date & Time</span>
                    <div class="val" style="color: #2D251E; font-weight: 700; margin-top: 1px;">${dateStr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align: top; padding-bottom: 8px; font-size: 11px;">
                    <span class="lbl" style="color: #8C7E70; font-size: 10px; font-weight: 500; display: block;">Donor PAN</span>
                    <div class="val" style="color: #2D251E; font-weight: 700; margin-top: 1px;">--</div>
                  </td>
                  <td style="vertical-align: top; padding-bottom: 8px; font-size: 11px;">
                    <span class="lbl" style="color: #8C7E70; font-size: 10px; font-weight: 500; display: block;">Payment Mode</span>
                    <div class="val" style="color: #2D251E; font-weight: 700; margin-top: 1px;">${paymentModeLabel}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="vertical-align: top; padding-bottom: 8px; font-size: 11px;">
                    <span class="lbl" style="color: #8C7E70; font-size: 10px; font-weight: 500; display: block;">Transaction / Ref ID</span>
                    <div class="val" style="color: #2D251E; font-weight: 700; margin-top: 1px;">--</div>
                  </td>
                </tr>
              </table>

              <!-- Static Signature Block -->
              <table class="footer-sig" style="width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px dashed #EAE0D2; padding-top: 10px;">
                <tr>
                  <td style="font-size: 8px; color: #8C7E70; vertical-align: bottom; max-width: 180px;">
                    * Computer-generated receipt eligible under Sec 80G.
                  </td>
                  <td class="sig-box" style="text-align: right; font-size: 10px; color: #7A6F64;">
                    <div class="sig-line" style="display: inline-block; width: 120px; border-bottom: 1px solid #A89C8E; margin-bottom: 3px;"></div>
                    <div style="font-weight: 700; color: #2D251E;">Authorized Signatory</div>
                    ${collectorName ? `<div style="font-size: 9px; color: #1E6B37; font-weight: 700; margin-top: 1px;">✓ Verified by Collector: ${collectorName}</div>` : ''}
                    <div style="font-size: 9px; color: #8C7E70;">${mandalName}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Wavy Zig-Zag / Cutout Pattern Edge on Right Side -->
        <svg class="wave-edge" viewBox="0 0 12 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; right: -12px; width: 12px; height: 100%; z-index: 10;">
          <path d="M0,0 C6,10 12,20 12,25 C12,30 6,40 0,50 C6,60 12,70 12,75 C12,80 6,90 0,100 C6,110 12,120 12,125 C12,130 6,140 0,150 C6,160 12,170 12,175 C12,180 6,190 0,200 C6,210 12,220 12,225 C12,230 6,240 0,250 C6,260 12,270 12,275 C12,280 6,290 0,300 C6,310 12,320 12,325 C12,330 6,340 0,350 C6,360 12,370 12,375 C12,380 6,390 0,400 C6,410 12,420 12,425 C12,430 6,440 0,450 C6,460 12,470 12,475 C12,480 6,490 0,500 L0,0 Z" fill="#F5EFE6"/>
        </svg>
      </div>

      <!-- Footer Tag -->
      <div class="powered-tag" style="text-align: center; margin-top: 30px; font-size: 11px; color: #8C7E70;">
        Verified Digital Donation Receipt • Powered by <strong style="color: #E05305;">Intellidon</strong>
      </div>
    </div>

    <!-- PAGE 2: FULL PAGE PAYMENT SCREENSHOT PROOF -->
    ${screenshotSrc ? `
    <div class="page2-render-target" style="width: 840px; height: 1188px; padding: 40px; background-color: #F5EFE6; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <div style="width: 760px; height: 1060px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5D7C5; padding: 28px; box-shadow: 0 12px 30px rgba(45, 37, 30, 0.08); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #D8C8B5; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #2D251E;">PAYMENT SCREENSHOT PROOF</div>
            <div style="font-size: 11px; color: #8C7E70; margin-top: 4px;">Receipt No: <strong style="color: #2D251E;">${data.receiptNumber}</strong> &nbsp;•&nbsp; Donor: <strong style="color: #2D251E;">${data.donorName}</strong></div>
          </div>
          <div style="display: inline-block; height: 28px; line-height: 26px; padding: 0 14px; border-radius: 14px; font-size: 11px; font-weight: 700; text-align: center; vertical-align: middle; box-sizing: border-box; ${isVerified ? 'background-color: #EAF5EA; color: #1E6B37; border: 1px solid #C2E2C7;' : 'background-color: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;'}">
            <span style="display: inline-block; vertical-align: middle; line-height: 1;">${isVerified ? '✓ VERIFIED PAYMENT SCREENSHOT' : '⏳ PENDING VERIFICATION BY ORGANISATION'}</span>
          </div>
        </div>

        <!-- Center Image Container -->
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; background-color: #FAF6F0; border: 1px dashed #D8C8B5; border-radius: 12px; padding: 20px; height: 860px; box-sizing: border-box;">
          <img src="${screenshotSrc}" style="max-width: 100%; max-height: 820px; border-radius: 8px; border: 1px solid #E5D7C5; object-fit: contain; box-shadow: 0 4px 15px rgba(0,0,0,0.06);" alt="Payment Proof" />
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 18px; font-size: 11px; color: #8C7E70; border-top: 1px dashed #EAE0D2; padding-top: 14px;">
          Page 2 of 2 — Payment Screenshot Proof attached during self-donation to <strong>${mandalName}</strong>
        </div>
      </div>
    </div>
    ` : ''}
  </div>
  `
}

export async function generateReceiptPDF(receiptData) {
  if (typeof window === 'undefined') {
    throw new Error('PDF generation relies on browser DOM rendering')
  }

  const wrapper = document.createElement('div')
  wrapper.style.position = 'absolute'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '-9999px'
  wrapper.style.width = '840px'
  wrapper.innerHTML = buildHtmlContent(receiptData)
  document.body.appendChild(wrapper)

  try {
    const page1El = wrapper.querySelector('.page1-render-target') || wrapper
    const canvas1 = await html2canvas(page1El, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#F5EFE6'
    })

    const imgData1 = canvas1.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const imgProps1 = pdf.getImageProperties(imgData1)
    const pdfHeight1 = (imgProps1.height * pdfWidth) / imgProps1.width

    pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, pdfHeight1)

    // Check if Page 2 (Screenshot Proof) exists
    const page2El = wrapper.querySelector('.page2-render-target')
    if (page2El) {
      const canvas2 = await html2canvas(page2El, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F5EFE6'
      })
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.95)
      const imgProps2 = pdf.getImageProperties(imgData2)
      const pdfHeight2 = (imgProps2.height * pdfWidth) / imgProps2.width

      pdf.addPage()
      pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, pdfHeight2)
    }

    const pdfArrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(pdfArrayBuffer)
  } finally {
    wrapper.remove()
  }
}