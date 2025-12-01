"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Chatbot AI</h1>
          <p className="text-gray-400">เข้าสู่ระบบเพื่อใช้งาน</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6">
            <p className="text-sm">
              {error === "OAuthCallback"
                ? "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง"
                : error === "AccessDenied"
                ? "การเข้าถึงถูกปฏิเสธ"
                : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"}
            </p>
          </div>
        )}

        <button
          onClick={() => signIn("identityserver", { callbackUrl: "/" })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
          เข้าสู่ระบบ
        </button>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            ยังไม่มีบัญชี? สมัครสมาชิกได้ที่หน้า Login
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-xl">กำลังโหลด...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
