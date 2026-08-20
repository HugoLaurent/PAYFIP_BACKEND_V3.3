import vine from '@vinejs/vine'

export const requestOtpValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
  })
)

export const verifyOtpValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    code: vine.string().trim().fixedLength(6),
  })
)
