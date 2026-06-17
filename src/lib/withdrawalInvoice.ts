import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type WithdrawalInvoiceData = {
  requestId: string;
  driverName: string;
  amount: number;
  shopName?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  statusLabel: string;
  deliveryCount?: number | null;
  createdAt: string;
  reviewedAt?: string | null;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("mn-MN");
  } catch {
    return iso;
  }
};

const fmtMNT = (n: number) => `₮${Number(n || 0).toLocaleString()}`;

const escapeHtml = (s?: string | null) =>
  (s ?? "—")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function buildInvoiceHtml(d: WithdrawalInvoiceData): HTMLElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-10000px";
  el.style.top = "0";
  el.style.width = "720px";
  el.style.background = "#ffffff";
  el.style.color = "#0f172a";
  el.style.fontFamily =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  const shortId = d.requestId.slice(0, 8).toUpperCase();

  el.innerHTML = `
    <div style="padding:40px 44px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;">
        <div>
          <div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">ON Shop</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">Хүргэлтийн төлбөрийн нэхэмжлэл</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;color:#64748b;">Нэхэмжлэл №</div>
          <div style="font-size:18px;font-weight:700;color:#0f172a;">INV-${shortId}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">${fmtDate(d.createdAt)}</div>
        </div>
      </div>

      <div style="display:flex;gap:40px;margin-top:28px;">
        <div style="flex:1;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:8px;">Жолооч</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(d.driverName)}</div>
          ${d.shopName ? `<div style="font-size:13px;color:#475569;margin-top:6px;">Дэлгүүр: <b>${escapeHtml(d.shopName)}</b></div>` : ""}
          ${d.deliveryCount ? `<div style="font-size:13px;color:#475569;margin-top:2px;">Хүргэлтийн тоо: <b>${d.deliveryCount}</b></div>` : ""}
        </div>
        <div style="flex:1;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:8px;">Хүлээн авах данс</div>
          <div style="font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(d.bankName)}</div>
          <div style="font-size:15px;color:#0f172a;margin-top:2px;">${escapeHtml(d.bankAccount)}</div>
          ${d.accountHolder ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(d.accountHolder)}</div>` : ""}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:28px;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:12px 14px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;">Гүйлгээний утга</th>
            <th style="text-align:right;padding:12px 14px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;">Дүн</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px;color:#0f172a;border-bottom:1px solid #f1f5f9;">
              Хүргэлтийн төлбөр татах хүсэлт${d.shopName ? ` — ${escapeHtml(d.shopName)}` : ""}
            </td>
            <td style="padding:14px;text-align:right;color:#0f172a;border-bottom:1px solid #f1f5f9;">${fmtMNT(d.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:18px;">
        <div style="width:280px;">
          <div style="display:flex;justify-content:space-between;padding:14px 16px;background:#0f172a;border-radius:10px;">
            <span style="color:#cbd5e1;font-size:14px;font-weight:600;">Нийт дүн</span>
            <span style="color:#ffffff;font-size:18px;font-weight:800;">${fmtMNT(d.amount)}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:28px;display:flex;gap:40px;font-size:13px;color:#475569;">
        <div><span style="color:#94a3b8;">Төлөв:</span> <b>${escapeHtml(d.statusLabel)}</b></div>
        <div><span style="color:#94a3b8;">Шийдвэрлэсэн:</span> ${fmtDate(d.reviewedAt)}</div>
      </div>

      <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;text-align:center;font-size:12px;color:#94a3b8;">
        Энэхүү нэхэмжлэл нь ON Shop хүргэлтийн системээс автоматаар үүсгэгдсэн.
      </div>
    </div>
  `;
  return el;
}

export async function downloadWithdrawalInvoicePdf(d: WithdrawalInvoiceData) {
  const node = buildInvoiceHtml(d);
  document.body.appendChild(node);
  try {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`INV-${d.requestId.slice(0, 8).toUpperCase()}.pdf`);
  } finally {
    document.body.removeChild(node);
  }
}
