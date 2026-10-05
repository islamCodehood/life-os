export interface PinHasher {
  hash(pin: string): Promise<string>;
  verify(hash: string, pin: string): Promise<boolean>;
}
