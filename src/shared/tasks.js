/**
 * Current-task projection from the client job roster.
 *
 * Jobs are the Host's durable record of long-running work (shell commands,
 * workflows, helpers). The pet only presents the live ones: running and
 * stopping. Field extraction is defensive because the roster is wire data.
 * @module dsh-pet/shared/tasks
 */

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
    startedAt: Number.isFinite(Number(job.startedAt)) ? Number(job.startedAt) : 0,
  }
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
  tasks.sort((left, right) => left.startedAt - right.startedAt || (left.id < right.id ? -1 : 1))
  if (limit > 0 && tasks.length > limit) return tasks.slice(0, limit)
  return tasks
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
    if (a.id !== b.id || a.label !== b.label || a.status !== b.status || a.progress !== b.progress) return false
  }
  return true
}
