/* Site-wide configuration. Pure data, no side effects. */
window.HC_CONFIG = {
  // Read-only RPC. Swappable for Rarible later.
  rpc: "https://ethereum-rpc.publicnode.com",
  chainId: 1,

  contracts: {
    // The 2018 pre-standard original. mineCard() lives here.
    original: "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc",
    // ERC-721 wrapper used for ownership reads.
    wrapper: "0xf6f722590af5f791f68d0ed88d27b72dde1c70ca"
  },

  deployed: "13 MAR 2018",

  // Minimal ABIs (human-readable, ethers v5 friendly).
  abi: {
    // Original contract: random weighted mint + price + roster reads.
    original: [
      "function mineCard() payable returns (bool success)",
      "function getCardPrice() view returns (uint256)",
      "function getHumanNumber() view returns (uint256)",
      "function getHumanInfo(uint256 i) view returns (string name, uint8 max, uint256 mined)",
      "event Mined(address indexed newOwner, uint16 humanId)"
    ],
    // Wrapper: standard ERC-721 ownership surface.
    wrapper: [
      "function balanceOf(address owner) view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function name() view returns (string)",
      "function symbol() view returns (string)"
    ]
  }
};
