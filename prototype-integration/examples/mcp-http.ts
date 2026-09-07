import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { makeServer } from "./mcp-server.ts";
const handler = createMcpHandler(makeServer);
export default {
  fetch(request: Request) {
    return hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
      originValidationResponse(request, localhostAllowedOrigins()) ??
      handler.fetch(request);
  },
};
