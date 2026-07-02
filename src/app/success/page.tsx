"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const plan = searchParams.get("plan");
    if (plan === "pro") {
      localStorage.setItem("marketcard_generations", "50");
    } else if (plan === "business") {
      localStorage.setItem("marketcard_generations", "999");
    } else {
      localStorage.setItem("marketcard_generations", "3");
    }
    setTimeout(() => {
      router.push("/");
    }, 2000);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2">Оплата прошла успешно!</h1>
        <p className="text-gray-400">Сейчас вы будете перенаправлены обратно в приложение.</p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Загрузка...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
