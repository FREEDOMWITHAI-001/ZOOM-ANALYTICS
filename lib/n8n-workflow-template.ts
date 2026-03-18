import baseWorkflow from './n8n-base-workflow.json';

export interface WorkflowConfig {
  clientName: string;
  dbClientName: string;
  zoomAccountId: string;
  zoomClientId: string;
  zoomClientSecret: string;
  zoomWebhookSecret: string;
  ghlToken: string;
  ghlLocationId: string;
  aiProvider: string;
  aiApiKey: string;
}

/**
 * Deep-clones a value (plain objects/arrays/primitives only).
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Generates a UUID v4 using the built-in crypto module (Node 14.17+ / edge runtime).
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Builds the Zoom Basic Auth header value:
 * "Bearer " + base64("clientId:clientSecret")
 */
function buildZoomBearer(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Bearer ${encoded}`;
}

/**
 * Generates a ready-to-import n8n workflow JSON pre-filled with
 * the given client's credentials.
 */
export function generateWorkflowJSON(config: WorkflowConfig, overrideBase?: object): object {
  const workflow = deepClone(overrideBase ?? baseWorkflow) as any;

  const webhookId = generateUUID();

  // a) Workflow name
  workflow.name = `Zoom Analytics - ${config.clientName}`;

  const nodes: any[] = workflow.nodes ?? [];

  for (const node of nodes) {
    const name: string = node.name ?? '';
    const type: string = node.type ?? '';

    // b) "server oauth" — Set node with credential assignments
    if (name === 'server oauth' && type === 'n8n-nodes-base.set') {
      const assignments: any[] =
        node.parameters?.assignments?.assignments ?? [];

      for (const assignment of assignments) {
        switch (assignment.name) {
          case 'zoom_bearer':
            assignment.value = buildZoomBearer(
              config.zoomClientId,
              config.zoomClientSecret
            );
            break;
          case 'ghl_token':
            assignment.value = `Bearer ${config.ghlToken}`;
            break;
          case 'ghl_location':
            assignment.value = config.ghlLocationId;
            break;
          case 'account_id':
            assignment.value = config.zoomAccountId;
            break;
          case 'db_name':
            assignment.value = config.dbClientName;
            break;
          case 'ai_provider':
            assignment.value = config.aiProvider;
            break;
          case 'ai_api_key':
            assignment.value = config.aiApiKey;
            break;
        }
      }
    }

    // c) "Get zoom auth token6" — HTTP Request with account_id query param
    if (
      name === 'Get zoom auth token6' &&
      type === 'n8n-nodes-base.httpRequest'
    ) {
      const queryParams: any[] =
        node.parameters?.queryParameters?.parameters ?? [];

      for (const param of queryParams) {
        if (param.name === 'account_id') {
          param.value = config.zoomAccountId;
        }
      }
    }

    // d) "Crypto" — HMAC secret for Zoom webhook URL validation
    if (name === 'Crypto' && type === 'n8n-nodes-base.crypto') {
      if (!node.parameters) node.parameters = {};
      node.parameters.secret = config.zoomWebhookSecret;
    }

    // e) "Webhook Trigger1" — assign new UUID as webhookId
    if (
      name === 'Webhook Trigger1' &&
      type === 'n8n-nodes-base.webhook'
    ) {
      node.webhookId = webhookId;
    }
  }

  return workflow;
}
