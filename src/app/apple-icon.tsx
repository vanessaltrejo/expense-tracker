import { ImageResponse } from "next/og";

import { PocketsMark } from "@/components/brand/PocketsMark";

// The iPhone uses this one for the home screen. It rounds the corners by itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PocketsMark size={size.width} />, size);
}
