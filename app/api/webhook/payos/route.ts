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
    const payosCode = webhookData.code; // '00' = success, others = cancelled/failed

    // Kiểm tra trạng thái từ PayOS: code '00' = thành công, còn lại = hủy/thất bại
    const isPaid = payosCode === "00";

    if (isPaid) {
      // Cập nhật trạng thái thành Paid
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

      // Ghi nhận thông tin đơn hàng đã hoàn tất vào bảng completed_orders
      if (data && data.length > 0) {
        const order = data[0];
        const { error: insertError } = await supabase
          .from("completed_orders")
          .insert({
            order_id: order.id,
            customer_name: order.customer_name,
            phone: order.phone,
            address: order.address,
            total_price: order.total_price,
            payment_method: order.payment_method,
            status: "Paid",
          });

        if (insertError) {
          console.error("Lỗi khi sao chép đơn hàng sang bảng completed_orders:", insertError);
        } else {
          console.log(`Đã lưu đơn hàng thành công #${orderId} vào bảng completed_orders.`);
        }
      }

      console.log(`Cập nhật đơn hàng ${orderId} thành công thành 'Paid'.`);
    } else {
      // PayOS gửi webhook hủy (code != '00') → cập nhật trạng thái thành Cancelled
      const { error } = await supabase
        .from("orders")
        .update({ status: "Cancelled" })
        .eq("id", orderId);

      if (error) {
        console.error("Lỗi khi cập nhật trạng thái hủy đơn:", error);
      } else {
        console.log(`Đơn hàng #${orderId} đã được cập nhật thành 'Cancelled' qua webhook.`);
      }
    }

    return NextResponse.json({ success: true, message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("Lỗi xử lý webhook PayOS:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý webhook." },
      { status: 400 } // Send 400 for verification/signature failures
    );
  }
}
