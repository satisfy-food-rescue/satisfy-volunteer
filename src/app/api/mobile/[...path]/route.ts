import { failure } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

// Unknown API paths answer in JSON like every other endpoint, not with the
// web app's HTML 404 page.
async function notFound() {
  return failure(404, "Not found.");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
