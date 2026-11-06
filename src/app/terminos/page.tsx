import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos" };

export default function TermsPage() {
  return (
    <article className="card gap-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Términos de uso</h1>
      <p>
        Pockets es una herramienta personal para organizar tus gastos. Los cálculos, como el
        rendimiento de la cajita, son estimaciones: los montos oficiales siempre son los de
        tu banco.
      </p>
      <p>
        La app no mueve dinero ni se conecta a tus bancos. Solo registra lo que tú escribes
        y lo guarda en el Google Sheets de cada persona.
      </p>
      <p>Solo pueden entrar las personas a las que la dueña de la app les dio usuario y contraseña.</p>
    </article>
  );
}
