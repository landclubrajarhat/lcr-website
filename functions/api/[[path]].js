import { handleRequest } from '../../server/portal.mjs';

export const onRequest = ({ request, env }) => handleRequest(request, env);
