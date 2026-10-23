import { getProvider } from "../../../lib/ai/provider";

const MAX_BYTES = 2 * 1024 * 1024; // photos are compressed on the device first, so this is generous

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/"))
    return Response.json({ error: "Send an image in the 'photo' field" }, { status: 400 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });

  // The photo is read once and not stored.
  const text = await getProvider().transcribePhoto(new Uint8Array(await photo.arrayBuffer()), photo.type);
  return Response.json({ text });
}
