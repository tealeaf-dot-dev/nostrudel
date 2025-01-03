import { SerialPortSigner } from "applesauce-signer/signers/serial-port-signer";
import { Account } from "./account";

export default class SerialPortAccount extends Account {
  readonly type = "serial";
  declare protected _signer: SerialPortSigner;
  public get signer(): SerialPortSigner {
    return this._signer;
  }
  public set signer(value: SerialPortSigner) {
    this._signer = value;
  }

  constructor(pubkey: string) {
    super(pubkey);
    this.signer = new SerialPortSigner();
    this.signer.pubkey = pubkey;
  }
}
