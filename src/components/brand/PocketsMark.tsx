/**
 * The Pockets icon: a white pocket on the same blue-to-violet gradient as the Home card.
 * Used to render the PNG icons, so it only uses styles the icon renderer supports.
 */
export function PocketsMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1f4fa8 0%, #6247c9 100%)",
      }}
    >
      <div
        style={{
          width: size * 0.56,
          height: size * 0.5,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderTopLeftRadius: size * 0.06,
          borderTopRightRadius: size * 0.06,
          borderBottomLeftRadius: size * 0.28,
          borderBottomRightRadius: size * 0.28,
        }}
      >
        <div
          style={{
            marginTop: size * 0.1,
            marginLeft: size * 0.08,
            marginRight: size * 0.08,
            height: size * 0.035,
            borderRadius: size * 0.02,
            background: "#6247c9",
          }}
        />
      </div>
    </div>
  );
}
