const clanRestrictedMask = [
  "2",
  "4",
  "8",
  "16",
  "32",
  "8192",
  "268435456",
  "536870912",
  "1099511627776",
].reduce((mask, bit) => mask | BigInt(bit), BigInt(0));

export function hasClanRestrictedPermissions(permissionBits: string) {
  return (BigInt(permissionBits) & clanRestrictedMask) !== BigInt(0);
}
