import type { ZodType } from 'zod'

export function zodToJsonSchema(schema: ZodType<unknown>): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def

  if (!def) return { type: 'object' }

  const typeName = def.typeName as string

  switch (typeName) {
    case 'ZodObject': {
      const shape = (schema as unknown as { shape: Record<string, ZodType<unknown>> }).shape
      const properties: Record<string, unknown> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value)
        const innerDef = (value as unknown as { _def: Record<string, unknown> })._def
        if (innerDef.typeName !== 'ZodOptional') {
          required.push(key)
        }
      }

      return { type: 'object', properties, required }
    }
    case 'ZodString':
      return { type: 'string', ...(def.description ? { description: def.description as string } : {}) }
    case 'ZodNumber':
      return { type: 'number' }
    case 'ZodBoolean':
      return { type: 'boolean' }
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type as ZodType<unknown>) }
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType as ZodType<unknown>)
    case 'ZodEnum':
      return { type: 'string', enum: (def as unknown as { values: string[] }).values }
    case 'ZodDefault':
      return zodToJsonSchema(def.innerType as ZodType<unknown>)
    default:
      return { type: 'string' }
  }
}
