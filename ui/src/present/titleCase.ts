/** Human-readable label from a logical node id. No semantic inference. */

export function titleCaseLogicalNodeId(logicalNodeId: string): string {
  if (logicalNodeId.length === 0) {
    return "";
  }
  const separated = logicalNodeId
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[._\-\s]+/)
    .filter((token) => token.length > 0);
  return separated.map(titleToken).join(" ");
}

function titleToken(token: string): string {
  if (/^[A-Z0-9]+$/.test(token) && token.length > 1) {
    return token[0] + token.slice(1).toLowerCase();
  }
  return token[0].toUpperCase() + token.slice(1);
}
