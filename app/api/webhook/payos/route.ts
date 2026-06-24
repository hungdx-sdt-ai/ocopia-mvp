import { NextRequest, NextResponse } from "next/server";
import { PayOS } from "@payos/node";
import { supabase } from "@/lib/supabase";

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID || "",
  apiKey: process.env.PAYOS_API_KEY || "",
  checksumKey: process.env.PAYOS_CHECKSUM_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is a test or ping request from PayOS to verify Webhook URL active state
    if (!body || !body.data || !body.signature) {
      return NextResponse.json({ success: true, message: "Webhook test endpoint checked" });
    }

    // Verify webhook signature using PayOS SDK
    const webhookData = await payOS.webhooks.verify(body);

    if (!webhookData || !webhookData.orderCode) {
      return NextResponse.json(
        { error: "Dữ liệu webhook không hợp lệ hoặc thiếu orderCode." },
        { status: 400 }
      );
    }

    const orderId = webhookData.orderCode;

    // Update order status to "Paid" in Supabase
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "Paid" })
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("Lỗi khi cập nhật trạng thái đơn hàng trong DB:", error);
      return NextResponse.json(
        { error: "Không thể cập nhật trạng thái đơn hàng." },
        { status: 500 }
      );
    }

    console.log(`Cập nhật đơn hàng ${orderId} thành công thành 'Paid'.`, data);

    return NextResponse.json({ success: true, message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("Lỗi xử lý webhook PayOS:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý webhook." },
      { status: 400 } // Send 400 for verification/signature failures
    );
  }
}
