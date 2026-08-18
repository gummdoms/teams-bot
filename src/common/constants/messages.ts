/**
 * User-facing messages (Spanish) and internal log templates.
 * User-facing text must stay in Spanish; internal identifiers remain in English.
 */
export const messages = {
  proactive: {
    optedOut: 'El usuario se dio de baja de las notificaciones proactivas.',
    userNotFound: 'No se encontró un usuario en Microsoft Entra ID con ese correo.',
    notInstalled:
      'El bot no está instalado para este usuario en el ámbito personal. Instala la aplicación o usa la opción installIfMissing.',
    blocked: 'El usuario bloqueó, silenció o desinstaló el bot; el mensaje no fue entregado.',
    error: 'Ocurrió un error inesperado al intentar enviar el mensaje proactivo.',
  },
  bot: {
    welcome: (name?: string) =>
      `¡Hola${name ? ` ${name}` : ''}! 👋\n\nSoy el bot de notificaciones proactivas de **Oberon 360**. Recibirás mensajes importantes directamente en este chat.\n\nEscribe **ayuda** para ver los comandos disponibles. Si ya no deseas recibir notificaciones, escribe **optout** en cualquier momento.`,
    greeting:
      '¡Hola! 👋 ¿En qué puedo ayudarte? Escribe **ayuda** para ver los comandos disponibles.',
    help: '**Comandos disponibles**\n\n• **ayuda** — Muestra esta ayuda.\n• **optout** — Deja de recibir notificaciones proactivas.\n• **optin** — Vuelve a recibir notificaciones proactivas.',
    optOutConfirmed:
      'Listo, te has dado de baja de las notificaciones proactivas. ✅\n\nPara volver a recibirlas escribe **optin**.',
    optInConfirmed: '¡Listo! Volverás a recibir notificaciones proactivas. ✅',
  },
} as const;
