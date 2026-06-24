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

    // Clean description to only contain alphanumeric characters and spaces, max 25 chars.
    const cleanDesc = `Thanh toan don ${orderCode}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .slice(0, 25);

    const expiredAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes = 300 seconds

    const paymentData = {
      orderCode: orderCode,
      amount: totalPrice,
      description: cleanDesc,
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

    return NextResponse.json({ checkoutUrl: paymentLink.checkoutUrl });
  } catch (error: any) {
    console.error("Lỗi khi tạo link thanh toán PayOS:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tạo link thanh toán." },
      { status: 500 }
    );
  }
}
