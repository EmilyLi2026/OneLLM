import { Context } from 'hono';
import { CONTENT_TYPES } from '../globals';
import {
  constructConfigFromRequestHeaders,
  tryTargetsRecursively,
  injectOnellmProvider,
} from './handlerUtils';
import { RouterError } from '../errors/RouterError';

async function getRequestData(request: Request, contentType: string) {
  let finalRequest: any;
  if (contentType == CONTENT_TYPES.APPLICATION_JSON) {
    if (['GET', 'DELETE'].includes(request.method)) {
      finalRequest = {};
    } else {
      finalRequest = await request.json();
    }
  } else if (contentType == CONTENT_TYPES.MULTIPART_FORM_DATA) {
    finalRequest = await request.formData();
  } else if (contentType?.startsWith(CONTENT_TYPES.GENERIC_AUDIO_PATTERN)) {
    finalRequest = await request.arrayBuffer();
  }

  return finalRequest;
}

// Paths that have dedicated handlers (not to be re-processed by proxy)
const SPECIFIC_ROUTES = [
  '/v1/chat/completions', '/v1/completions', '/v1/embeddings',
  '/v1/images/generations', '/v1/images/edits',
  '/v1/audio/speech', '/v1/audio/transcriptions', '/v1/audio/translations',
  '/v1/messages', '/v1/models', '/v1/files', '/v1/batches',
  '/v1/responses', '/v1/fine_tuning', '/v1/prompts',
];

export async function proxyHandler(c: Context): Promise<Response> {
  // Skip if a dedicated handler already processed this request
  const reqPath = c.req.path;
  if (SPECIFIC_ROUTES.some(r => reqPath === r || reqPath.startsWith(r + '/'))) {
    return c.res;
  }

  try {
    let requestHeaders = Object.fromEntries(c.req.raw.headers);
    injectOnellmProvider(c, requestHeaders);
    const requestContentType = requestHeaders['content-type']?.split(';')[0];

    const request = await getRequestData(c.req.raw, requestContentType);

    const camelCaseConfig = constructConfigFromRequestHeaders(requestHeaders);

    const tryTargetsResponse = await tryTargetsRecursively(
      c,
      camelCaseConfig,
      request,
      requestHeaders,
      'proxy',
      c.req.method,
      'config'
    );

    return tryTargetsResponse;
  } catch (err: any) {
    console.error('proxyHandler error: ', err);
    let statusCode = 500;
    let errorMessage = `Proxy error: ${err.message}`;

    if (err instanceof RouterError) {
      statusCode = 400;
      errorMessage = err.message;
    }

    return new Response(
      JSON.stringify({
        status: 'failure',
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}
