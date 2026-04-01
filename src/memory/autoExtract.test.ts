import { describe, it, expect } from 'bun:test'
import { buildExtractionPrompt, parseExtractedMemories } from './autoExtract.js'
import type { Message } from '../commands/types.js'

describe('buildExtractionPrompt', () => {
  it('contains extraction instructions', () => {
    const prompt = buildExtractionPrompt([], '')
    expect(prompt).toContain('extract')
    expect(prompt).toContain('Memory types')
    expect(prompt).toContain('user')
    expect(prompt).toContain('feedback')
    expect(prompt).toContain('project')
    expect(prompt).toContain('reference')
  })

  it('contains transcript of last 20 string messages', () => {
    const messages: Message[] = []
    for (let i = 0; i < 25; i++) {
      messages.push({ role: 'user', content: `message-${i}` })
    }

    const prompt = buildExtractionPrompt(messages, '')
    // Should contain the last 20 (indices 5-24)
    expect(prompt).toContain('message-24')
    expect(prompt).toContain('message-5')
    // Should NOT contain the first 5
    expect(prompt).not.toContain('message-4')
  })

  it('includes existing index when provided', () => {
    const prompt = buildExtractionPrompt([], 'existing-memory: user likes TypeScript')
    expect(prompt).toContain('existing-memory: user likes TypeScript')
    expect(prompt).toContain("don't duplicate")
  })

  it('handles empty messages', () => {
    const prompt = buildExtractionPrompt([], '')
    expect(prompt).toContain('Conversation transcript')
  })

  it('filters out non-string content messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hello there' },
      { role: 'assistant', content: [{ type: 'text', text: 'block content' }] },
      { role: 'user', content: 'goodbye' },
    ]

    const prompt = buildExtractionPrompt(messages, '')
    expect(prompt).toContain('hello there')
    expect(prompt).toContain('goodbye')
    expect(prompt).not.toContain('block content')
  })
})

describe('parseExtractedMemories', () => {
  it('extracts JSON blocks from markdown code fences', () => {
    const output = 'Here are the memories:\n```json\n{"name": "user-pref", "description": "likes TS", "type": "user", "content": "User prefers TypeScript"}\n```\n'
    const memories = parseExtractedMemories(output)
    expect(memories.length).toBe(1)
    expect(memories[0].name).toBe('user-pref')
    expect(memories[0].description).toBe('likes TS')
    expect(memories[0].type).toBe('user')
    expect(memories[0].content).toBe('User prefers TypeScript')
  })

  it('returns array of {name, description, type, content}', () => {
    const output = '```json\n{"name": "test", "description": "desc", "type": "feedback", "content": "stuff"}\n```'
    const memories = parseExtractedMemories(output)
    expect(memories[0]).toHaveProperty('name')
    expect(memories[0]).toHaveProperty('description')
    expect(memories[0]).toHaveProperty('type')
    expect(memories[0]).toHaveProperty('content')
  })

  it('skips invalid JSON', () => {
    const output = '```json\n{not valid json!!!}\n```'
    const memories = parseExtractedMemories(output)
    expect(memories.length).toBe(0)
  })

  it('skips blocks missing required fields', () => {
    const output = '```json\n{"name": "incomplete", "description": "no type or content"}\n```'
    const memories = parseExtractedMemories(output)
    expect(memories.length).toBe(0)
  })

  it('parses multiple JSON blocks into multiple memories', () => {
    const output = '```json\n{"name": "mem-1", "description": "first", "type": "user", "content": "content 1"}\n```\n\nSome text\n\n```json\n{"name": "mem-2", "description": "second", "type": "project", "content": "content 2"}\n```\n'
    const memories = parseExtractedMemories(output)
    expect(memories.length).toBe(2)
    expect(memories[0].name).toBe('mem-1')
    expect(memories[1].name).toBe('mem-2')
  })

  it('returns empty array when no JSON blocks present', () => {
    const memories = parseExtractedMemories('Just plain text, no JSON here.')
    expect(memories.length).toBe(0)
  })

  it('returns empty array for NO_MEMORIES text', () => {
    const memories = parseExtractedMemories('NO_MEMORIES')
    expect(memories.length).toBe(0)
  })
})
