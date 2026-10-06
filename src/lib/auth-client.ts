import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: { role: { type: "string", required: false, input: false } },
    }),
  ],
});

/** Mensaje en español para los errores de Better Auth. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null): string {
  if (!error) return "";
  if (error.status === 503) return "Las cuentas no están disponibles en este servidor. Puedes seguir jugando sin cuenta.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email o contraseña incorrectos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya hay una cuenta con ese email. Entra con tu contraseña.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "INVALID_EMAIL":
      return "Ese email no parece válido.";
    default:
      return error.message || "No se pudo completar. Inténtalo de nuevo.";
  }
}
