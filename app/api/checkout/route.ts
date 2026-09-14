import { NextRequest, NextResponse } from "next/server";
import { PayOS } from "@payos/node";

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID || "",
  apiKey: process.env.PAYOS_API_KEY || "",
  checksumKey: process.env.PAYOS_CHECKSUM_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const { orderId, totalPrice, productName, origin } = await req.json();

    if (!orderId || !totalPrice || !origin) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc (orderId, totalPrice, origin)." },
        { status: 400 }
      );
    }

    const orderCode = Number(orderId);
    if (isNaN(orderCode)) {
      return NextResponse.json(
        { error: "orderId phải là kiểu số nguyên." },
        { status: 400 }
      );
    }

    // Tạo PayOS orderCode độc nhất từ timestamp + random để tránh trùng lặp
    // khi Supabase bị reset auto-increment sau khi pause/restore
    const randomSuffix = Math.floor(Math.random() * 1000);
    const payosOrderCode = Number(
      `${Math.floor(Date.now() / 1000)}${String(randomSuffix).padStart(3, "0")}`
        .slice(-9) // Giữ trong phạm vi số nguyên an toàn
    );

    // Clean description: chỉ giữ ký tự alphanumeric và space, tối đa 25 ký tự
    const cleanDesc = `Thanh toan don ${orderCode}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .slice(0, 25);

    const expiredAt = Math.floor(Date.now() / 1000) + 300; // 5 phút

    const paymentData = {
      orderCode: payosOrderCode,
      amount: totalPrice,
      description: cleanDesc,
      // Truyền orderId (DB id) qua URL để webhook/return có thể cập nhật đúng record
      cancelUrl: `${origin}/?status=cancelled&orderId=${orderCode}`,
      returnUrl: `${origin}/?status=success&orderId=${orderCode}`,
      expiredAt: expiredAt,
      items: [
        {
          name: productName.slice(0, 25),
          quantity: 1,
          price: totalPrice,
        },
      ],
    };

    const paymentLink = await payOS.paymentRequests.create(paymentData);

    return NextResponse.json({
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      payosOrderCode: payosOrderCode,
    });
  } catch (error: any) {
    console.error("Lỗi khi tạo link thanh toán PayOS:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tạo link thanh toán." },
      { status: 500 }
    );
  }
}
