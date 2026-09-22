import { describe, expect, it } from 'vitest'
import decodeQR from 'qr/decode.js'
import { createInviteQrMatrix } from './StaffInvitePanel'

function matrixToRgba(matrix: boolean[][], scale = 6) {
  const width = matrix[0].length * scale
  const height = matrix.length * scale
  const data = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dark = matrix[Math.floor(y / scale)][Math.floor(x / scale)]
      const offset = (y * width + x) * 4
      const color = dark ? 0 : 255
      data[offset] = color
      data[offset + 1] = color
      data[offset + 2] = color
      data[offset + 3] = 255
    }
  }

  return { width, height, data }
}

describe('StaffInvitePanel QR', () => {
  it('encodes the issued URL byte-for-byte, including a Japanese fragment and token', async () => {
    const inviteUrl = 'https://pawpair.example/owner#招待=春の受付&token=aB_9-256bit-token'
    const matrix = await createInviteQrMatrix(inviteUrl)

    expect(decodeQR(matrixToRgba(matrix))).toBe(inviteUrl)
  })

  it('preserves a 256-bit base64url invite fragment exactly', async () => {
    const token = `${'Ab0_-'.repeat(8)}xyz`
    const inviteUrl = `https://pawpair.example/owner#invite=${token}`
    const matrix = await createInviteQrMatrix(inviteUrl)

    expect(token).toHaveLength(43)
    expect(decodeQR(matrixToRgba(matrix))).toBe(inviteUrl)
  })
})
