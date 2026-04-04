import { z } from 'zod'

export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType)
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key)
      }
    }
    const result: Record<string, unknown> = { type: 'object', properties }
    if (required.length > 0) result.required = required
    return result
  }
  if (schema instanceof z.ZodString) return { type: 'string' }
  if (schema instanceof z.ZodNumber) return { type: 'number' }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema((schema as z.ZodArray<z.ZodType>).element) }
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as z.ZodOptional<z.ZodType>).unwrap())
  }
  if (schema instanceof z.ZodNullable) {
    return zodToJsonSchema((schema as z.ZodNullable<z.ZodType>).unwrap())
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: (schema as z.ZodEnum<[string, ...string[]]>).options }
  }
  if (schema instanceof z.ZodLiteral) {
    return { type: typeof schema.value, const: schema.value }
  }
  if (schema instanceof z.ZodUnion) {
    const options = (schema as z.ZodUnion<[z.ZodType, ...z.ZodType[]]>).options
    return { anyOf: options.map((o: z.ZodType) => zodToJsonSchema(o)) }
  }
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema((schema as z.ZodDefault<z.ZodType>).removeDefault())
    return { ...inner, default: schema._def.defaultValue() }
  }
  if (schema instanceof z.ZodEffects) {
    return zodToJsonSchema((schema as z.ZodEffects<z.ZodType>).innerType())
  }
  if (schema instanceof z.ZodRecord) {
    return { type: 'object', additionalProperties: zodToJsonSchema((schema as z.ZodRecord).valueSchema) }
  }
  return {}
}
