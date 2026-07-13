import { describe, expect, it, vi } from 'vitest'
import { createObjectUrlLease } from './useVideoFile'

function makeUrlApi() {
  let counter = 0
  return {
    createObjectURL: vi.fn(() => `blob:mock-${++counter}`),
    revokeObjectURL: vi.fn(),
  }
}

describe('createObjectUrlLease', () => {
  it('révoque l’URL précédente lors d’un remplacement', () => {
    const urlApi = makeUrlApi()
    const lease = createObjectUrlLease(urlApi)

    const first = lease.replace(new File([''], 'a.mp4'))
    const second = lease.replace(new File([''], 'b.mp4'))

    expect(first).toBe('blob:mock-1')
    expect(second).toBe('blob:mock-2')
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(lease.current()).toBe('blob:mock-2')
  })

  it('révoque l’URL lors de la réinitialisation', () => {
    const urlApi = makeUrlApi()
    const lease = createObjectUrlLease(urlApi)

    lease.replace(new File([''], 'a.mp4'))
    lease.release()

    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(lease.current()).toBeNull()
  })

  it('ne révoque rien si aucune URL n’est active', () => {
    const urlApi = makeUrlApi()
    const lease = createObjectUrlLease(urlApi)

    lease.release()

    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled()
  })
})
