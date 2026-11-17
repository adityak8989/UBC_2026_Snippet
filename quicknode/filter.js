// QuickNode Streams filter for Snippet (Arc testnet, dataset: Logs).
// Paste this whole function into the Stream's "Filter" step.
//
// Keeps only LicenseIssued events from the SnippetLicenses contract and drops everything else
// (USDC transfers, system logs, other contracts). Returning null skips the delivery entirely.
// The webhook (web/app/api/streams/route.ts) verifies the signature and decodes the logs.
//
// Written in plain ES5 style (var, function, loops) so it runs in any filter runtime.
function main(stream) {
  var CONTRACT = "0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20";
  var LICENSE_ISSUED = "0x019c42efa4a2ed077d7577fc401e2f0dfcf241fd5f419761e314dd00c73cfd8d";

  var matches = [];

  // The Logs dataset nests logs in arrays (per block); walk any depth.
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i]);
      return;
    }
    if (node.topics && node.address && typeof node.data === "string") {
      if (
        String(node.address).toLowerCase() === CONTRACT &&
        node.topics.length > 0 &&
        String(node.topics[0]).toLowerCase() === LICENSE_ISSUED &&
        node.removed !== true
      ) {
        matches.push(node);
      }
    }
  }

  walk(stream && stream.data !== undefined ? stream.data : stream);

  if (matches.length === 0) return null;
  return { matches: matches };
}
