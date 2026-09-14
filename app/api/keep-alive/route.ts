import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Dùng service role để bypass RLS (chỉ dùng nội bộ, không expose ra client)
// Nếu không có service role key, fallback sang anon key - vẫn đủ để ping
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const startedAt = new Date().toISOString();

  try {
    // Ping nhẹ: chỉ đọc 1 row từ products để giữ DB luôn active
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    if (error) {
      console.error("[keep-alive] Supabase ping failed:", error.message);
      return NextResponse.json(
        {
          ok: false,
          timestamp: startedAt,
          error: error.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `[keep-alive] Supabase pinged successfully at ${startedAt}. Found ${data?.length ?? 0} product(s).`
    );

    return NextResponse.json({
      ok: true,
      timestamp: startedAt,
      message: "Supabase is alive and healthy ✅",
      rowsFound: data?.length ?? 0,
    });
  } catch (err: any) {
    console.error("[keep-alive] Unexpected error:", err.message);
    return NextResponse.json(
      {
        ok: false,
        timestamp: startedAt,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
