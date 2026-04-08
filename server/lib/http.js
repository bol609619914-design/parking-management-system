export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function createHttpError(status, message, details) {
  return new HttpError(status, message, details);
}

export function badRequest(message, details) {
  return createHttpError(400, message, details);
}

export function unauthorized(message = "未登录或登录状态已失效") {
  return createHttpError(401, message);
}

export function forbidden(message = "当前账号无权执行此操作") {
  return createHttpError(403, message);
}

export function notFound(message = "未找到对应资源") {
  return createHttpError(404, message);
}

export function conflict(message = "资源状态冲突") {
  return createHttpError(409, message);
}

export function assert(condition, error) {
  if (!condition) {
    throw error;
  }
}

export function asTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function jsonErrorHandler(error, _req, res, _next) {
  const status = error instanceof HttpError ? error.status : 500;
  const payload = {
    message: error?.message || "服务器内部错误",
  };

  if (error instanceof HttpError && error.details) {
    payload.details = error.details;
  }

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json(payload);
}
