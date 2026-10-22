// Who keeps a passkey, from the AAGUID its authenticator reported, so the list can say "Google Password Manager"
// rather than an id. A few common ones only, checked against passkeydeveloper/passkey-authenticator-aaguids on
// 2026-10-22. Apple reports no AAGUID without attestation, so an iPhone's passkey shows the device it was made on.
const providers: Readonly<Record<string, string>> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "Apple Passwords",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome trên Mac",
  "771b48fd-d3d4-4f74-9232-fc157ab0507a": "Edge trên Mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "d3452668-01fd-4c12-926c-83a4204853aa": "Microsoft Password Manager",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "531126d6-e717-415c-9320-3d9aa6981239": "Dashlane",
  "50726f74-6f6e-5061-7373-50726f746f6e": "Proton Pass",
};

export function providerName(aaguid: string): string | undefined {
  return providers[aaguid.toLowerCase()];
}
