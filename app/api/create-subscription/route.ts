import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { productId, userId } = await request.json();

    const apiKey = process.env.LAVA_API_KEY;
    if (!apiKey) {
      console.error("❌ LAVA_API_KEY не задан");
      return NextResponse.json(
        { success: false, error: "Серверная ошибка: отсутствует ключ API" },
        { status: 500 }
      );
    }

    const isPro = productId === process.env.NEXT_PUBLIC_LAVA_PRO_PRODUCT_ID;
    const amount = isPro ? 490 : 1990;
    const name = isPro ? "MarketCard AI Pro" : "MarketCard AI Business";

    const payload = {
      offerId: productId,
      email: "client@example.com",
      currency: "RUB",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?success=true`,
      fail_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?fail=true`,
      hook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/lava-webhook`,
      custom_fields: {
        user_id: userId,
        product_name: name,
      },
    };

    console.log("📤 Отправка запроса в Lava.top:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://gate.lava.top/api/v3/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("📦 Ответ Lava.top (статус:", response.status, "):", responseText);

    if (!response.ok) {
      let errorMessage = `Ошибка ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        if (responseText) errorMessage = responseText;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error("Невалидный ответ от Lava.top: " + responseText.substring(0, 200));
    }

    // В ответе приходит paymentUrl, а не url
    const paymentUrl = data.paymentUrl || data.data?.url || data.url;
    if (!paymentUrl) {
      console.error("❌ Не найден paymentUrl в ответе:", JSON.stringify(data, null, 2));
      throw new Error("Ответ Lava.top не содержит URL для оплаты");
    }

    return NextResponse.json({
      success: true,
      payment_url: paymentUrl,
      invoice_id: data.id || data.data?.id,
    });
  } catch (error) {
    console.error("❌ Ошибка создания подписки:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Ошибка создания счёта" },
      { status: 500 }
    );
  }
}
