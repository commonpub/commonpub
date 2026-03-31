// Consistent error helpers for Nitro API routes

export function validationError(errors: Record<string, string[]>): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation failed',
    data: { errors },
  });
}

export function notFound(entity: string): never {
  throw createError({
    statusCode: 404,
    statusMessage: `${entity} not found`,
  });
}

export function forbidden(message = 'Permission denied'): never {
  throw createError({ statusCode: 403, statusMessage: message });
}

export function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message });
}
