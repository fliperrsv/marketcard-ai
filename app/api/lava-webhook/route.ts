import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📦 Получен вебхук:", body);

    const secretKey = process.env.LAVA_API_KEY;
    const { invoice_id, amount, pay_time, sign, type, status, consumer_id, product_id, order_id } = body;

    if (sign) {
      const expectedSign = crypto
        .createHash("md5")
        .update(`${invoice_id}:${amount}:${pay_time}:${secretKey}`)
        .digest("hex");

      if (expectedSign !== sign) {
        console.warn("⚠️ Неверная сигнатура вебхука");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    if (type === 4) {
      // Рекуррентный платёж (подписка)
      console.log(`🔄 Подписка ${order_id} для пользователя ${consumer_id}: ${status}`);
      if (status === "activated") {
        console.log(`✅ Подписка активирована для user: ${consumer_id}`);
      } else if (status === "deactivated") {
        console.log(`❌ Подписка деактивирована для user: ${consumer_id}`);
      }
    } else {
      const { status, invoice_id, order_id } = body;
      console.log(`💳 Счёт ${invoice_id} (${order_id}): ${status}`);
      if (status === "success") {
        console.log(`✅ Платёж успешен: ${invoice_id}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Ошибка вебхука:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
