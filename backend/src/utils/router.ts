export type RouteHandler = (
  req: Request,
  params: Record<string, string>
) => Promise<Response> | Response;

export type Middleware = (
  req: Request,
  next: () => Promise<Response>
) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  private addRoute(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    // Split path into segments, escape literal parts, then reassemble with capture groups
    const segments = path.split(/(:[^/]+)/);
    const patternStr = segments
      .map((seg) => {
        if (seg.startsWith(":")) {
          paramNames.push(seg.slice(1));
          return "([^/]+)";
        }
        // Escape regex metacharacters in literal path segments to prevent ReDoS
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    const pattern = new RegExp(`^${patternStr}$`);
    this.routes.push({ method, pattern, paramNames, handler });
  }

  get(path: string, handler: RouteHandler) {
    this.addRoute("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.addRoute("POST", path, handler);
  }

  patch(path: string, handler: RouteHandler) {
    this.addRoute("PATCH", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.addRoute("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.addRoute("DELETE", path, handler);
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        let index = 0;
        const next = async (): Promise<Response> => {
          if (index < this.middlewares.length) {
            const middleware = this.middlewares[index++];
            return middleware(req, next);
          }
          return route.handler(req, params);
        };

        return next();
      }
    }
    return null;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Standard error codes for API responses
 */
export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: string;
  code?: ErrorCodeType;
  details?: unknown;
}

/**
 * Create a standardized error response
 */
export function error(message: string, status = 400, code?: ErrorCodeType, details?: unknown): Response {
  const response: ErrorResponse = { error: message };

  if (code) {
    response.code = code;
  } else {
    // Auto-assign code based on status
    switch (status) {
      case 400:
        response.code = ErrorCode.BAD_REQUEST;
        break;
      case 401:
        response.code = ErrorCode.UNAUTHORIZED;
        break;
      case 403:
        response.code = ErrorCode.FORBIDDEN;
        break;
      case 404:
        response.code = ErrorCode.NOT_FOUND;
        break;
      case 409:
        response.code = ErrorCode.CONFLICT;
        break;
      case 422:
        response.code = ErrorCode.VALIDATION_ERROR;
        break;
      case 429:
        response.code = ErrorCode.RATE_LIMITED;
        break;
      case 500:
      default:
        if (status >= 500) {
          response.code = ErrorCode.INTERNAL_ERROR;
        }
        break;
    }
  }

  if (details !== undefined) {
    response.details = details;
  }

  return json(response, status);
}

/**
 * Shorthand error creators
 */
export const errors = {
  badRequest: (message: string, details?: unknown) =>
    error(message, 400, ErrorCode.BAD_REQUEST, details),
  unauthorized: (message = "Unauthorized") =>
    error(message, 401, ErrorCode.UNAUTHORIZED),
  forbidden: (message = "Forbidden") =>
    error(message, 403, ErrorCode.FORBIDDEN),
  notFound: (message = "Not found") =>
    error(message, 404, ErrorCode.NOT_FOUND),
  validation: (message: string, details?: unknown) =>
    error(message, 422, ErrorCode.VALIDATION_ERROR, details),
  internal: (message = "Internal server error") =>
    error(message, 500, ErrorCode.INTERNAL_ERROR),
  conflict: (message: string) =>
    error(message, 409, ErrorCode.CONFLICT),
};

export async function parseBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  return JSON.parse(text) as T;
}
