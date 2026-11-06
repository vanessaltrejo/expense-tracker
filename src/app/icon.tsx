import { ImageResponse } from "next/og";

import { PocketsMark } from "@/components/brand/PocketsMark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<PocketsMark size={size.width} />, size);
}
