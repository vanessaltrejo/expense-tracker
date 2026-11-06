import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacyPage() {
  return (
    <article className="card gap-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Aviso de privacidad</h1>
      <p>
        Pockets es una app personal y familiar. No tiene anuncios, no vende datos y no los
        comparte con nadie fuera de las personas que la usan.
      </p>
      <h2 className="text-base font-semibold">Quién entra y cómo</h2>
      <p>
        Cada persona entra con su usuario y su contraseña. La contraseña nunca se guarda: solo
        una versión cifrada que no se puede revertir. La sesión se guarda cifrada en una
        cookie de tu navegador.
      </p>
      <h2 className="text-base font-semibold">Dónde se guardan tus datos</h2>
      <p>
        Los movimientos de cada persona viven en su propio Google Sheets, guardado en la
        cuenta de Google de la dueña de la app, y en una copia dentro de tu dispositivo para
        que funcione sin internet. La dueña de la app puede ver esos Sheets. La app se conecta
        a ellos con una cuenta de servicio de Google que solo ve los Sheets compartidos con
        ella.
      </p>
      <h2 className="text-base font-semibold">Cuentas de solo lectura</h2>
      <p>
        Una cuenta de solo lectura ve la información, pero no puede cambiarla, abrir el Sheets
        ni descargar respaldos.
      </p>
      <h2 className="text-base font-semibold">Cómo salir</h2>
      <p>Puedes cerrar sesión desde Perfil.</p>
    </article>
  );
}
