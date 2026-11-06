import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacyPage() {
  return (
    <article className="card gap-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Aviso de privacidad</h1>
      <p>
        Pockets es una app personal para llevar las cuentas de una sola persona. No tiene
        anuncios, no vende datos y no los comparte con nadie.
      </p>
      <h2 className="text-base font-semibold">Qué datos usa</h2>
      <p>
        Al entrar con Google, la app recibe tu nombre y tu correo para saber que eres tú,
        y un permiso para leer y escribir el Google Sheets &ldquo;Mis gastos&rdquo;. Solo
        usa ese archivo.
      </p>
      <h2 className="text-base font-semibold">Dónde se guardan</h2>
      <p>
        Tus movimientos se guardan en tu propio Google Sheets y en una copia dentro de tu
        dispositivo, para que la app funcione sin internet. El permiso de Google se guarda
        cifrado en una cookie de tu navegador.
      </p>
      <h2 className="text-base font-semibold">Cómo quitar el acceso</h2>
      <p>
        Puedes cerrar sesión desde Resumen, o quitarle el permiso a la app en
        myaccount.google.com, en la sección de seguridad y apps con acceso a tu cuenta.
      </p>
    </article>
  );
}
