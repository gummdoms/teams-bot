# Mensajes proactivos en Microsoft Teams — Guía técnica

Esta guía resume cómo implementa este bot los **mensajes proactivos** según la documentación oficial de Microsoft:

- [Send proactive messages (Microsoft Learn)](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)
- [Proactive messages (msteams-docs)](https://github.com/MicrosoftDocs/msteams-docs/blob/main/msteams-platform/bots/how-to/conversations/send-proactive-messages.md)

## Qué es un mensaje proactivo

Un mensaje proactivo es cualquier mensaje que el bot envía **sin que el usuario haya interactuado** con él: notificaciones, avisos programados, mensajes de bienvenida, alertas.

## Reglas de oro

1. **El correo o el UPN no se pueden usar directamente para enviar.** Teams no soporta mensajes proactivos direccionados por email. Siempre hay que resolver el usuario a su **Microsoft Entra ID (AAD Object ID)** vía Microsoft Graph.
2. **La app debe estar instalada para el usuario.** Para enviar a un chat personal, la app del bot debe estar instalada en el ámbito personal del usuario. Si no lo está, la API del Bot Framework responde `403 ForbiddenOperationException`.
3. **La conversación se crea una vez y se reutiliza.** Después de crear la conversación, guarda el `conversationId` (junto con `serviceUrl` y `tenantId`) y úsalo en los envíos siguientes.
4. **`aadObjectId` solo funciona en ámbito personal** (chat 1:1).

## Flujo completo implementado

### 1. Resolver el usuario

```
GET https://graph.microsoft.com/v1.0/users?$filter=userPrincipalName eq 'user@corp.com' or mail eq 'user@corp.com'
```

Se obtiene el `id` (AAD Object ID) del usuario. Implementación: `GraphService.getUserByEmail()`.

### 2. Crear la conversación (solo la primera vez)

```
POST {serviceUrl}/v3/conversations
{
  "bot": { "id": "28:<MICROSOFT_APP_ID>", "name": "Oberon360 Bot" },
  "members": [{ "id": "<aadObjectId>" }],
  "channelData": { "tenant": { "id": "<tenantId>" } },
  "isGroup": false
}
```

Respuesta: `{ "id": "a:1qhNLqp..." }` → `conversationId`.

> Nota de Microsoft: "To create the conversation, pass the `aadObjectId` value in the `Id` parameter".

Implementación: `TeamsBotAdapter.createConversation()` (usa `BotFrameworkAdapter.createConversationAsync`).

### 3. Guardar la referencia de conversación

Se persiste en PostgreSQL (tabla `conversation_references`):

| Campo | Valor |
| --- | --- |
| `aad_object_id` | ID del usuario en Entra ID |
| `conversation_id` | ID de la conversación creada |
| `service_url` | `https://smba.trafficmanager.net/teams/` (público) o el de la actividad |
| `tenant_id` | Tenant del usuario |
| `email` | Correo del usuario (para resolver por correo) |
| `opt_out` | Si el usuario se dio de baja |

También se guarda automáticamente cuando el bot recibe el evento de **instalación** (`installationUpdate` / `conversationUpdate` con `membersAdded`), que incluye una referencia completa con `serviceUrl` correcto para ese usuario.

### 4. Enviar el mensaje

```
POST {serviceUrl}/v3/conversations/{conversationId}/activities
```

Con el token del bot (OAuth `https://api.botframework.com`). Implementación: `TeamsBotAdapter.sendProactiveMessage()` (usa `BotFrameworkAdapter.continueConversation`).

### 5. Manejo de errores

| Respuesta | Condición | Estado del bot |
| --- | --- | --- |
| `403 ForbiddenOperationException` | La app no está instalada para el usuario | `NOT_INSTALLED` |
| `403 MessageWritesBlocked` | El usuario bloqueó, silenció o desinstaló el bot | `BLOCKED` |
| `404 NotFound` | El usuario no existe en el tenant | `USER_NOT_FOUND` |

### 6. Instalación proactiva (opcional)

Si el bot no está instalado, se puede instalar vía Graph y reintentar:

```
GET  /appCatalogs/teamsApps?$filter=externalId eq '<manifestAppId>'   → catalogId
POST /users/{userId}/teamwork/installedApps
     { "teamsApp@odata.bind": "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/<catalogId>" }
```

Requisito de permiso: `TeamsAppInstallation.ReadWriteSelfForUser.All`.

## Service URLs globales (respaldos)

Si no tienes `serviceUrl` de una actividad entrante, usa según la nube:

| Nube | URL |
| --- | --- |
| Pública | `https://smba.trafficmanager.net/teams/` |
| GCC | `https://smba.infra.gcc.teams.microsoft.com/teams` |
| GCC High | `https://smba.infra.gov.teams.microsoft.us/teams` |
| DoD | `https://smba.infra.dod.teams.microsoft.us/teams` |

## Mejores prácticas aplicadas

- **Bienvenida clara**: el mensaje inicial explica el motivo y los comandos disponibles.
- **Opt-out**: los usuarios pueden escribir `optout`; el bot respeta el estado antes de enviar.
- **Notificaciones accionables**: el emisor de la API controla el contenido; se recomienda indicar qué pasó y qué puede hacer el usuario.
- **No hardcodear serviceUrl**: se toma de la actividad entrante y se persiste; la URL global es solo respaldo.
