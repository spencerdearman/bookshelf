import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// POST: create a share link
export async function POST(request: NextRequest) {
  try {
    const { flight_id, user_id } = await request.json();
    if (!flight_id || !user_id) {
      return Response.json({ error: "flight_id and user_id required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("share_links")
      .insert({ flight_id, user_id })
      .select("id")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: data.id });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET: resolve a share link
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const { data: link, error: linkErr } = await supabase
    .from("share_links")
    .select("flight_id, expires_at")
    .eq("id", id)
    .single();

  if (linkErr || !link) {
    return Response.json({ error: "Share link not found" }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return Response.json({ error: "Share link expired" }, { status: 410 });
  }

  const { data: flight, error: flightErr } = await supabase
    .from("flights")
    .select("*")
    .eq("id", link.flight_id)
    .single();

  if (flightErr || !flight) {
    return Response.json({ error: "Flight not found" }, { status: 404 });
  }

  return Response.json({ flight });
}
