/**
 * Current-task projection from the client job roster and live tool calls.
 *
 * Jobs are the Host's durable record of long-running work (shell commands,
 * workflows, helpers). Tool calls are the in-flight conversation work the user
 * sees streaming; a synchronous command is a tool call, not a job. The pet
 * presents both while they are live.
 * @module dsh-pet/shared/tasks
 */

const COMMAND_TOOLS = new Set([
  'bash', 'cmd', 'command', 'exec', 'execute', 'powershell', 'process', 'pwsh',
  'run', 'run_command', 'shell', 'sh', 'spawn', 'terminal',
])

/**
 * Whether a tool name represents a command execution.
 * @param name - tool name.
 * @returns boolean.
 */
export function isCommandTool(name) {
  return typeof name === 'string' && COMMAND_TOOLS.has(name.toLowerCase())
}

/**
 * Parse a tool-call arguments payload.
 * @param raw - JSON text or already-parsed object.
 * @returns plain object.
 */
function parseArguments(raw) {
  if (raw !== null && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch (_error) {
    return {}
  }
}

/**
 * First non-empty string field.
 * @param value - candidate.
 * @returns trimmed string.
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Reduce one job row to the fields the pet needs.
 * @param job - one `job.list` row.
 * @returns task record, or null for a non-live/blank row.
 */
export function taskFromJob(job) {
  if (job === null || typeof job !== 'object') return null
  if (job.status !== 'running' && job.status !== 'stopping') return null
  const label = typeof job.label === 'string' && job.label.trim() !== ''
    ? job.label.trim()
    : typeof job.kind === 'string' && job.kind.trim() !== ''
      ? job.kind.trim()
      : 'Task'
  return {
    id: typeof job.id === 'string' ? job.id : String(job.id || label),
    label,
    status: job.status,
    progress: typeof job.progress === 'string' ? job.progress.trim() : '',
    kind: typeof job.kind === 'string' ? job.kind : '',
    source: 'job',
    toolName: '',
    command: false,
    startedAt: Number.isFinite(Number(job.startedAt)) ? Number(job.startedAt) : 0,
  }
}

/**
 * Reduce one `tool/call` Session event to a live task.
 * @param event - Session event with type `tool/call`.
 * @returns task record, or null when it has no call identity.
 */
export function taskFromToolCall(event) {
  if (event === null || typeof event !== 'object' || event.type !== 'tool/call') return null
  const data = event.data !== null && typeof event.data === 'object' ? event.data : {}
  const callId = text(data.callId)
  const name = text(data.name) || 'tool'
  if (callId === '') return null
  const args = parseArguments(data.arguments)
  const description = text(args.description)
  const command = text(args.command)
  const path = text(args.path)
  const firstLine = command === '' ? '' : command.split(/\r?\n/, 1)[0].trim()
  const rawLabel = description || firstLine || (path === '' ? name : `${name} ${path}`)
  const label = rawLabel.length > 96 ? `${rawLabel.slice(0, 93)}...` : rawLabel
  const startedAt = Number.isFinite(Number(event.time))
    ? Number(event.time)
    : Number.isFinite(Number(event.seq)) ? Number(event.seq) : 0
  return {
    id: `tool-${callId}`,
    label,
    status: 'running',
    progress: '',
    kind: name,
    source: 'tool',
    toolName: name,
    command: isCommandTool(name),
    startedAt,
  }
}

/**
 * Sort live tasks oldest first.
 * @param tasks - task records.
 * @returns a new sorted array.
 */
export function sortTasks(tasks) {
  return [...tasks].sort((left, right) => left.startedAt - right.startedAt || (left.id < right.id ? -1 : 1))
}

/**
 * Project a job roster into the ordered live task list.
 * @param rows - `job.list` rows for one session.
 * @param limit - maximum tasks to keep, if positive.
 * @returns ordered tasks (oldest first).
 */
export function tasksFromJobs(rows, limit = 0) {
  if (!Array.isArray(rows)) return []
  const tasks = []
  for (const job of rows) {
    const task = taskFromJob(job)
    if (task !== null) tasks.push(task)
  }
  const sorted = sortTasks(tasks)
  if (limit > 0 && sorted.length > limit) return sorted.slice(0, limit)
  return sorted
}

/**
 * Whether two task lists describe the same live work.
 * @param left - previous tasks.
 * @param right - next tasks.
 * @returns whether every task identity, label and status matches.
 */
export function sameTasks(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return left === right
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (a.id !== b.id || a.label !== b.label || a.status !== b.status
      || a.progress !== b.progress || a.source !== b.source || a.command !== b.command
      || a.sessionId !== b.sessionId || a.sessionTitle !== b.sessionTitle
      || a.background !== b.background) return false
  }
  return true
}
