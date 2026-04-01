import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { zodToJsonSchema } from './zodToJson.js'

describe('zodToJsonSchema', () => {
  it('converts ZodString', () => {
    expect(zodToJsonSchema(z.string())).toEqual({ type: 'string' })
  })

  it('converts ZodString with description', () => {
    expect(zodToJsonSchema(z.string().describe('A name'))).toEqual({ type: 'string', description: 'A name' })
  })

  it('converts ZodNumber', () => {
    expect(zodToJsonSchema(z.number())).toEqual({ type: 'number' })
  })

  it('converts ZodBoolean', () => {
    expect(zodToJsonSchema(z.boolean())).toEqual({ type: 'boolean' })
  })

  it('converts ZodObject with required fields', () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    const result = zodToJsonSchema(schema)
    expect(result.type).toBe('object')
    expect(result.required).toEqual(['name', 'age'])
    expect((result.properties as any).name).toEqual({ type: 'string' })
    expect((result.properties as any).age).toEqual({ type: 'number' })
  })

  it('converts ZodObject with optional fields', () => {
    const schema = z.object({ name: z.string(), bio: z.string().optional() })
    const result = zodToJsonSchema(schema)
    expect(result.required).toEqual(['name'])
  })

  it('converts ZodArray', () => {
    const schema = z.array(z.string())
    expect(zodToJsonSchema(schema)).toEqual({ type: 'array', items: { type: 'string' } })
  })

  it('converts ZodOptional (unwraps)', () => {
    expect(zodToJsonSchema(z.string().optional())).toEqual({ type: 'string' })
  })

  it('converts ZodNullable', () => {
    expect(zodToJsonSchema(z.string().nullable())).toEqual({ type: 'string', nullable: true })
  })

  it('converts ZodEnum', () => {
    const schema = z.enum(['a', 'b', 'c'])
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string', enum: ['a', 'b', 'c'] })
  })

  it('converts ZodLiteral string', () => {
    expect(zodToJsonSchema(z.literal('hello'))).toEqual({ type: 'string', const: 'hello' })
  })

  it('converts ZodLiteral number', () => {
    expect(zodToJsonSchema(z.literal(42))).toEqual({ type: 'number', const: 42 })
  })

  it('converts ZodUnion', () => {
    const schema = z.union([z.string(), z.number()])
    const result = zodToJsonSchema(schema)
    expect(result.anyOf).toEqual([{ type: 'string' }, { type: 'number' }])
  })

  it('converts ZodDefault (unwraps)', () => {
    expect(zodToJsonSchema(z.string().default('hi'))).toEqual({ type: 'string' })
  })

  it('converts ZodRecord', () => {
    const schema = z.record(z.number())
    expect(zodToJsonSchema(schema)).toEqual({ type: 'object', additionalProperties: { type: 'number' } })
  })

  it('converts nested objects', () => {
    const schema = z.object({
      user: z.object({ name: z.string() }),
    })
    const result = zodToJsonSchema(schema)
    const userProp = (result.properties as any).user
    expect(userProp.type).toBe('object')
    expect(userProp.properties.name).toEqual({ type: 'string' })
  })

  it('falls back to string for unknown types', () => {
    const fake = { _def: { typeName: 'ZodUnknownThing' } } as any
    expect(zodToJsonSchema(fake)).toEqual({ type: 'string' })
  })

  it('returns object for null def', () => {
    const fake = { _def: null } as any
    expect(zodToJsonSchema(fake)).toEqual({ type: 'object' })
  })
})
