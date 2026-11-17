export const SnippetLicensesAbi = [
  {
    type: "function",
    name: "buyLicense",
    inputs: [
      { name: "clipId", type: "bytes32", internalType: "bytes32" },
      { name: "useType", type: "uint8", internalType: "enum SnippetLicenses.UseType" },
    ],
    outputs: [{ name: "licenseId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getClip",
    inputs: [{ name: "clipId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SnippetLicenses.Clip",
        components: [
          { name: "fileHash", type: "bytes32", internalType: "bytes32" },
          { name: "rightsHolder", type: "address", internalType: "address" },
          { name: "contributor", type: "address", internalType: "address" },
          { name: "rhBps", type: "uint16", internalType: "uint16" },
          { name: "contribBps", type: "uint16", internalType: "uint16" },
          { name: "platformBps", type: "uint16", internalType: "uint16" },
          { name: "listed", type: "bool", internalType: "bool" },
          { name: "active", type: "bool", internalType: "bool" },
          { name: "prices", type: "uint256[3]", internalType: "uint256[3]" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLicense",
    inputs: [{ name: "licenseId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SnippetLicenses.License",
        components: [
          { name: "clipId", type: "bytes32", internalType: "bytes32" },
          { name: "fileHash", type: "bytes32", internalType: "bytes32" },
          { name: "buyer", type: "address", internalType: "address" },
          { name: "useType", type: "uint8", internalType: "enum SnippetLicenses.UseType" },
          { name: "timestamp", type: "uint64", internalType: "uint64" },
          { name: "price", type: "uint256", internalType: "uint256" },
          { name: "rhAmount", type: "uint256", internalType: "uint256" },
          { name: "contribAmount", type: "uint256", internalType: "uint256" },
          { name: "platformAmount", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "licenseCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "LicenseIssued",
    inputs: [
      { name: "licenseId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "clipId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "fileHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "useType", type: "uint8", indexed: false, internalType: "enum SnippetLicenses.UseType" },
      { name: "price", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "rhAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "contribAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "platformAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "timestamp", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
] as const;

export const ERC20Abi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
