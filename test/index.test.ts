import u8a from 'uint8arrays'
import { verifyJWS, createJWE, x25519Encrypter } from 'did-jwt'
import { randomBytes } from '@stablelib/random'
import { KeyPair, generateKeyPairFromSeed, convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { encodeDID, Ed25519Provider } from '../src'

describe('key-did-provider-ed25519', () => {
  let provider: Ed25519Provider
  let did: string
  let kp: KeyPair

  beforeAll(() => {
    const seed = randomBytes(32)
    kp = generateKeyPairFromSeed(seed)
    provider = new Ed25519Provider(seed)
    did = encodeDID(kp.publicKey)
  })

  it('encodeDID', () => {
    const pubkey = u8a.fromString(
      'd713cb7f8624d8648496e01010f2bd72f0dcbbdecdb7036f38c20475f5f429bf',
      'base16'
    )
    expect(encodeDID(pubkey)).toMatchSnapshot()
  })

  it('has isDidProvider property', () => {
    expect(provider.isDidProvider).toEqual(true)
  })

  it('signs JWS properly', async () => {
    const payload = { foo: 'bar' }
    const prot = { bar: 'baz' }
    const res = await provider.send({
      jsonrpc: '2.0',
      id: 0,
      method: 'did_createJWS',
      params: { payload, protected: prot, did },
    })
    const pubkey = {
      id: '',
      type: '',
      controller: '',
      publicKeyBase64: u8a.toString(kp.publicKey, 'base64pad'),
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(verifyJWS(res?.result.jws, pubkey)).toEqual(pubkey)
  })

  it('decrypts JWE properly', async () => {
    const encrypter = x25519Encrypter(convertPublicKeyToX25519(kp.publicKey))
    const cleartext = randomBytes(123)
    const jwe = await createJWE(cleartext, [encrypter])
    const res = await provider.send({
      jsonrpc: '2.0',
      id: 0,
      method: 'did_decryptJWE',
      params: { jwe },
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res?.result.cleartext).toEqual(u8a.toString(cleartext, 'base64pad'))
  })

  it('thows if fails to decrypt JWE', async () => {
    const encrypter = x25519Encrypter(randomBytes(32))
    const cleartext = randomBytes(123)
    const jwe = await createJWE(cleartext, [encrypter])
    const res = await provider.send({
      jsonrpc: '2.0',
      id: 0,
      method: 'did_decryptJWE',
      params: { jwe },
    })
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: -32000,
        message: 'Failed to decrypt',
      },
    })
  })
})