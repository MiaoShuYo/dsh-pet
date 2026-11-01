import test from 'node:test'
import assert from 'node:assert/strict'
import { sameTasks, taskFromJob, tasksFromJobs } from '../src/shared/tasks.js'

function job(overrides = {}) {
  return {
    id: 'job-1',
    kind: 'bash',
    label: '创建 V1.6.4 分支',
    status: 'running',
    progress: '正在运行命令',
    startedAt: 100,
    ...overrides,
  }
}

test('taskFromJob keeps only live jobs', () => {
  assert.equal(taskFromJob(job()).label, '创建 V1.6.4 分支')
  assert.equal(taskFromJob(job()).status, 'running')
  assert.equal(taskFromJob(job({ status: 'completed' })), null)
  assert.equal(taskFromJob(job({ status: 'failed' })), null)
  assert.equal(taskFromJob(null), null)
})

test('taskFromJob falls back to the kind for a blank label', () => {
  assert.equal(taskFromJob(job({ label: '' })).label, 'bash')
  assert.equal(taskFromJob(job({ label: '', kind: '' })).label, 'Task')
})

test('tasksFromJobs filters, sorts and limits', () => {
  const tasks = tasksFromJobs([
    job({ id: 'b', startedAt: 200, label: 'B' }),
    job({ id: 'a', startedAt: 100, label: 'A' }),
    job({ id: 'c', status: 'completed' }),
    job({ id: 'd', status: 'stopping', startedAt: 300, label: 'D' }),
  ])
  assert.deepEqual(tasks.map(task => task.id), ['a', 'b', 'd'])
  assert.equal(tasksFromJobs([job(), job({ id: 'x' })], 1).length, 1)
  assert.deepEqual(tasksFromJobs('nope'), [])
})

test('sameTasks compares identity, label, status and progress', () => {
  const left = tasksFromJobs([job()])
  assert.equal(sameTasks(left, tasksFromJobs([job()])), true)
  assert.equal(sameTasks(left, tasksFromJobs([job({ status: 'stopping' })])), false)
  assert.equal(sameTasks(left, tasksFromJobs([job({ label: 'Other' })])), false)
  assert.equal(sameTasks(left, tasksFromJobs([job(), job({ id: 'job-2' })])), false)
})
